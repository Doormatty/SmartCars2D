/* ==========================================================================
 * HTML5 Genetic Cars - Single-file bundle (no npm/browserify required)
 * Serve index.html over HTTP so the Box2D wasm file can be fetched.
 * ========================================================================== */
(async function () {
  "use strict";

  if (typeof Box2D !== "function") {
    throw new Error("Box2D v3 wrapper failed to load");
  }

  const b2 = await Box2D({
    module: {
      locateFile(path) {
        return "lib/box2d-v3/" + path;
      },
    },
  });

  function vec2(x, y) {
    return { x: x, y: y };
  }

  function cloneVec2(v) {
    return { x: v.x, y: v.y };
  }

  function requireElementById(id) {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error("Missing required element #" + id);
    }
    return element;
  }

  function requireNamedElement(name) {
    const elements = document.getElementsByName(name);
    if (elements.length === 0) {
      throw new Error("Missing required element named " + name);
    }
    return elements[0];
  }

  function get2dContext(canvas, label) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("2D canvas context is unavailable for " + label);
    }
    return context;
  }

  function parseFiniteFloat(value, fallback) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function parseFiniteInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  const TWO_PI = 2 * Math.PI;

  function createId() {
    return Math.random().toString(36).slice(2);
  }

  function bodyHandle(entity) {
    return entity && entity.body ? entity.body : entity;
  }

  function getBodyPosition(entity) {
    return b2.getBodyPosition(bodyHandle(entity));
  }

  function getBodyVelocity(entity) {
    return b2.getBodyVelocity(bodyHandle(entity));
  }

  function getBodyTransform(entity) {
    return b2.getBodyTransform(bodyHandle(entity));
  }

  function transformPoint(transform, point) {
    let angle = transform.angle || 0;
    return transformPointWithTrig(transform, point, Math.cos(angle), Math.sin(angle));
  }

  function transformPointWithTrig(transform, point, c, s) {
    return {
      x: transform.position.x + c * point.x - s * point.y,
      y: transform.position.y + s * point.x + c * point.y,
    };
  }

  function getWorldPoint(entity, point) {
    return transformPoint(getBodyTransform(entity), point);
  }

  /* -------------------------------------------------------------------------
   * machine-learning/random.js
   * ------------------------------------------------------------------------- */


  const random = {
    shuffleIntegers(prop, generator) {
      return random.mapToShuffle(prop, random.createNormals({
        length: prop.length || 10,
        inclusive: true,
      }, generator));
    },
    createIntegers(prop, generator) {
      return random.mapToInteger(prop, random.createNormals({
        length: prop.length,
        inclusive: true,
      }, generator));
    },
    createFloats(prop, generator) {
      return random.mapToFloat(prop, random.createNormals({
        length: prop.length,
        inclusive: true,
      }, generator));
    },
    createNormals(prop, generator) {
      let l = prop.length;
      let values = new Array(l);
      for (let i = 0; i < l; i++) {
        values[i] = createNormal(prop, generator);
      }
      return values;
    },
    mapToShuffle(prop, normals) {
      let offset = prop.offset || 0;
      let limit = prop.limit || prop.length;
      let sorted = normals.slice().sort(function (a, b) {
        return a - b;
      });
      let rankByValue = new Map();
      for (let i = 0; i < sorted.length; i++) {
        if (!rankByValue.has(sorted[i])) {
          rankByValue.set(sorted[i], i + offset);
        }
      }
      let values = new Array(Math.min(limit, normals.length));
      for (let i = 0; i < values.length; i++) {
        values[i] = rankByValue.get(normals[i]);
      }
      return values;
    },
    mapToInteger(prop, normals) {
      let normalizedProp = {
        min: Number.isFinite(prop.min) ? prop.min : 0,
        range: Number.isFinite(prop.range) ? prop.range : 10,
        length: prop.length
      };
      let values = random.mapToFloat(normalizedProp, normals);
      for (let i = 0; i < values.length; i++) {
        values[i] = Math.round(values[i]);
      }
      return values;
    },
    mapToFloat(prop, normals) {
      let normalizedProp = {
        min: Number.isFinite(prop.min) ? prop.min : 0,
        range: Number.isFinite(prop.range) ? prop.range : 1
      };
      let min = normalizedProp.min;
      let range = normalizedProp.range;
      let values = new Array(normals.length);
      for (let i = 0; i < normals.length; i++) {
        values[i] = min + normals[i] * range;
      }
      return values;
    },
    mutateReplace(prop, generator, originalValues, mutation_range, chanceToMutate) {
      let factor = (prop.factor || 1) * mutation_range;
      let values = new Array(originalValues.length);
      for (let i = 0; i < originalValues.length; i++) {
        let originalValue = originalValues[i];
        if (generator() > chanceToMutate) {
          values[i] = originalValue;
          continue;
        }

        // Calculate bounds based on the factor, centered around the original value
        let minBound = Math.max(0, originalValue - (factor / 2));
        let maxBound = Math.min(1, originalValue + (factor / 2));

        // Pick a completely random flat value within those bounds
        // Fallback to 0-1 if factor is >= 1 (100% mutation size)
        if (factor >= 1) {
          minBound = 0;
          maxBound = 1;
        }

        let rangeValue = createNormal({ inclusive: true }, generator);
        // Map [0, 1] to [minBound, maxBound]
        values[i] = minBound + (rangeValue * (maxBound - minBound));
      }
      return values;
    }
  };



  function createNormal(prop, generator) {
    if (!prop.inclusive) {
      return generator();
    } else {
      return generator() < 0.5 ?
        generator() :
        1 - generator();
    }
  }

  function getSchemaKeys(schema) {
    return Object.keys(schema);
  }

  function getSchemaLength(schemaProp, key) {
    let length = schemaProp.length;
    if (!Number.isInteger(length) || length < 0) {
      throw new Error("Schema key " + key + " must define a non-negative integer length");
    }
    return length;
  }

  function getSchemaGeneCount(schema) {
    let keys = getSchemaKeys(schema);
    let geneCount = 0;
    for (let i = 0; i < keys.length; i++) {
      let key = keys[i];
      geneCount += getSchemaLength(schema[key], key);
    }
    return geneCount;
  }

  function clampNormal(value) {
    if (value < 0) {
      return 0;
    }
    if (value > 1) {
      return 1;
    }
    return value;
  }

  function getDefaultNormal(schemaProp) {
    if (Number.isFinite(schemaProp.defaultNormal)) {
      return clampNormal(schemaProp.defaultNormal);
    }
    return 0.5;
  }

  function normalizeGeneValues(schemaProp, key, sourceValues, generator) {
    let length = getSchemaLength(schemaProp, key);
    let values = new Array(length);
    let sourceIsArrayLike = sourceValues && typeof sourceValues.length === "number";
    for (let i = 0; i < length; i++) {
      let sourceValue = sourceIsArrayLike ? sourceValues[i] : undefined;
      if (Number.isFinite(sourceValue)) {
        values[i] = clampNormal(sourceValue);
      } else if (typeof generator === "function") {
        values[i] = createNormal(schemaProp, generator);
      } else {
        values[i] = getDefaultNormal(schemaProp);
      }
    }
    return values;
  }

  function normalizeGenome(schema, source, generator) {
    let clone = Object.assign({}, source || {});
    if (typeof clone.id !== "string" || clone.id.length === 0) {
      clone.id = createId();
    }
    let keys = getSchemaKeys(schema);
    for (let i = 0; i < keys.length; i++) {
      let key = keys[i];
      clone[key] = normalizeGeneValues(schema[key], key, clone[key], generator);
    }
    return clone;
  }

  function normalizeGeneration(schema, sourceGeneration, generator) {
    if (!Array.isArray(sourceGeneration)) {
      throw new Error("Saved generation must be an array");
    }
    let normalized = new Array(sourceGeneration.length);
    for (let i = 0; i < sourceGeneration.length; i++) {
      normalized[i] = normalizeGenome(schema, sourceGeneration[i], generator);
      normalized[i].index = i;
    }
    return normalized;
  }


  /* -------------------------------------------------------------------------
   * machine-learning/create-instance.js
   * ------------------------------------------------------------------------- */


  const createInstance = {
    createGenerationZero(schema, generator) {
      let instance = { id: createId() };
      let keys = getSchemaKeys(schema);
      for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
        let schemaProp = schema[key];
        instance[key] = random.createNormals(schemaProp, generator);
      }
      return instance;
    },
    createCrossBreed(schema, parents, parentChooser, generator) {
      if (!Array.isArray(parents) || parents.length === 0) {
        throw new Error("createCrossBreed requires at least one parent");
      }
      let id = createId();
      let normalizedParents = new Array(parents.length);
      let ancestry = new Array(parents.length);
      for (let i = 0; i < parents.length; i++) {
        normalizedParents[i] = normalizeGenome(schema, parents[i], generator);
        ancestry[i] = {
          id: normalizedParents[i].id,
          index: Number.isInteger(normalizedParents[i].index) ? normalizedParents[i].index : null,
          bornGeneration: Number.isFinite(normalizedParents[i].bornGeneration) ? normalizedParents[i].bornGeneration : null,
          isElite: normalizedParents[i].is_elite === true,
          ancestry: normalizedParents[i].ancestry,
        };
      }
      let crossDef = {
        id: id,
        ancestry: ancestry
      };
      let keys = getSchemaKeys(schema);
      let geneCount = getSchemaGeneCount(schema);
      let geneIndex = 0;
      for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
        let key = keys[keyIndex];
        let schemaDef = schema[key];
        let values = new Array(schemaDef.length);
        for (let valueIndex = 0, l = schemaDef.length; valueIndex < l; valueIndex++) {
          let p = parentChooser(id, key, valueIndex, geneIndex, normalizedParents, geneCount);
          if (!Number.isInteger(p) || p < 0 || p >= normalizedParents.length) {
            p = 0;
          }
          values[valueIndex] = normalizedParents[p][key][valueIndex];
          geneIndex++;
        }
        crossDef[key] = values;
      }
      return crossDef;
    },
    createMutatedClone(schema, generator, parent, factor, chanceToMutate) {
      let mutateFn = random.mutateReplace;
      let normalizedParent = normalizeGenome(schema, parent, generator);
      let clone = Object.assign({}, normalizedParent);
      let keys = getSchemaKeys(schema);
      for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
        let schemaProp = schema[key];
        let originalValues = normalizedParent[key];
        clone[key] = mutateFn(
          schemaProp, generator, originalValues, factor, chanceToMutate
        );
      }
      return clone;
    },
    applyTypes(schema, parent) {
      let normalizedParent = normalizeGenome(schema, parent);
      let clone = Object.assign({}, normalizedParent);
      let keys = getSchemaKeys(schema);
      for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
        let schemaProp = schema[key];
        let originalValues = normalizedParent[key];
        let values;
        switch (schemaProp.type) {
          case "shuffle":
            values = random.mapToShuffle(schemaProp, originalValues); break;
          case "float":
            values = random.mapToFloat(schemaProp, originalValues); break;
          case "integer":
            values = random.mapToInteger(schemaProp, originalValues); break;
          default:
            throw new Error(`Unknown type ${schemaProp.type} of schema for key ${key}`);
        }
        clone[key] = values;
      }
      return clone;
    },
  }


  /* -------------------------------------------------------------------------
   * car-schema/car-constants.json (inlined)
   * ------------------------------------------------------------------------- */
  const carConstantsData = {
    "wheelCount": 2,
    "wheelMinRadius": 0.2,
    "wheelRadiusRange": 0.5,
    "wheelMinDensity": 40,
    "wheelDensityRange": 100,
    "chassisDensityRange": 300,
    "chassisMinDensity": 30,
    "chassisMinAxis": 0.1,
    "chassisAxisRange": 1.1
  };

  const CHASSIS_VERTEX_BLUEPRINT = [
    { x: { gene: 0 }, y: 0 },
    { x: { gene: 1 }, y: { gene: 2 } },
    { x: 0, y: { gene: 3 } },
    { x: { gene: 4, sign: -1 }, y: { gene: 5 } },
    { x: { gene: 6, sign: -1 }, y: 0 },
    { x: { gene: 7, sign: -1 }, y: { gene: 8, sign: -1 } },
    { x: 0, y: { gene: 9, sign: -1 } },
    { x: { gene: 10 }, y: { gene: 11, sign: -1 } },
  ];

  function getBlueprintGeneCount(blueprint) {
    let maxGene = -1;
    for (let i = 0; i < blueprint.length; i++) {
      maxGene = Math.max(
        maxGene,
        getBlueprintAxisGene(blueprint[i].x),
        getBlueprintAxisGene(blueprint[i].y)
      );
    }
    return maxGene + 1;
  }

  function getBlueprintAxisGene(axis) {
    if (typeof axis === "number") {
      return -1;
    }
    if (!axis || !Number.isInteger(axis.gene) || axis.gene < 0) {
      throw new Error("Chassis vertex blueprint axes must be numbers or non-negative gene references");
    }
    return axis.gene;
  }

  function createChassisVertexList(vertexGenes) {
    let vertexList = new Array(CHASSIS_VERTEX_BLUEPRINT.length);
    for (let i = 0; i < CHASSIS_VERTEX_BLUEPRINT.length; i++) {
      let point = CHASSIS_VERTEX_BLUEPRINT[i];
      vertexList[i] = vec2(
        readChassisBlueprintAxis(point.x, vertexGenes),
        readChassisBlueprintAxis(point.y, vertexGenes)
      );
    }
    return vertexList;
  }

  function readChassisBlueprintAxis(axis, vertexGenes) {
    if (typeof axis === "number") {
      return axis;
    }
    let value = vertexGenes[axis.gene];
    if (!Number.isFinite(value)) {
      throw new Error("Missing chassis vertex gene " + axis.gene);
    }
    return value * (axis.sign || 1);
  }

  /* -------------------------------------------------------------------------
   * car-schema/construct.js
   * ------------------------------------------------------------------------- */

  const carConstruct = (function () {
    const carConstants = carConstantsData;

    function worldDef() {
      let box2dfps = 60;
      return {
        gravity: { y: 0 }, doSleep: true, floorseed: "abc",
        maxFloorTiles: 200, mutable_floor: false, motorSpeed: 20,
        box2dfps: box2dfps, max_idle_timer: box2dfps * 10,
        tileDimensions: { width: 1.5, height: 0.15 }
      };
    }
    function getCarConstants() { return carConstants; }
    function generateSchema(values) {
      return {
        wheel_radius: { type: "float", length: values.wheelCount, min: values.wheelMinRadius, range: values.wheelRadiusRange, factor: 1 },
        wheel_density: { type: "float", length: values.wheelCount, min: values.wheelMinDensity, range: values.wheelDensityRange, factor: 1 },
        chassis_density: { type: "float", length: 1, min: values.chassisMinDensity, range: values.chassisDensityRange, factor: 1 },
        vertex_list: { type: "float", length: getBlueprintGeneCount(CHASSIS_VERTEX_BLUEPRINT), min: values.chassisMinAxis, range: values.chassisAxisRange, factor: 1 },
        wheel_vertex: { type: "shuffle", length: CHASSIS_VERTEX_BLUEPRINT.length, limit: values.wheelCount, factor: 1 },
      };
    }
    return { worldDef: worldDef, carConstants: getCarConstants, generateSchema: generateSchema };
  })();


  /* -------------------------------------------------------------------------
   * car-schema/def-to-car.js
   * ------------------------------------------------------------------------- */
  function defToCar(normal_def, world, constants) {
    let car_def = createInstance.applyTypes(constants.schema, normal_def)
    let instance = {};
    instance.joints = [];
    instance.chassis = createChassis(
      world, car_def.vertex_list, car_def.chassis_density
    );
    let i;

    let wheelCount = car_def.wheel_radius.length;

    instance.wheels = [];
    for (i = 0; i < wheelCount; i++) {
      instance.wheels[i] = createWheel(
        world,
        car_def.wheel_radius[i],
        car_def.wheel_density[i]
      );
    }

    let carmass = b2.getBodyMass(instance.chassis.body);
    for (i = 0; i < wheelCount; i++) {
      carmass += b2.getBodyMass(instance.wheels[i].body);
    }

    for (i = 0; i < wheelCount; i++) {
      let torque = carmass * -constants.gravity.y / car_def.wheel_radius[i];

      let randvertex = instance.chassis.vertex_list[car_def.wheel_vertex[i]];
      b2.setBodyTransform(instance.wheels[i].body, {
        position: getWorldPoint(instance.chassis, randvertex),
        angle: 0,
      });
      instance.joints.push(b2.createRevoluteJoint(
        world,
        instance.chassis.body,
        instance.wheels[i].body,
        {
          localAnchorA: randvertex,
          localAnchorB: vec2(0, 0),
          maxMotorTorque: torque,
          motorSpeed: -constants.motorSpeed,
          enableMotor: true,
          collideConnected: false,
        }
      ));
    }

    return instance;
  }

  function createChassis(world, vertexGenes, density) {
    let vertex_list = createChassisVertexList(vertexGenes);

    let chassis = {
      body: b2.createBody(world, {
        type: b2.dynamicBody,
        position: vec2(0.0, 4.0),
      }),
      vertex_list: vertex_list,
      triangles: [],
    };

    for (let i = 0; i < vertex_list.length; i++) {
      createChassisPart(chassis, vertex_list[i], vertex_list[(i + 1) % vertex_list.length], density);
    }

    return chassis;
  }


  function createChassisPart(chassis, vertex1, vertex2, density) {
    let vertex_list = [
      cloneVec2(vertex1),
      cloneVec2(vertex2),
      vec2(0, 0)
    ];
    let shape = b2.createPolygonShape(chassis.body, {
      vertices: vertex_list,
      density: density,
      friction: 10,
      restitution: 0.2,
      groupIndex: -1,
    });

    chassis.triangles.push({
      vertices: vertex_list,
      shape: shape,
      density: density,
    });
  }

  function createWheel(world, radius, density) {
    let body = b2.createBody(world, {
      type: b2.dynamicBody,
      position: vec2(0, 0),
    });
    let center = vec2(0, 0);
    let shape = b2.createCircleShape(body, {
      center: center,
      radius: radius,
      density: density,
      friction: 1,
      restitution: 0.2,
      groupIndex: -1,
    });

    return {
      body: body,
      shape: shape,
      center: center,
      radius: radius,
      density: density,
    };
  }


  /* -------------------------------------------------------------------------
   * car-schema/run.js
   * ------------------------------------------------------------------------- */


  const carRun = {
    getInitialState: getInitialState,
    updateState: updateState,
    getStatus: getStatus,
    calculateScore: calculateScore,
  };

  function getInitialState(world_def) {
    return {
      frames: 0,
      idle_timer: world_def.max_idle_timer,
      maxPositiony: 0,
      minPositiony: 0,
      maxPositionx: 0,
    };
  }

  function updateState(constants, worldConstruct, state) {
    if (state.idle_timer <= 0) {
      throw new Error("Already Dead");
    }
    if (state.maxPositionx > constants.finishLine) {
      throw new Error("already Finished");
    }

    // The idle timer resets on forward progress and drains while stalled.
    let position = getBodyPosition(worldConstruct.chassis);
    // check if car reached end of the path
    let nextState = {
      frames: state.frames + 1,
      maxPositionx: position.x > state.maxPositionx ? position.x : state.maxPositionx,
      maxPositiony: position.y > state.maxPositiony ? position.y : state.maxPositiony,
      minPositiony: position.y < state.minPositiony ? position.y : state.minPositiony
    };

    if (position.x > constants.finishLine) {
      nextState.idle_timer = state.idle_timer;
      return nextState;
    }

    if (position.x > state.maxPositionx + 0.02) {
      nextState.idle_timer = constants.max_idle_timer;
      return nextState;
    }
    nextState.idle_timer = state.idle_timer - 1;
    if (Math.abs(getBodyVelocity(worldConstruct.chassis).x) < 0.001) {
      nextState.idle_timer -= 5;
    }
    return nextState;
  }

  function getStatus(state, constants) {
    if (hasFailed(state, constants)) return -1;
    if (hasSuccess(state, constants)) return 1;
    return 0;
  }

  function hasFailed(state /*, constants */) {
    return state.idle_timer <= 0;
  }
  function hasSuccess(state, constants) {
    return state.maxPositionx > constants.finishLine;
  }

  function calculateScore(state, constants) {
    let avgspeed = (state.maxPositionx / state.frames) * constants.box2dfps;
    let position = state.maxPositionx;
    let score = position + avgspeed;
    return {
      v: score,
      s: avgspeed,
      x: position,
      y: state.maxPositiony,
      y2: state.minPositiony
    }
  }


  /* -------------------------------------------------------------------------
   * generation-config/selectFromAllParents.js
   * ------------------------------------------------------------------------- */

  function flatRankSelect(parents) {
    let totalParents = parents.length;
    let parentIndex = -1;
    for (let k = 0; k < totalParents; k++) {
      if (Math.random() <= 0.2) {
        parentIndex = k;
        break;
      }
    }
    if (parentIndex === -1) {
      parentIndex = Math.floor(Math.random() * totalParents);
    }
    return parentIndex;
  }


  /* -------------------------------------------------------------------------
   * generation-config/pickParent.js
   * ------------------------------------------------------------------------- */
  function pickParent(currentChoices, chooseId, key, valueIndex, geneIndex, parents, geneCount) {
    if (!currentChoices.has(chooseId)) {
      currentChoices.set(chooseId, initializePick(geneCount))
    }

    let state = currentChoices.get(chooseId);
    state.curparent = cw_chooseParent(state, geneIndex);
    return state.curparent;

    function cw_chooseParent(state, attributeIndex) {
      let curparent = state.curparent;
      let swapPoint1 = state.swapPoint1
      let swapPoint2 = state.swapPoint2
      if ((swapPoint1 === attributeIndex) || (swapPoint2 === attributeIndex)) {
        return curparent === 1 ? 0 : 1
      }
      return curparent
    }

    function initializePick(totalGenes) {
      let curparent = 0;
      if (!Number.isInteger(totalGenes) || totalGenes < 2) {
        return {
          curparent: curparent,
          swapPoint1: -1,
          swapPoint2: -1
        }
      }

      let swapPoint1 = Math.floor(Math.random() * totalGenes);
      let swapPoint2 = swapPoint1;
      while (swapPoint2 === swapPoint1) {
        swapPoint2 = Math.floor(Math.random() * totalGenes);
      }
      return {
        curparent: curparent,
        swapPoint1: swapPoint1,
        swapPoint2: swapPoint2
      }
    }
  }


  /* -------------------------------------------------------------------------
   * generation-config/generateRandom.js
   * ------------------------------------------------------------------------- */


  function generateRandom() {
    return Math.random();
  }


  /* -------------------------------------------------------------------------
   * generation-config/index.js
   * ------------------------------------------------------------------------- */

  const generationConfig = (function () {
    const carConstants = carConstruct.carConstants();
    const schema = carConstruct.generateSchema(carConstants);
    const constants = {
      generationSize: 20, schema: schema, championLength: 1,
      mutation_range: 1, gen_mutation: 0.05
    };
    let fn = function () {
      let currentChoices = new Map();
      return Object.assign({}, constants, {
        selectFromAllParents: flatRankSelect,
        generateRandom: generateRandom,
        pickParent: pickParent.bind(void 0, currentChoices),
      });
    };
    fn.constants = constants;
    return fn;
  })();


  /* -------------------------------------------------------------------------
   * machine-learning/genetic-algorithm/manage-round.js
   * ------------------------------------------------------------------------- */
  const manageRound = (function () {
    const create = createInstance;



    function generationZero(config) {
      let generationSize = config.generationSize,
        schema = config.schema;
      let cw_carGeneration = [];
      for (let k = 0; k < generationSize; k++) {
        let def = create.createGenerationZero(schema, function () {
          return Math.random()
        });
        def.bornGeneration = 0;
        def.index = k;
        cw_carGeneration.push(def);
      }
      return {
        counter: 0,
        generation: cw_carGeneration,
      };
    }

    function nextGeneration(
      previousState,
      scores,
      config
    ) {
      let champion_length = config.championLength,
        generationSize = config.generationSize,
        selectFromAllParents = config.selectFromAllParents;

      let newGeneration = new Array(generationSize);
      let newborn;
      for (let k = 0; k < champion_length; k++) {
        scores[k].def.is_elite = true;
        if (!Number.isFinite(scores[k].def.bornGeneration)) {
          scores[k].def.bornGeneration = previousState.counter;
        }
        scores[k].def.index = k;
        newGeneration[k] = scores[k].def;
      }
      let parentList = [];
      for (let k = champion_length; k < generationSize; k++) {
        let parent1 = selectFromAllParents(scores, parentList);
        let parent2 = parent1;
        while (parent2 === parent1) {
          parent2 = selectFromAllParents(scores, parentList, parent1);
        }
        let pair = [parent1, parent2]
        parentList.push(pair);
        newborn = makeChild(config, [scores[parent1].def, scores[parent2].def]);
        newborn = mutate(config, newborn);
        newborn.bornGeneration = previousState.counter + 1;
        newborn.is_elite = false;
        newborn.index = k;
        newGeneration[k] = newborn;
      }

      return {
        counter: previousState.counter + 1,
        generation: newGeneration,
      };
    }


    function makeChild(config, parents) {
      let schema = config.schema,
        pickParent = config.pickParent,
        generateRandom = config.generateRandom;
      return create.createCrossBreed(schema, parents, pickParent, generateRandom)
    }


    function mutate(config, parent) {
      let schema = config.schema,
        mutation_range = config.mutation_range,
        gen_mutation = config.gen_mutation,
        generateRandom = config.generateRandom;
      return create.createMutatedClone(
        schema,
        generateRandom,
        parent,
        Math.max(mutation_range),
        gen_mutation
      )
    }

    return { generationZero: generationZero, nextGeneration: nextGeneration };
  })();


  /* -------------------------------------------------------------------------
   * machine-learning/simulated-annealing/manage-round.js
   * ------------------------------------------------------------------------- */
  const manageRoundSA = (function () {
    const create = createInstance;



    function generationZero(config) {
      let oldStructure = create.createGenerationZero(
        config.schema, config.generateRandom
      );
      let newStructure = createStructure(config, 1, oldStructure);

      let k = 0;

      return {
        counter: 0,
        k: k,
        generation: [newStructure, oldStructure]
      }
    }

    function nextGeneration(previousState, scores, config) {
      let nextState = {
        k: (previousState.k + 1) % config.generationSize,
        counter: previousState.counter + (previousState.k + 1 === config.generationSize ? 1 : 0)
      };
      // gradually get closer to zero temperature (but never hit it)
      let oldDef = previousState.curDef || previousState.generation[1];
      let oldScore = previousState.score || scores[1].score.v;

      let newDef = previousState.generation[0];
      let newScore = scores[0].score.v;


      let temp = Math.exp(-nextState.counter / config.generationSize);

      let scoreDiff = newScore - oldScore;
      // If the next point is higher, change location
      if (scoreDiff > 0) {
        nextState.curDef = newDef;
        nextState.score = newScore;
        // Else we want to increase likelyhood of changing location as we get
      } else if (Math.random() > Math.exp(-scoreDiff / (nextState.k * temp))) {
        nextState.curDef = newDef;
        nextState.score = newScore;
      } else {
        nextState.curDef = oldDef;
        nextState.score = oldScore;
      }


      nextState.generation = [createStructure(config, temp, nextState.curDef)];

      return nextState;
    }


    function createStructure(config, mutation_range, parent) {
      let schema = config.schema,
        gen_mutation = 1,
        generateRandom = config.generateRandom;
      return create.createMutatedClone(
        schema,
        generateRandom,
        parent,
        mutation_range,
        gen_mutation
      )
    }

    return { generationZero: generationZero, nextGeneration: nextGeneration };
  })();


  /* -------------------------------------------------------------------------
   * ghost/car-to-ghost.js
   * ------------------------------------------------------------------------- */

  function ghost_get_frame(car) {
    let out = {
      chassis: ghost_get_chassis(car.chassis),
      wheels: [],
      pos: getBodyPosition(car.chassis)
    };

    for (let i = 0; i < car.wheels.length; i++) {
      out.wheels[i] = ghost_get_wheel(car.wheels[i]);
    }

    return out;
  }

  function ghost_get_chassis(c) {
    let gc = new Array(c.triangles.length);
    let transform = getBodyTransform(c);
    let angle = transform.angle || 0;
    let cos = Math.cos(angle);
    let sin = Math.sin(angle);

    for (let t = 0; t < c.triangles.length; t++) {
      let triangle = c.triangles[t];
      let vertices = triangle.vertices;
      let p = {
        vtx: new Array(vertices.length),
        num: vertices.length
      };

      for (let i = 0; i < vertices.length; i++) {
        p.vtx[i] = transformPointWithTrig(transform, vertices[i], cos, sin);
      }

      gc[t] = p;
    }

    return gc;
  }

  function ghost_get_wheel(w) {
    let gw = [];
    let transform = getBodyTransform(w);
    let angle = transform.angle || 0;

    gw.push({
      pos: w.center.x === 0 && w.center.y === 0
        ? cloneVec2(transform.position)
        : transformPointWithTrig(transform, w.center, Math.cos(angle), Math.sin(angle)),
      rad: w.radius,
      ang: angle
    });

    return gw;
  }


  /* -------------------------------------------------------------------------
   * ghost/index.js
   * ------------------------------------------------------------------------- */
  const ghost_fns = (function () {
    const enable_ghost = true;







    function ghost_create_replay() {
      if (!enable_ghost)
        return null;

      return {
        num_frames: 0,
        frames: [],
      }
    }

    function ghost_create_ghost() {
      if (!enable_ghost)
        return null;

      return {
        replay: null,
        frame: 0,
        dist: -100
      }
    }

    function ghost_reset_ghost(ghost) {
      if (!enable_ghost)
        return;
      if (ghost === null)
        return;
      ghost.frame = 0;
    }

    function ghost_pause(ghost) {
      if (ghost === null)
        return;
      ghost.old_frame = ghost.frame;
      ghost_reset_ghost(ghost);
    }

    function ghost_resume(ghost) {
      if (ghost === null)
        return;
      if (Number.isInteger(ghost.old_frame))
        ghost.frame = ghost.old_frame;
    }

    function ghost_get_position(ghost) {
      if (!enable_ghost)
        return;
      if (ghost === null)
        return;
      if (ghost.frame < 0)
        return;
      if (ghost.replay === null)
        return;
      let frame = ghost.replay.frames[ghost.frame];
      if (!frame) return;
      return frame.pos;
    }

    function ghost_compare_to_replay(replay, ghost, max) {
      if (!enable_ghost)
        return;
      if (ghost === null)
        return;
      if (replay === null)
        return;

      if (ghost.dist < max) {
        ghost.replay = replay;
        ghost.dist = max;
        ghost.frame = 0;
      }
    }

    function ghost_move_frame(ghost) {
      if (!enable_ghost)
        return;
      if (ghost === null)
        return;
      if (ghost.replay === null)
        return;
      if (ghost.replay.num_frames <= 0)
        return;
      ghost.frame++;
      if (ghost.frame >= ghost.replay.num_frames)
        ghost.frame = ghost.replay.num_frames - 1;
    }

    function ghost_add_replay_frame(replay, car) {
      if (!enable_ghost)
        return;
      if (replay === null)
        return;

      let frame = ghost_get_frame(car);
      replay.frames.push(frame);
      replay.num_frames++;
    }

    function ghost_draw_frame(ctx, ghost, camera) {
      let zoom = camera.zoom;
      if (!enable_ghost)
        return;
      if (ghost === null)
        return;
      if (ghost.frame < 0)
        return;
      if (ghost.replay === null)
        return;

      let frame = ghost.replay.frames[ghost.frame];
      if (!frame) return;

      // wheel style
      ctx.fillStyle = "#dfe8e7";
      ctx.strokeStyle = "#8fa4a3";
      ctx.lineWidth = 1 / zoom;

      for (let i = 0; i < frame.wheels.length; i++) {
        let wheelFrame = frame.wheels[i][0];
        ghost_draw_circle(ctx, wheelFrame.pos, wheelFrame.rad, wheelFrame.ang);
      }

      // chassis style
      ctx.strokeStyle = "#8fa4a3";
      ctx.fillStyle = "#dfe8e7";
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      for (let c = 0; c < frame.chassis.length; c++) {
        ghost_draw_poly(ctx, frame.chassis[c].vtx, frame.chassis[c].num);
      }
      ctx.fill();
      ctx.stroke();
    }

    function ghost_draw_poly(ctx, vtx, n_vtx) {
      ctx.moveTo(vtx[0].x, vtx[0].y);
      for (let i = 1; i < n_vtx; i++) {
        ctx.lineTo(vtx[i].x, vtx[i].y);
      }
      ctx.lineTo(vtx[0].x, vtx[0].y);
    }

    function ghost_draw_circle(ctx, center, radius, angle) {
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, TWO_PI, true);

      ctx.moveTo(center.x, center.y);
      ctx.lineTo(center.x + radius * Math.cos(angle), center.y + radius * Math.sin(angle));

      ctx.fill();
      ctx.stroke();
    }

    return {
      ghost_create_replay: ghost_create_replay, ghost_create_ghost: ghost_create_ghost,
      ghost_pause: ghost_pause, ghost_resume: ghost_resume,
      ghost_get_position: ghost_get_position, ghost_compare_to_replay: ghost_compare_to_replay,
      ghost_move_frame: ghost_move_frame, ghost_add_replay_frame: ghost_add_replay_frame,
      ghost_draw_frame: ghost_draw_frame, ghost_reset_ghost: ghost_reset_ghost
    };
  })();


  /* -------------------------------------------------------------------------
   * draw/draw-virtual-poly.js
   * ------------------------------------------------------------------------- */


  function cw_drawVirtualPoly(ctx, transform, cos, sin, vtx, n_vtx) {
    // set strokestyle and fillstyle before call
    // call beginPath before call

    let p0 = transformPointWithTrig(transform, vtx[0], cos, sin);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < n_vtx; i++) {
      let p = transformPointWithTrig(transform, vtx[i], cos, sin);
      ctx.lineTo(p.x, p.y);
    }
    ctx.lineTo(p0.x, p0.y);
  }

  function cw_drawWorldPoly(ctx, vtx, n_vtx) {
    let p0 = vtx[0];
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < n_vtx; i++) {
      let p = vtx[i];
      ctx.lineTo(p.x, p.y);
    }
    ctx.lineTo(p0.x, p0.y);
  }


  /* -------------------------------------------------------------------------
   * draw/draw-circle.js
   * ------------------------------------------------------------------------- */



  function cw_drawCircle(ctx, transform, center, radius, angle, color) {
    let p = center.x === 0 && center.y === 0
      ? transform.position
      : transformPoint(transform, center);
    ctx.fillStyle = color;

    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, TWO_PI, true);

    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + radius * Math.cos(angle), p.y + radius * Math.sin(angle));

    ctx.fill();
    ctx.stroke();
  }


  /* -------------------------------------------------------------------------
   * draw/draw-floor.js
   * ------------------------------------------------------------------------- */

  function cw_drawFloor(ctx, camera, cw_floorTiles) {
    let camera_x = camera.pos.x;
    let zoom = camera.zoom;
    ctx.strokeStyle = "#17212b";
    ctx.fillStyle = "#8d9a96";
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();

    let k;
    if (camera.pos.x - 10 > 0) {
      k = Math.floor((camera.pos.x - 10) / 1.5);
    } else {
      k = 0;
    }

    for (; k < cw_floorTiles.length; k++) {
      let b = cw_floorTiles[k];
      let shapePosition = b.worldVertices[0].x;
      if ((shapePosition > (camera_x - 5)) && (shapePosition < (camera_x + 10))) {
        cw_drawWorldPoly(ctx, b.worldVertices, b.worldVertices.length);
      }
      if (shapePosition > camera_x + 10) {
        break;
      }
    }
    ctx.fill();
    ctx.stroke();
  }


  /* -------------------------------------------------------------------------
   * draw/scatter-plot.js
   * ------------------------------------------------------------------------- */


  // Called when the Visualization API is loaded.


  /* -------------------------------------------------------------------------
   * draw/plot-graphs.js
   * ------------------------------------------------------------------------- */


  const graph_fns = {
    plotGraphs: function (graphElem, topScoresElem, scatterPlotElem, lastState, scores, config) {
      lastState = lastState || {};
      let generationSize = scores.length
      let graphcanvas = graphElem;
      let graphctx = get2dContext(graphcanvas, "score graph");
      let graphwidth = 400;
      let graphheight = 250;
      let nextState = cw_storeGraphScores(
        lastState, scores, generationSize
      );
      cw_clearGraphics(graphcanvas, graphctx, graphwidth, graphheight);
      cw_plotAverage(nextState, graphctx);
      cw_plotElite(nextState, graphctx);
      cw_plotTop(nextState, graphctx);
      cw_listTopScores(topScoresElem, nextState);
      return nextState;
    },
  };


  function cw_storeGraphScores(lastState, cw_carScores, generationSize) {
    return {
      cw_topScores: (lastState.cw_topScores || [])
        .concat([cw_carScores[0].score]),
      cw_graphAverage: (lastState.cw_graphAverage || []).concat([
        cw_average(cw_carScores, generationSize)
      ]),
      cw_graphElite: (lastState.cw_graphElite || []).concat([
        cw_eliteaverage(cw_carScores, generationSize)
      ]),
      cw_graphTop: (lastState.cw_graphTop || []).concat([
        cw_carScores[0].score.v
      ]),
    }
  }

  function cw_plotTop(state, graphctx) {
    let cw_graphTop = state.cw_graphTop;
    let graphsize = cw_graphTop.length;
    graphctx.strokeStyle = "#d94f45";
    graphctx.beginPath();
    graphctx.moveTo(0, 0);
    for (let k = 0; k < graphsize; k++) {
      graphctx.lineTo(400 * (k + 1) / graphsize, cw_graphTop[k]);
    }
    graphctx.stroke();
  }

  function cw_plotElite(state, graphctx) {
    let cw_graphElite = state.cw_graphElite;
    let graphsize = cw_graphElite.length;
    graphctx.strokeStyle = "#2f8a4c";
    graphctx.beginPath();
    graphctx.moveTo(0, 0);
    for (let k = 0; k < graphsize; k++) {
      graphctx.lineTo(400 * (k + 1) / graphsize, cw_graphElite[k]);
    }
    graphctx.stroke();
  }

  function cw_plotAverage(state, graphctx) {
    let cw_graphAverage = state.cw_graphAverage;
    let graphsize = cw_graphAverage.length;
    graphctx.strokeStyle = "#2563eb";
    graphctx.beginPath();
    graphctx.moveTo(0, 0);
    for (let k = 0; k < graphsize; k++) {
      graphctx.lineTo(400 * (k + 1) / graphsize, cw_graphAverage[k]);
    }
    graphctx.stroke();
  }


  function cw_eliteaverage(scores, generationSize) {
    let sum = 0;
    for (let k = 0; k < Math.floor(generationSize / 2); k++) {
      sum += scores[k].score.v;
    }
    return sum / Math.floor(generationSize / 2);
  }

  function cw_average(scores, generationSize) {
    let sum = 0;
    for (let k = 0; k < generationSize; k++) {
      sum += scores[k].score.v;
    }
    return sum / generationSize;
  }

  function cw_clearGraphics(graphcanvas, graphctx, graphwidth, graphheight) {
    graphctx.setTransform(1, 0, 0, 1, 0, 0);
    graphctx.clearRect(0, 0, graphcanvas.width, graphcanvas.height);
    graphctx.setTransform(1, 0, 0, -1, 0, graphheight);
    graphctx.lineWidth = 1;
    graphctx.strokeStyle = "#aec0c8";
    graphctx.beginPath();
    graphctx.moveTo(0, graphheight / 2);
    graphctx.lineTo(graphwidth, graphheight / 2);
    graphctx.moveTo(0, graphheight / 4);
    graphctx.lineTo(graphwidth, graphheight / 4);
    graphctx.moveTo(0, graphheight * 3 / 4);
    graphctx.lineTo(graphwidth, graphheight * 3 / 4);
    graphctx.stroke();
  }

  function cw_listTopScores(elem, state) {
    let cw_topScores = state.cw_topScores.slice().sort(function (a, b) {
      if (a.v === b.v) {
        return 0;
      }
      return a.v > b.v ? -1 : 1;
    });

    let fragment = document.createDocumentFragment();
    let title = document.createElement("strong");
    title.textContent = "Top Scores";
    fragment.appendChild(title);
    fragment.appendChild(document.createElement("br"));

    for (let k = 0; k < Math.min(10, cw_topScores.length); k++) {
      let topScore = cw_topScores[k];
      let n = "#" + (k + 1) + ":";
      let score = Math.round(topScore.v * 100) / 100;
      let distance = "d:" + Math.round(topScore.x * 100) / 100;
      let yrange = "h:" + Math.round(topScore.y2 * 100) / 100 + "/" + Math.round(topScore.y * 100) / 100 + "m";
      let gen = "(Gen " + cw_topScores[k].i + ")"

      fragment.appendChild(document.createTextNode([n, score, distance, yrange, gen].join(" ")));
      fragment.appendChild(document.createElement("br"));
    }
    elem.replaceChildren(fragment);
  }

  /* -------------------------------------------------------------------------
   * draw/draw-car.js
   * ------------------------------------------------------------------------- */




  function drawCar(car_constants, myCar, camera, ctx) {
    let camera_x = camera.pos.x;
    let zoom = camera.zoom;

    let wheelMinDensity = car_constants.wheelMinDensity
    let wheelDensityRange = car_constants.wheelDensityRange

    if (!myCar.alive) {
      return;
    }
    let myCarPos = myCar.getPosition();

    if (myCarPos.x < (camera_x - 5)) {
      // too far behind, don't draw
      return;
    }

    ctx.strokeStyle = "#24313a";
    ctx.lineWidth = 1 / zoom;

    let wheels = myCar.car.car.wheels;

    for (let i = 0; i < wheels.length; i++) {
      let wheel = wheels[i];
      let wheelTransform = getBodyTransform(wheel);
      let color = Math.round(255 - (255 * (wheel.density - wheelMinDensity)) / wheelDensityRange).toString();
      let rgbcolor = "rgb(" + color + "," + color + "," + color + ")";
      cw_drawCircle(ctx, wheelTransform, wheel.center, wheel.radius, wheelTransform.angle, rgbcolor);
    }

    if (myCar.is_elite) {
      ctx.strokeStyle = "#2563eb";
      ctx.fillStyle = "#dbeafe";
    } else {
      ctx.strokeStyle = "#d49718";
      ctx.fillStyle = "#f7e2a8";
    }
    ctx.beginPath();

    let chassis = myCar.car.car.chassis;
    let chassisTransform = getBodyTransform(chassis);
    let chassisAngle = chassisTransform.angle || 0;
    let chassisCos = Math.cos(chassisAngle);
    let chassisSin = Math.sin(chassisAngle);

    for (let t = 0; t < chassis.triangles.length; t++) {
      let triangle = chassis.triangles[t];
      cw_drawVirtualPoly(ctx, chassisTransform, chassisCos, chassisSin, triangle.vertices, triangle.vertices.length);
    }
    ctx.fill();
    ctx.stroke();
  }


  /* -------------------------------------------------------------------------
   * draw/draw-car-stats.js
   * ------------------------------------------------------------------------- */


  const run = carRun;

  /* ========================================================================= */
  /* === Car ================================================================= */
  const cw_Car = function () {
    this.__constructor.apply(this, arguments);
  }

  cw_Car.prototype.__constructor = function (car) {
    this.car = car;
    this.car_def = car.def;
    let car_def = this.car_def;
    let idleTimerBarElement = requireElementById("idle_timer" + car_def.index);
    let idleTimerText = idleTimerBarElement.nextElementSibling;
    if (!idleTimerText) {
      throw new Error("Missing idle timer label for car " + car_def.index);
    }

    this.frames = 0;
    this.alive = true;
    this.is_elite = car.def.is_elite;
    this.idleTimerBar = idleTimerBarElement.style;
    this.idleTimerText = idleTimerText;
    this.idleTimerText.textContent = car_def.index.toString();
    this.minimapmarker = requireElementById("bar" + car_def.index);
    this.lastIdleTimerWidth = null;
    this.lastMarkerLeft = null;

    if (this.is_elite) {
      this.idleTimerBar.backgroundColor = "#2563eb";
      this.minimapmarker.style.borderLeft = "1px solid #2563eb";
      this.minimapmarker.textContent = car_def.index.toString();
    } else {
      this.idleTimerBar.backgroundColor = "#d49718";
      this.minimapmarker.style.borderLeft = "1px solid #d49718";
      this.minimapmarker.textContent = car_def.index.toString();
    }

  }

  cw_Car.prototype.getPosition = function () {
    return getBodyPosition(this.car.car.chassis);
  }

  cw_Car.prototype.kill = function (currentRunner, constants) {
    this.minimapmarker.style.borderLeft = "1px solid #aeb8bd";
    let finishLine = currentRunner.scene.finishLine
    let max_idle_timer = constants.max_idle_timer;
    let status = run.getStatus(this.car.state, {
      finishLine: finishLine,
      max_idle_timer: max_idle_timer,
    })
    switch (status) {
      case 1: {
        this.idleTimerBar.width = "0";
        break
      }
      case -1: {
        this.idleTimerText.textContent = "\u2020";
        this.idleTimerBar.width = "0";
        break
      }
    }
    this.alive = false;

  }




  /* -------------------------------------------------------------------------
   * world/setup-scene.js
   * ------------------------------------------------------------------------- */


  /*
  
  world_def = {
    gravity: {x, y},
    doSleep: boolean,
    floorseed: string,
    tileDimensions,
    maxFloorTiles,
    mutable_floor: boolean
  }
  
  */

  function setupScene(world_def) {

    let world = b2.createWorld({
      gravity: world_def.gravity,
    });
    b2.enableWorldSleeping(world, world_def.doSleep);
    let floorTiles = cw_createFloor(
      world,
      world_def.floorseed,
      world_def.tileDimensions,
      world_def.maxFloorTiles,
      world_def.mutable_floor
    );

    let last_tile = floorTiles[
      floorTiles.length - 1
    ];
    let tile_position = last_tile.worldVertices[3];
    let finishLine = tile_position.x + 5;
    return {
      world: world,
      floorTiles: floorTiles,
      finishLine: finishLine
    };
  }

  function cw_createFloor(world, floorseed, dimensions, maxFloorTiles, mutable_floor) {
    let last_tile = null;
    let tile_position = vec2(-5, 0);
    let cw_floorTiles = [];
    Math.seedrandom(floorseed);
    for (let k = 0; k < maxFloorTiles; k++) {
      if (!mutable_floor) {
        // keep old impossible tracks if not using mutable floors
        last_tile = cw_createFloorTile(
          world, dimensions, tile_position, (Math.random() * 3 - 1.5) * 1.5 * k / maxFloorTiles
        );
      } else {
        // if path is mutable over races, create smoother tracks
        last_tile = cw_createFloorTile(
          world, dimensions, tile_position, (Math.random() * 3 - 1.5) * 1.2 * k / maxFloorTiles
        );
      }
      cw_floorTiles.push(last_tile);
      tile_position = cloneVec2(last_tile.worldVertices[3]);
    }
    return cw_floorTiles;
  }


  function cw_createFloorTile(world, dim, position, angle) {
    let body = b2.createBody(world, {
      position: position,
    });

    let coords = [
      vec2(0, 0),
      vec2(0, -dim.y),
      vec2(dim.x, -dim.y),
      vec2(dim.x, 0)
    ];

    let center = vec2(0, 0);

    let newcoords = cw_rotateFloorTile(coords, center, angle);

    let shape = b2.createPolygonShape(body, {
      vertices: newcoords,
      density: 0,
      friction: 0.5,
    });
    let transform = {
      position: cloneVec2(position),
      angle: 0,
    };
    let worldVertices = new Array(newcoords.length);
    for (let i = 0; i < newcoords.length; i++) {
      worldVertices[i] = transformPoint(transform, newcoords[i]);
    }
    return {
      body: body,
      shape: shape,
      vertices: newcoords,
      worldVertices: worldVertices,
    };
  }

  function cw_rotateFloorTile(coords, center, angle) {
    let cos = Math.cos(angle);
    let sin = Math.sin(angle);
    let rotated = new Array(coords.length);
    for (let i = 0; i < coords.length; i++) {
      let coord = coords[i];
      rotated[i] = {
        x: cos * (coord.x - center.x) - sin * (coord.y - center.y) + center.x,
        y: sin * (coord.x - center.x) + cos * (coord.y - center.y) + center.y,
      };
    }
    return rotated;
  }


  /* -------------------------------------------------------------------------
   * world/run.js
   * ------------------------------------------------------------------------- */
  function destroyCarBody(worldCar) {
    if (!worldCar) {
      return;
    }
    if (worldCar.joints) {
      for (let j = 0; j < worldCar.joints.length; j++) {
        b2.destroyJoint(worldCar.joints[j]);
      }
      worldCar.joints.length = 0;
    }
    if (worldCar.wheels) {
      for (let w = 0; w < worldCar.wheels.length; w++) {
        b2.destroyBody(worldCar.wheels[w].body);
      }
      worldCar.wheels.length = 0;
    }
    if (worldCar.chassis) {
      b2.destroyBody(worldCar.chassis.body);
      worldCar.chassis = null;
    }
  }

  function worldRun(world_def, defs, listeners) {
    if (world_def.mutable_floor) {
      // GHOST DISABLED
      world_def.floorseed = btoa(Math.seedrandom());
    }

    let normalizedDefs = normalizeGeneration(world_def.schema, defs);
    let scene = setupScene(world_def);
    world_def.finishLine = scene.finishLine;
    let destroyed = false;
    b2.step(scene.world, 1 / world_def.box2dfps, 4);
    let cars = new Array(normalizedDefs.length);
    for (let i = 0; i < normalizedDefs.length; i++) {
      cars[i] = {
        index: i,
        def: normalizedDefs[i],
        car: defToCar(normalizedDefs[i], scene.world, world_def),
        state: carRun.getInitialState(world_def)
      };
    }
    let alivecars = cars.slice();
    return {
      scene: scene,
      cars: cars,
      destroy: function () {
        if (destroyed) {
          return;
        }
        for (let i = 0; i < cars.length; i++) {
          destroyCarBody(cars[i].car);
        }
        alivecars.length = 0;
        b2.destroyWorld(scene.world);
        destroyed = true;
      },
      step: function () {
        if (destroyed) {
          throw new Error("world already destroyed");
        }
        if (alivecars.length === 0) {
          throw new Error("no more cars");
        }
        b2.step(scene.world, 1 / world_def.box2dfps, 4);
        listeners.preCarStep();
        let aliveCount = 0;
        for (let i = 0; i < alivecars.length; i++) {
          let car = alivecars[i];
          car.state = carRun.updateState(
            world_def, car.car, car.state
          );
          let status = carRun.getStatus(car.state, world_def);
          listeners.carStep(car);
          if (status === 0) {
            alivecars[aliveCount++] = car;
            continue;
          }
          car.score = carRun.calculateScore(car.state, world_def);
          listeners.carDeath(car);

          destroyCarBody(car.car);
        }
        alivecars.length = aliveCount;
        if (alivecars.length === 0) {
          listeners.generationEnd(cars);
        }
      }
    }

  }


  /* -------------------------------------------------------------------------
   * index.js (main entry)
   * ------------------------------------------------------------------------- */
  // Global Vars




  const plot_graphs = graph_fns.plotGraphs;

  const ghost_draw_frame = ghost_fns.ghost_draw_frame;
  const ghost_create_ghost = ghost_fns.ghost_create_ghost;
  const ghost_add_replay_frame = ghost_fns.ghost_add_replay_frame;
  const ghost_compare_to_replay = ghost_fns.ghost_compare_to_replay;
  const ghost_get_position = ghost_fns.ghost_get_position;
  const ghost_move_frame = ghost_fns.ghost_move_frame;
  const ghost_reset_ghost = ghost_fns.ghost_reset_ghost
  const ghost_pause = ghost_fns.ghost_pause;
  const ghost_resume = ghost_fns.ghost_resume;
  const ghost_create_replay = ghost_fns.ghost_create_replay;

  let ghost;
  const carMap = new Map();

  let doDraw = true;
  let cw_paused = false;
  let cw_animationFrameId = null;
  let cw_runningInterval = null;

  const box2dfps = 60;
  const screenfps = 60;
  const skipTicks = Math.round(1000 / box2dfps);
  const maxFrameSkip = skipTicks * 2;

  const canvas = requireElementById("mainbox");
  const ctx = get2dContext(canvas, "main simulation");
  const generationMeter = requireElementById("generation");
  const populationMeter = requireElementById("population");
  const carsElem = requireElementById("cars");
  const topScoresElem = requireElementById("topscores");
  const graphCanvas = requireElementById("graphcanvas");
  const seedInput = requireElementById("newseed");
  const idleTimerElem = requireElementById("idle_timer");
  const parentageSummaryElem = requireElementById("parentage-summary");
  const parentageListElem = requireElementById("parentage-list");

  const camera = {
    speed: 0.05,
    pos: {
      x: 0, y: 2
    },
    target: -1,
    zoom: 70
  }

  const minimapcamera = requireElementById("minimapcamera").style;
  const minimapholder = requireElementById("minimapholder");

  const minimapcanvas = requireElementById("minimap");
  const minimapctx = get2dContext(minimapcanvas, "minimap");
  const minimapscale = 3;
  let minimapfogdistance = 0;
  let lastFloorSeed = null;
  const fogdistance = requireElementById("minimapfog").style;


  const carConstants = carConstruct.carConstants();


  const max_idle_timer = box2dfps * 10;

  let cw_ghostReplayInterval = null;
  const STORAGE_KEYS = {
    savedGeneration: "cw_savedGeneration",
    genCounter: "cw_genCounter",
    ghost: "cw_ghost",
    topScores: "cw_topScores",
    floorSeed: "cw_floorSeed",
  };

  const distanceMeter = requireElementById("distancemeter");
  const heightMeter = requireElementById("heightmeter");
  let lastDistanceDisplay = null;
  let lastHeightDisplay = null;
  let lastMinimapCameraLeft = null;
  let lastMinimapCameraTop = null;
  let lastParentageSignature = null;

  let leaderPosition = {
    x: 0, y: 0
  }

  minimapcamera.width = 12 * minimapscale + "px";
  minimapcamera.height = 6 * minimapscale + "px";


  // ======= WORLD STATE ======


  const world_def = {
    gravity: vec2(0.0, -9.81),
    doSleep: true,
    floorseed: btoa(Math.seedrandom()),
    tileDimensions: vec2(1.5, 0.15),
    maxFloorTiles: 200,
    mutable_floor: false,
    box2dfps: box2dfps,
    motorSpeed: 20,
    max_idle_timer: max_idle_timer,
    schema: generationConfig.constants.schema
  }

  let cw_deadCars;
  let graphState = {
    cw_topScores: [],
    cw_graphAverage: [],
    cw_graphElite: [],
    cw_graphTop: [],
  };

  function resetGraphState() {
    graphState = {
      cw_topScores: [],
      cw_graphAverage: [],
      cw_graphElite: [],
      cw_graphTop: [],
    };
  }



  // ==========================

  let generationState;

  // ======== Activity State ====
  let currentRunner;
  let loops = 0;
  let nextGameTick = Date.now();

  function destroyCurrentRunner() {
    if (currentRunner && typeof currentRunner.destroy === "function") {
      currentRunner.destroy();
    }
    currentRunner = null;
  }

  function showDistance(distance, height) {
    if (distance !== lastDistanceDisplay) {
      distanceMeter.textContent = distance + " meters";
      lastDistanceDisplay = distance;
    }
    if (height !== lastHeightDisplay) {
      heightMeter.textContent = height + " meters";
      lastHeightDisplay = height;
    }
    if (distance > minimapfogdistance) {
      fogdistance.width = Math.max(0, 800 - Math.round(distance + 15) * minimapscale) + "px";
      minimapfogdistance = distance;
    }
  }

  function formatShortId(id) {
    if (typeof id !== "string" || id.length === 0) {
      return "Unknown";
    }
    return id.slice(0, 8).toUpperCase();
  }

  function formatGenerationLabel(generation) {
    return Number.isFinite(generation) ? "G" + generation : "G?";
  }

  function formatCarLabel(index) {
    return Number.isInteger(index) ? "Car " + index : "Car ?";
  }

  function getParentageCarInfo() {
    if (!currentRunner) {
      return null;
    }
    if (camera.target !== -1 && carMap.has(camera.target)) {
      return camera.target;
    }

    let leaderIndex = Number.isInteger(leaderPosition.leader) ? leaderPosition.leader : 0;
    let leaderCar = currentRunner.cars[leaderIndex];
    if (leaderCar && carMap.has(leaderCar)) {
      return leaderCar;
    }

    let bestCar = null;
    let bestX = -Infinity;
    carMap.forEach(function (cwCar, carInfo) {
      if (!cwCar.alive) {
        return;
      }
      let position = cwCar.getPosition();
      if (position.x > bestX) {
        bestX = position.x;
        bestCar = carInfo;
      }
    });
    return bestCar;
  }

  function getParentageSignature(carInfo, focusLabel) {
    let generation = generationState ? generationState.counter : "?";
    if (!carInfo) {
      return "none|" + generation;
    }
    let def = carInfo.def || {};
    return [
      focusLabel,
      carInfo.index,
      def.id || "",
      Number.isFinite(def.bornGeneration) ? def.bornGeneration : "?",
      generation
    ].join("|");
  }

  function appendParentageFact(label, value) {
    let fact = document.createElement("div");
    let name = document.createElement("span");
    let data = document.createElement("strong");
    fact.className = "parentage-fact";
    name.textContent = label;
    data.textContent = value;
    fact.appendChild(name);
    fact.appendChild(data);
    parentageSummaryElem.appendChild(fact);
  }

  function createParentageRow(branch, id, meta, depth, founding) {
    let row = document.createElement("li");
    let marker = document.createElement("span");
    let body = document.createElement("span");
    let idElem = document.createElement("span");
    let metaElem = document.createElement("span");

    row.className = founding ? "parentage-row founding" : "parentage-row";
    row.style.setProperty("--depth", Math.min(depth, 6).toString());
    marker.className = "parentage-branch";
    marker.textContent = branch;
    idElem.className = "parentage-id";
    idElem.textContent = id;
    metaElem.className = "parentage-meta";
    metaElem.textContent = meta;

    body.appendChild(idElem);
    body.appendChild(metaElem);
    row.appendChild(marker);
    row.appendChild(body);
    return row;
  }

  function describeParentNode(parent) {
    let details = [];
    if (Number.isInteger(parent.index)) {
      details.push(formatCarLabel(parent.index));
    }
    if (Number.isFinite(parent.bornGeneration)) {
      details.push("born " + formatGenerationLabel(parent.bornGeneration));
    }
    if (parent.isElite === true || parent.is_elite === true) {
      details.push("elite");
    }
    return details.length > 0 ? details.join(" / ") : "Recorded parent";
  }

  function appendParentageRows(ancestry, path, depth, state) {
    if (!Array.isArray(ancestry)) {
      return;
    }
    for (let i = 0; i < ancestry.length; i++) {
      if (state.count >= state.limit) {
        state.truncated = true;
        return;
      }
      let parent = ancestry[i] || {};
      let nextPath = path.concat(i + 1);
      parentageListElem.appendChild(createParentageRow(
        "P" + nextPath.join("."),
        formatShortId(parent.id),
        describeParentNode(parent),
        depth,
        false
      ));
      state.count++;
      appendParentageRows(parent.ancestry, nextPath, depth + 1, state);
    }
  }

  function renderParentagePanel() {
    let carInfo = getParentageCarInfo();
    let focusLabel = (carInfo && camera.target !== -1 && camera.target === carInfo) ? "Selected" : "Leader";
    let signature = getParentageSignature(carInfo, focusLabel);
    if (signature === lastParentageSignature) {
      return;
    }
    lastParentageSignature = signature;
    parentageSummaryElem.textContent = "";
    parentageListElem.textContent = "";

    if (!carInfo) {
      appendParentageFact("Focus", "No car");
      appendParentageFact("Race", generationState ? formatGenerationLabel(generationState.counter) : "G?");
      parentageListElem.appendChild(createParentageRow("Base", "No active car", "Population empty", 0, true));
      return;
    }

    let def = carInfo.def || {};
    appendParentageFact("Focus", focusLabel + " " + formatCarLabel(carInfo.index));
    appendParentageFact("Race", generationState ? formatGenerationLabel(generationState.counter) : "G?");
    appendParentageFact("Born", formatGenerationLabel(def.bornGeneration));
    appendParentageFact("ID", formatShortId(def.id));

    let ancestry = Array.isArray(def.ancestry) ? def.ancestry : [];
    if (ancestry.length === 0) {
      parentageListElem.appendChild(createParentageRow("Base", "Founding vehicle", "No recorded parents", 0, true));
      return;
    }

    let state = { count: 0, limit: 28, truncated: false };
    appendParentageRows(ancestry, [], 0, state);
    if (state.truncated) {
      parentageListElem.appendChild(createParentageRow("...", "Earlier ancestors", "Hidden after " + state.limit + " rows", 0, true));
    }
  }



  /* === END Car ============================================================= */
  /* ========================================================================= */


  /* ========================================================================= */
  /* ==== Generation ========================================================= */

  function cw_generationZero() {

    generationState = manageRound.generationZero(generationConfig());
  }

  function resetCarUI() {
    cw_deadCars = 0;
    leaderPosition = {
      x: 0, y: 0
    };
    generationMeter.textContent = generationState.counter.toString();
    carsElem.textContent = "";
    populationMeter.textContent = generationConfig.constants.generationSize.toString();
    lastParentageSignature = null;
    renderParentagePanel();
  }

  /* ==== END Genration ====================================================== */
  /* ========================================================================= */

  /* ========================================================================= */
  /* ==== Drawing ============================================================ */

  function cw_drawScreen() {
    let floorTiles = currentRunner.scene.floorTiles;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    cw_setCameraPosition();
    let camera_x = camera.pos.x;
    let camera_y = camera.pos.y;
    let zoom = camera.zoom;
    ctx.translate(200 - (camera_x * zoom), 200 + (camera_y * zoom));
    ctx.scale(zoom, -zoom);
    cw_drawFloor(ctx, camera, floorTiles);
    ghost_draw_frame(ctx, ghost, camera);
    cw_drawCars();
    ctx.restore();
  }

  function cw_minimapCamera() {
    let camera_x = camera.pos.x
    let camera_y = camera.pos.y
    let left = Math.round((2 + camera_x) * minimapscale) + "px";
    let top = Math.round((31 - camera_y) * minimapscale) + "px";
    if (left !== lastMinimapCameraLeft) {
      minimapcamera.left = left;
      lastMinimapCameraLeft = left;
    }
    if (top !== lastMinimapCameraTop) {
      minimapcamera.top = top;
      lastMinimapCameraTop = top;
    }
  }

  function cw_setCameraTarget(k) {
    if (k === -1) {
      camera.target = -1;
      renderParentagePanel();
      return;
    }
    // k can be a numeric index from the HTML onclick or a car info object
    if (typeof k === "number" && currentRunner) {
      let carInfo = currentRunner.cars[k];
      if (carInfo && carMap.has(carInfo)) {
        camera.target = carInfo;
      } else {
        camera.target = -1;
      }
    } else {
      camera.target = k;
    }
    renderParentagePanel();
  }

  function cw_setCameraPosition() {
    let cameraTargetPosition
    if (camera.target !== -1 && carMap.has(camera.target)) {
      cameraTargetPosition = carMap.get(camera.target).getPosition();
    } else {
      camera.target = -1;
      cameraTargetPosition = leaderPosition;
    }
    let diff_y = camera.pos.y - cameraTargetPosition.y;
    let diff_x = camera.pos.x - cameraTargetPosition.x;
    camera.pos.y -= camera.speed * diff_y;
    camera.pos.x -= camera.speed * diff_x;
    cw_minimapCamera();
  }

  function cw_drawGhostReplay() {
    let floorTiles = currentRunner.scene.floorTiles;
    let carPosition = ghost_get_position(ghost);
    if (!carPosition) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      cw_setCameraPosition();
      let zoom = camera.zoom;
      ctx.translate(200 - (camera.pos.x * zoom), 200 + (camera.pos.y * zoom));
      ctx.scale(zoom, -zoom);
      cw_drawFloor(ctx, camera, floorTiles);
      ctx.restore();
      return;
    }
    camera.pos.x = carPosition.x;
    camera.pos.y = carPosition.y;
    cw_minimapCamera();
    showDistance(
      Math.round(carPosition.x * 100) / 100,
      Math.round(carPosition.y * 100) / 100
    );
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(
      200 - (carPosition.x * camera.zoom),
      200 + (carPosition.y * camera.zoom)
    );
    ctx.scale(camera.zoom, -camera.zoom);
    ghost_draw_frame(ctx, ghost, camera);
    ghost_move_frame(ghost);
    cw_drawFloor(ctx, camera, floorTiles);
    ctx.restore();
  }


  function cw_drawCars() {
    let cars = currentRunner.cars;
    for (let k = cars.length - 1; k >= 0; k--) {
      let myCar = carMap.get(cars[k]);
      if (myCar) {
        drawCar(carConstants, myCar, camera, ctx)
      }
    }
  }

  function toggleDisplay() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (doDraw) {
      doDraw = false;
      cw_stopSimulation();
      cw_runningInterval = setInterval(function () {
        let time = performance.now() + (1000 / screenfps);
        while (time > performance.now()) {
          simulationStep();
        }
      }, 1);
    } else {
      doDraw = true;
      clearInterval(cw_runningInterval);
      cw_runningInterval = null;
      cw_startSimulation();
    }
  }

  function cw_drawMiniMap() {
    let floorTiles = currentRunner.scene.floorTiles;
    let last_tile = null;
    let tile_position = vec2(-5, 0);
    let floorChanged = (lastFloorSeed !== world_def.floorseed);
    lastFloorSeed = world_def.floorseed;
    if (floorChanged) {
      minimapfogdistance = 0;
      fogdistance.width = "800px";
    }
    minimapctx.clearRect(0, 0, minimapcanvas.width, minimapcanvas.height);
    minimapctx.strokeStyle = "#2563eb";
    minimapctx.beginPath();
    minimapctx.moveTo(0, 35 * minimapscale);
    for (let k = 0; k < floorTiles.length; k++) {
      last_tile = floorTiles[k];
      tile_position = last_tile.worldVertices[3];
      minimapctx.lineTo((tile_position.x + 5) * minimapscale, (-tile_position.y + 35) * minimapscale);
    }
    minimapctx.stroke();
  }

  /* ==== END Drawing ======================================================== */
  /* ========================================================================= */
  const uiListeners = {
    preCarStep: function () {
      ghost_move_frame(ghost);
    },
    carStep(car) {
      updateCarUI(car);
    },
    carDeath(carInfo) {

      let k = carInfo.index;

      let car = carInfo.car, score = carInfo.score;
      let cwCar = carMap.get(carInfo);
      cwCar.kill(currentRunner, world_def);

      // refocus camera to leader on death
      if (camera.target === carInfo) {
        cw_setCameraTarget(-1);
      }

      ghost_compare_to_replay(cwCar.replay, ghost, score.v);
      carMap.delete(carInfo);

      score.i = generationState.counter;

      cw_deadCars++;
      let generationSize = generationConfig.constants.generationSize;
      populationMeter.textContent = (generationSize - cw_deadCars).toString();

      if (leaderPosition.leader === k) {
        // leader is dead, find new leader
        cw_findLeader();
      }
      renderParentagePanel();
    },
    generationEnd(results) {
      cleanupRound(results);
      return cw_newRound(results);
    }
  }

  function simulationStep() {
    currentRunner.step();
    showDistance(
      Math.round(leaderPosition.x * 100) / 100,
      Math.round(leaderPosition.y * 100) / 100
    );
  }

  function gameLoop() {
    loops = 0;
    while (!cw_paused && Date.now() > nextGameTick && loops < maxFrameSkip) {
      nextGameTick += skipTicks;
      loops++;
    }
    simulationStep();
    cw_drawScreen();

    if (!cw_paused) cw_animationFrameId = window.requestAnimationFrame(gameLoop);
  }

  function updateCarUI(carInfo) {
    let k = carInfo.index;
    let car = carMap.get(carInfo);
    let position = car.getPosition();

    ghost_add_replay_frame(car.replay, car.car.car);
    let markerLeft = Math.round((position.x + 5) * minimapscale) + "px";
    if (markerLeft !== car.lastMarkerLeft) {
      car.minimapmarker.style.left = markerLeft;
      car.lastMarkerLeft = markerLeft;
    }
    let idleTimerWidth = Math.round((car.car.state.idle_timer / max_idle_timer) * 100) + "%";
    if (idleTimerWidth !== car.lastIdleTimerWidth) {
      car.idleTimerBar.width = idleTimerWidth;
      car.lastIdleTimerWidth = idleTimerWidth;
    }
    if (position.x > leaderPosition.x) {
      leaderPosition = position;
      leaderPosition.leader = k;
      if (camera.target === -1) {
        renderParentagePanel();
      }
    }
  }

  function cw_findLeader() {
    let lead = 0;
    carMap.forEach(function(cwCar, carInfo) {
      if (!cwCar.alive) {
        return;
      }
      let position = cwCar.getPosition();
      if (position.x > lead) {
        lead = position.x;
        leaderPosition = position;
        leaderPosition.leader = carInfo.index;
      }
    });
  }

  function fastForward() {
    let gen = generationState.counter;
    while (gen === generationState.counter) {
      currentRunner.step();
    }
  }

  function cleanupRound(results) {

    results.sort(function (a, b) {
      if (a.score.v > b.score.v) {
        return -1
      } else {
        return 1
      }
    })
    graphState = plot_graphs(
      graphCanvas,
      topScoresElem,
      null,
      graphState,
      results
    );
  }

  function cw_newRound(results) {
    destroyCurrentRunner();
    camera.pos.x = 0;
    camera.pos.y = 2;
    cw_setCameraTarget(-1);

    // Reset the Math.random seed to true randomness before generating the next generation.
    // If we don't do this, the mutations will use the exact same deterministic pseudorandom
    // sequence that the physics engine used for the floor, resulting in exact identical clones
    // every generation if the parents happen to have the same scores.
    Math.seedrandom();

    generationState = manageRound.nextGeneration(
      generationState, results, generationConfig()
    );
    if (world_def.mutable_floor) {
      ghost = null;
      world_def.floorseed = btoa(Math.seedrandom());
    } else {
      ghost_reset_ghost(ghost);
    }
    currentRunner = worldRun(world_def, generationState.generation, uiListeners);
    setupCarUI();
    cw_drawMiniMap();
    resetCarUI();
  }

  function cw_startSimulation() {
    if (cw_animationFrameId !== null) {
      return;
    }
    cw_paused = false;
    nextGameTick = Date.now();
    cw_animationFrameId = window.requestAnimationFrame(gameLoop);
  }

  function cw_stopSimulation() {
    cw_paused = true;
    if (cw_animationFrameId !== null) {
      window.cancelAnimationFrame(cw_animationFrameId);
      cw_animationFrameId = null;
    }
    if (cw_runningInterval !== null) {
      clearInterval(cw_runningInterval);
      cw_runningInterval = null;
    }
  }

  function cw_clearPopulationWorld() {
    carMap.forEach(function (car) {
      car.kill(currentRunner, world_def);
    });
    carMap.clear();
  }

  function cw_resetPopulationUI() {
    generationMeter.textContent = "";
    carsElem.textContent = "";
    topScoresElem.textContent = "";
    let _gc = graphCanvas;
    cw_clearGraphics(_gc, get2dContext(_gc, "score graph"), 400, 250);
    resetGraphState();
    lastParentageSignature = null;
    renderParentagePanel();
  }

  function cw_resetWorld() {
    doDraw = true;
    cw_stopSimulation();
    world_def.floorseed = seedInput.value;
    cw_clearPopulationWorld();
    destroyCurrentRunner();
    cw_resetPopulationUI();

    Math.seedrandom();
    cw_generationZero();
    currentRunner = worldRun(
      world_def, generationState.generation, uiListeners
    );

    ghost = ghost_create_ghost();
    resetCarUI();
    setupCarUI()
    cw_drawMiniMap();

    cw_startSimulation();
  }

  function setupCarUI() {
    for (let i = 0; i < currentRunner.cars.length; i++) {
      let carInfo = currentRunner.cars[i];
      let car = new cw_Car(carInfo, carMap);
      carMap.set(carInfo, car);
      car.replay = ghost_create_replay();
      ghost_add_replay_frame(car.replay, car.car.car);
    }
    lastParentageSignature = null;
    renderParentagePanel();
  }

  requireElementById("fast-forward").addEventListener("click", fastForward);
  requireElementById("save-progress").addEventListener("click", saveProgress);
  requireElementById("restore-progress").addEventListener("click", restoreProgress);
  requireElementById("toggle-display").addEventListener("click", toggleDisplay);

  requireElementById("new-population").addEventListener("click", function () {
    doDraw = true;
    cw_stopSimulation();
    cw_clearPopulationWorld();
    destroyCurrentRunner();
    cw_resetPopulationUI();
    Math.seedrandom();
    cw_generationZero();
    ghost = ghost_create_ghost();
    currentRunner = worldRun(world_def, generationState.generation, uiListeners);
    setupCarUI();
    cw_drawMiniMap();
    resetCarUI();
    cw_startSimulation();
  });

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEYS.savedGeneration, JSON.stringify(generationState.generation));
      localStorage.setItem(STORAGE_KEYS.genCounter, generationState.counter.toString());
      localStorage.setItem(STORAGE_KEYS.ghost, JSON.stringify(ghost));
      localStorage.setItem(STORAGE_KEYS.topScores, JSON.stringify(graphState.cw_topScores));
      localStorage.setItem(STORAGE_KEYS.floorSeed, world_def.floorseed);
    } catch (error) {
      alert("Progress could not be saved. Browser storage may be full or unavailable.");
    }
  }

  function restoreProgress() {
    let savedGeneration = localStorage.getItem(STORAGE_KEYS.savedGeneration);
    if (savedGeneration === null) {
      alert("No saved progress found");
      return;
    }

    let restoredGeneration;
    let restoredCounter;
    let restoredGhost;
    let restoredTopScores;
    let restoredFloorSeed;
    try {
      restoredGeneration = normalizeGeneration(
        generationConfig.constants.schema,
        JSON.parse(savedGeneration)
      );
      restoredCounter = Math.max(0, parseFiniteInteger(localStorage.getItem(STORAGE_KEYS.genCounter), 0));
      restoredGhost = JSON.parse(localStorage.getItem(STORAGE_KEYS.ghost) || "null");
      restoredTopScores = JSON.parse(localStorage.getItem(STORAGE_KEYS.topScores) || "[]");
      if (restoredGhost !== null && typeof restoredGhost !== "object") {
        restoredGhost = null;
      }
      if (!Array.isArray(restoredTopScores)) {
        restoredTopScores = [];
      }
      restoredFloorSeed = localStorage.getItem(STORAGE_KEYS.floorSeed) || world_def.floorseed;
    } catch (error) {
      alert("Saved progress could not be restored");
      return;
    }

    doDraw = true;
    cw_stopSimulation();
    cw_clearPopulationWorld();
    destroyCurrentRunner();
    generationState.generation = restoredGeneration;
    generationState.counter = restoredCounter;
    ghost = restoredGhost;
    graphState.cw_topScores = restoredTopScores;
    world_def.floorseed = restoredFloorSeed;
    seedInput.value = world_def.floorseed;

    currentRunner = worldRun(world_def, generationState.generation, uiListeners);
    setupCarUI();
    cw_drawMiniMap();
    Math.seedrandom();

    resetCarUI();
    cw_startSimulation();
  }

  requireElementById("confirm-reset").addEventListener("click", cw_confirmResetWorld);

  function cw_confirmResetWorld() {
    if (confirm('Really reset world?')) {
      cw_resetWorld();
    }
  }

  // ghost replay stuff


  function cw_pauseSimulation() {
    cw_stopSimulation();
    ghost_pause(ghost);
  }

  function cw_resumeSimulation() {
    ghost_resume(ghost);
    cw_startSimulation();
  }

  function cw_startGhostReplay() {
    if (cw_ghostReplayInterval !== null) {
      return;
    }
    if (!doDraw) {
      toggleDisplay();
    }
    cw_pauseSimulation();
    cw_ghostReplayInterval = setInterval(cw_drawGhostReplay, Math.round(1000 / screenfps));
  }

  function cw_stopGhostReplay() {
    if (cw_ghostReplayInterval === null) {
      return;
    }
    clearInterval(cw_ghostReplayInterval);
    cw_ghostReplayInterval = null;
    cw_findLeader();
    camera.pos.x = leaderPosition.x;
    camera.pos.y = leaderPosition.y;
    cw_resumeSimulation();
  }

  requireElementById("toggle-ghost").addEventListener("click", function (event) {
    cw_toggleGhostReplay(event.currentTarget);
  });

  function cw_toggleGhostReplay(button) {
    if (cw_ghostReplayInterval === null) {
      cw_startGhostReplay();
      button.value = "Resume simulation";
    } else {
      cw_stopGhostReplay();
      button.value = "View top replay";
    }
  }
  // ghost replay stuff END

  // initial stuff, only called once (hopefully)
  function cw_init() {
    // clone silver dot and idle timer bar
    let mmm = requireNamedElement("minimapmarker");
    let idleTimerBarTemplate = requireNamedElement("idle_timer_bar");
    let generationSize = generationConfig.constants.generationSize;

    for (let k = 0; k < generationSize; k++) {

      // minimap markers
      let newbar = mmm.cloneNode(true);
      newbar.id = "bar" + k;
      newbar.style.paddingTop = k * 9 + "px";
      minimapholder.appendChild(newbar);

      // idle timer bars
      let newIdleTimer = idleTimerBarTemplate.cloneNode(true);
      newIdleTimer.getElementsByTagName("DIV")[0].id = "idle_timer" + k;
      newIdleTimer.car_index = k;
      idleTimerElem.appendChild(newIdleTimer);
    }
    mmm.parentNode.removeChild(mmm);
    idleTimerBarTemplate.parentNode.removeChild(idleTimerBarTemplate);
    world_def.floorseed = btoa(Math.seedrandom());
    cw_generationZero();
    ghost = ghost_create_ghost();
    resetCarUI();
    currentRunner = worldRun(world_def, generationState.generation, uiListeners);
    setupCarUI();
    cw_drawMiniMap();
    cw_startSimulation();

  }

  function getRelativeCoords(event, element) {
    let rect = element.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  minimapholder.addEventListener("click", function (event) {
    let coords = getRelativeCoords(event, minimapholder);
    let closest = null;
    let maxX = -Infinity;
    carMap.forEach(function (cwCar) {
      let pos = cwCar.getPosition();
      let dist = Math.abs(((pos.x + 6) * minimapscale) - coords.x);
      if (!closest || dist < closest.dist) {
        closest = {
          value: cwCar.car,
          dist: dist,
          x: pos.x
        };
      }
      if (pos.x > maxX) {
        maxX = pos.x;
      }
    });

    if (!closest) {
      return;
    }

    if (closest.x === maxX) { // focus on leader again
      cw_setCameraTarget(-1);
    } else {
      cw_setCameraTarget(closest.value);
    }
  });


  requireElementById("mutationrate").addEventListener("change", function (event) {
    cw_setMutation(event.currentTarget.value);
  });

  requireElementById("mutationsize").addEventListener("change", function (event) {
    cw_setMutationRange(event.currentTarget.value);
  });

  requireElementById("floor").addEventListener("change", function (event) {
    cw_setMutableFloor(event.currentTarget.value);
  });

  requireElementById("gravity").addEventListener("change", function (event) {
    cw_setGravity(event.currentTarget.value);
  });

  requireElementById("elitesize").addEventListener("change", function (event) {
    cw_setEliteSize(event.currentTarget.value);
  });

  function cw_setMutation(mutation) {
    generationConfig.constants.gen_mutation = clamp(
      parseFiniteFloat(mutation, generationConfig.constants.gen_mutation),
      0,
      1
    );
  }

  function cw_setMutationRange(range) {
    generationConfig.constants.mutation_range = clamp(
      parseFiniteFloat(range, generationConfig.constants.mutation_range),
      0,
      1
    );
  }

  function cw_setMutableFloor(choice) {
    world_def.mutable_floor = choice === "1";
  }

  function cw_setGravity(choice) {
    let gravity = Math.max(0, parseFiniteFloat(choice, -world_def.gravity.y));
    world_def.gravity = vec2(0.0, -gravity);
    let world = currentRunner.scene.world;
    // CHECK GRAVITY CHANGES
    if (b2.getWorldGravity(world).y !== world_def.gravity.y) {
      b2.setWorldGravity(world, world_def.gravity);
    }
  }

  function cw_setEliteSize(clones) {
    generationConfig.constants.championLength = clamp(
      parseFiniteInteger(clones, generationConfig.constants.championLength),
      1,
      generationConfig.constants.generationSize
    );
  }

// Expose to global scope for inline onclick handlers in index.html
  window.cw_setCameraTarget = cw_setCameraTarget;

  cw_init();


})();
