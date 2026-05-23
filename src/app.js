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
  const DEG_TO_RAD = Math.PI / 180;
  const RAD_TO_DEG = 180 / Math.PI;
  const terrainCore = window.SmartCarsTerrain;
  const scoringCore = window.SmartCarsScoring;
  const geneticsCore = window.SmartCarsGenetics;
  const renderCore = window.SmartCarsRender;
  const simulationCore = window.SmartCarsSimulation;
  const uiCore = window.SmartCarsUI;
  if (!terrainCore || !scoringCore || !geneticsCore || !renderCore || !simulationCore || !uiCore) {
    throw new Error("SmartCars core modules failed to load");
  }

  const TERRAIN_DEFAULTS = Object.freeze({
    startFlatTiles: 3,
    maxHeight: 6,
    maxAngle: 80 * DEG_TO_RAD,
    maxAngleStep: 30 * DEG_TO_RAD,
    noise: 0.25,
    heightBias: 0.032,
    frictionMin: 0.35,
    frictionMax: 1.65,
    frictionNoise: 0.18,
    frictionWaves: 4,
    difficultyRamp: 1.55,
    difficultyFloor: 0.58,
    targetMinTiles: 3,
    targetMaxTiles: 7,
    targetShortening: 3,
    flipChance: 0.78,
    minAngleBase: 0.36,
    minAngleDifficulty: 0.24,
  });

  function normalizeTerrainParameters(source) {
    let terrain = Object.assign({}, TERRAIN_DEFAULTS, source || {});
    terrain.startFlatTiles = TERRAIN_DEFAULTS.startFlatTiles;
    terrain.maxHeight = clamp(parseFiniteFloat(terrain.maxHeight, TERRAIN_DEFAULTS.maxHeight), 2, 60);
    terrain.maxAngle = clamp(parseFiniteFloat(terrain.maxAngle, TERRAIN_DEFAULTS.maxAngle), 20 * DEG_TO_RAD, 80 * DEG_TO_RAD);
    terrain.maxAngleStep = clamp(parseFiniteFloat(terrain.maxAngleStep, TERRAIN_DEFAULTS.maxAngleStep), 1 * DEG_TO_RAD, 30 * DEG_TO_RAD);
    terrain.noise = clamp(parseFiniteFloat(terrain.noise, TERRAIN_DEFAULTS.noise), 0, 0.25);
    terrain.heightBias = clamp(parseFiniteFloat(terrain.heightBias, TERRAIN_DEFAULTS.heightBias), 0, 0.25);
    terrain.frictionMin = clamp(parseFiniteFloat(terrain.frictionMin, TERRAIN_DEFAULTS.frictionMin), 0.05, 4);
    terrain.frictionMax = clamp(parseFiniteFloat(terrain.frictionMax, TERRAIN_DEFAULTS.frictionMax), terrain.frictionMin, 5);
    terrain.frictionNoise = clamp(parseFiniteFloat(terrain.frictionNoise, TERRAIN_DEFAULTS.frictionNoise), 0, 1);
    terrain.frictionWaves = clamp(parseFiniteFloat(terrain.frictionWaves, TERRAIN_DEFAULTS.frictionWaves), 0, 12);
    terrain.difficultyRamp = clamp(parseFiniteFloat(terrain.difficultyRamp, TERRAIN_DEFAULTS.difficultyRamp), 0.2, 5);
    terrain.difficultyFloor = clamp(parseFiniteFloat(terrain.difficultyFloor, TERRAIN_DEFAULTS.difficultyFloor), 0.2, 0.98);
    terrain.targetMinTiles = clamp(parseFiniteInteger(terrain.targetMinTiles, TERRAIN_DEFAULTS.targetMinTiles), 1, 64);
    terrain.targetMaxTiles = clamp(parseFiniteInteger(terrain.targetMaxTiles, TERRAIN_DEFAULTS.targetMaxTiles), terrain.targetMinTiles, 96);
    terrain.targetShortening = clamp(parseFiniteFloat(terrain.targetShortening, TERRAIN_DEFAULTS.targetShortening), 0, 32);
    terrain.flipChance = clamp(parseFiniteFloat(terrain.flipChance, TERRAIN_DEFAULTS.flipChance), 0, 1);
    terrain.minAngleBase = clamp(parseFiniteFloat(terrain.minAngleBase, TERRAIN_DEFAULTS.minAngleBase), 0, 1);
    terrain.minAngleDifficulty = clamp(parseFiniteFloat(terrain.minAngleDifficulty, TERRAIN_DEFAULTS.minAngleDifficulty), 0, 1);
    return terrain;
  }

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

  function normalizeGenomeForComparison(schema, source) {
    let clone = {};
    let keys = getSchemaKeys(schema);
    for (let i = 0; i < keys.length; i++) {
      let key = keys[i];
      clone[key] = normalizeGeneValues(schema[key], key, source && source[key]);
    }
    return clone;
  }

  function getGenomeDistance(schema, left, right) {
    let keys = getSchemaKeys(schema);
    let geneCount = 0;
    let totalDistance = 0;
    for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
      let key = keys[keyIndex];
      let schemaProp = schema[key];
      let length = getSchemaLength(schemaProp, key);
      let leftValues = left[key] || [];
      let rightValues = right[key] || [];
      for (let valueIndex = 0; valueIndex < length; valueIndex++) {
        let leftValue = Number.isFinite(leftValues[valueIndex]) ? leftValues[valueIndex] : getDefaultNormal(schemaProp);
        let rightValue = Number.isFinite(rightValues[valueIndex]) ? rightValues[valueIndex] : getDefaultNormal(schemaProp);
        totalDistance += Math.abs(leftValue - rightValue);
        geneCount++;
      }
    }
    return geneCount > 0 ? totalDistance / geneCount : 0;
  }

  function measureGenomeDiversity(schema, generation) {
    if (!Array.isArray(generation) || generation.length < 2) {
      return {
        averageDistance: 0,
        nearestDistance: 0,
        maxDistance: 0,
        pairCount: 0
      };
    }

    let genomes = new Array(generation.length);
    let nearestDistances = new Array(generation.length);
    for (let i = 0; i < generation.length; i++) {
      genomes[i] = normalizeGenomeForComparison(schema, generation[i]);
      nearestDistances[i] = Infinity;
    }

    let distanceSum = 0;
    let maxDistance = 0;
    let pairCount = 0;
    for (let i = 0; i < genomes.length; i++) {
      for (let j = i + 1; j < genomes.length; j++) {
        let distance = getGenomeDistance(schema, genomes[i], genomes[j]);
        distanceSum += distance;
        pairCount++;
        maxDistance = Math.max(maxDistance, distance);
        nearestDistances[i] = Math.min(nearestDistances[i], distance);
        nearestDistances[j] = Math.min(nearestDistances[j], distance);
      }
    }

    let nearestSum = 0;
    let nearestCount = 0;
    for (let i = 0; i < nearestDistances.length; i++) {
      if (Number.isFinite(nearestDistances[i])) {
        nearestSum += nearestDistances[i];
        nearestCount++;
      }
    }

    return {
      averageDistance: pairCount > 0 ? distanceSum / pairCount : 0,
      nearestDistance: nearestCount > 0 ? nearestSum / nearestCount : 0,
      maxDistance: maxDistance,
      pairCount: pairCount
    };
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
          origin: typeof normalizedParents[i].origin === "string" ? normalizedParents[i].origin : null,
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
    "wheelRadiusRange": 0.8,
    "wheelMinDensity": 40,
    "wheelDensityRange": 160,
    "wheelMinFriction": 0.2,
    "wheelFrictionRange": 1.8,
    "chassisDensityRange": 500,
    "chassisMinDensity": 30,
    "chassisMinAxis": 0.1,
    "chassisAxisRange": 1.7,
    "suspensionMinTravel": 0.1,
    "suspensionTravelRange": 0.9,
    "suspensionMinStiffness": 1.25,
    "suspensionStiffnessRange": 18.75,
    "suspensionMinDamping": 0.18,
    "suspensionDampingRange": 2.32,
    "motorMinPower": 0.45,
    "motorPowerRange": 2.05,
    "motorMinGearing": 0.55,
    "motorGearingRange": 2.45,
    "motorDensityCost": 95,
    "drivetrainNominalMass": 260,
    "drivetrainReferenceWheelRadius": 0.45
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
  const MIN_CHASSIS_TRIANGLE_CROSS = 0.02;

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
    return keepChassisTrianglesBuildable(vertexList);
  }

  function keepChassisTrianglesBuildable(vertexList) {
    let adjusted = new Array(vertexList.length);
    for (let i = 0; i < vertexList.length; i++) {
      adjusted[i] = cloneVec2(vertexList[i]);
    }

    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < adjusted.length; i++) {
        let a = adjusted[i];
        let b = adjusted[(i + 1) % adjusted.length];
        let cross = Math.abs((a.x * b.y) - (a.y * b.x));
        if (!Number.isFinite(cross) || cross >= MIN_CHASSIS_TRIANGLE_CROSS) {
          continue;
        }
        let scale = Math.sqrt(MIN_CHASSIS_TRIANGLE_CROSS / Math.max(cross, Number.EPSILON));
        a.x *= scale;
        a.y *= scale;
        b.x *= scale;
        b.y *= scale;
      }
    }
    return adjusted;
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
      let courseConfig = terrainCore.normalizeCourseConfig({
        seed: "abc",
        tileCount: 1024,
        tileDimensions: { x: 1.5, y: 0.15 },
        preset: "grand_tour",
        mutable: true,
      });
      return {
        gravity: { y: 0 }, doSleep: true, floorseed: "abc",
        maxFloorTiles: 1024, mutable_floor: true, motorSpeed: 20,
        box2dfps: box2dfps, max_idle_timer: box2dfps * 10,
        tileDimensions: { width: 1.5, height: 0.15 },
        terrain: normalizeTerrainParameters(),
        courseConfig: courseConfig
      };
    }
    function getCarConstants() { return carConstants; }
    function generateSchema(values) {
      return {
        wheel_radius: { type: "float", length: values.wheelCount, min: values.wheelMinRadius, range: values.wheelRadiusRange, factor: 1 },
        wheel_density: { type: "float", length: values.wheelCount, min: values.wheelMinDensity, range: values.wheelDensityRange, factor: 1 },
        wheel_friction: { type: "float", length: values.wheelCount, min: values.wheelMinFriction, range: values.wheelFrictionRange, factor: 1 },
        chassis_density: { type: "float", length: 1, min: values.chassisMinDensity, range: values.chassisDensityRange, factor: 1 },
        suspension_travel: { type: "float", length: values.wheelCount, min: values.suspensionMinTravel, range: values.suspensionTravelRange, factor: 1 },
        suspension_stiffness: { type: "float", length: values.wheelCount, min: values.suspensionMinStiffness, range: values.suspensionStiffnessRange, factor: 1 },
        suspension_damping: { type: "float", length: values.wheelCount, min: values.suspensionMinDamping, range: values.suspensionDampingRange, factor: 1 },
        motor_power: { type: "float", length: 1, min: values.motorMinPower, range: values.motorPowerRange, factor: 1 },
        motor_gearing: { type: "float", length: 1, min: values.motorMinGearing, range: values.motorGearingRange, factor: 1 },
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
    let chassisDensity = calculateChassisDensityWithDrivetrainCost(car_def);
    instance.chassis = createChassis(
      world, car_def.vertex_list, chassisDensity
    );
    let i;

    let wheelCount = car_def.wheel_radius.length;

    instance.wheels = [];
    for (i = 0; i < wheelCount; i++) {
      instance.wheels[i] = createWheel(
        world,
        car_def.wheel_radius[i],
        car_def.wheel_density[i],
        car_def.wheel_friction[i]
      );
    }

    let carmass = b2.getBodyMass(instance.chassis.body);
    for (i = 0; i < wheelCount; i++) {
      carmass += b2.getBodyMass(instance.wheels[i].body);
    }

    for (i = 0; i < wheelCount; i++) {
      let randvertex = instance.chassis.vertex_list[car_def.wheel_vertex[i]];
      let travel = car_def.suspension_travel[i];
      let lowerTranslation = -travel * 0.65;
      let upperTranslation = travel * 0.35;
      let localAxis = vec2(0, 1);
      let anchorWorld = getWorldPoint(instance.chassis, randvertex);
      let motor = calculateWheelMotor(car_def, carmass, car_def.wheel_radius[i], constants);
      b2.setBodyTransform(instance.wheels[i].body, {
        position: vec2(anchorWorld.x, anchorWorld.y + lowerTranslation * 0.7),
        angle: 0,
      });
      instance.wheels[i].suspension = {
        localAnchorA: cloneVec2(randvertex),
        localAxis: cloneVec2(localAxis),
        travel: travel,
        lowerTranslation: lowerTranslation,
        upperTranslation: upperTranslation,
        hertz: car_def.suspension_stiffness[i],
        dampingRatio: car_def.suspension_damping[i],
      };
      instance.wheels[i].motor = motor;
      instance.joints.push(b2.createWheelJoint(
        world,
        instance.chassis.body,
        instance.wheels[i].body,
        {
          localAnchorA: randvertex,
          localAnchorB: vec2(0, 0),
          localAxis: localAxis,
          enableSpring: true,
          hertz: car_def.suspension_stiffness[i],
          dampingRatio: car_def.suspension_damping[i],
          enableLimit: true,
          lowerTranslation: lowerTranslation,
          upperTranslation: upperTranslation,
          enableMotor: true,
          motorSpeed: motor.motorSpeed,
          maxMotorTorque: motor.maxMotorTorque,
          collideConnected: false,
        }
      ));
    }

    return instance;
  }

  function calculateChassisDensityWithDrivetrainCost(car_def) {
    let baseDensity = car_def.chassis_density[0];
    let powerNormal = normalizeRange(
      car_def.motor_power[0],
      carConstantsData.motorMinPower,
      carConstantsData.motorPowerRange
    );
    let gearingNormal = normalizeRange(
      car_def.motor_gearing[0],
      carConstantsData.motorMinGearing,
      carConstantsData.motorGearingRange
    );
    let torqueBias = 1 - gearingNormal;
    return baseDensity + carConstantsData.motorDensityCost * (
      powerNormal * powerNormal + 0.25 * torqueBias * powerNormal
    );
  }

  function calculateWheelMotor(car_def, carmass, wheelRadius, constants) {
    let gravityY = constants.gravity && Number.isFinite(constants.gravity.y)
      ? constants.gravity.y
      : -9.81;
    let gravityMagnitude = Math.max(Math.abs(gravityY), 0.1);
    let referenceRadius = carConstantsData.drivetrainReferenceWheelRadius;
    let motorPower = car_def.motor_power[0];
    let gearing = Math.max(car_def.motor_gearing[0], 0.1);
    let massPenalty = Math.max(
      0.65,
      Math.sqrt(Math.max(carmass, 1) / carConstantsData.drivetrainNominalMass)
    );
    let radiusRatio = clamp(wheelRadius / referenceRadius, 0.45, 2.2);
    let baseMotorSpeed = Number.isFinite(constants.motorSpeed) ? constants.motorSpeed : 20;

    return {
      maxMotorTorque: (carmass * gravityMagnitude / referenceRadius) * motorPower / gearing / massPenalty,
      motorSpeed: -baseMotorSpeed * gearing / radiusRatio,
    };
  }

  function normalizeRange(value, min, range) {
    if (!Number.isFinite(range) || range <= 0) {
      return 0;
    }
    return clamp((value - min) / range, 0, 1);
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
    let vertex_list = createChassisTriangle(vertex1, vertex2);
    let shape = createChassisShape(chassis.body, vertex_list, density);

    chassis.triangles.push({
      vertices: vertex_list,
      shape: shape,
      density: density,
    });
  }

  function createChassisTriangle(vertex1, vertex2) {
    let vertex_list = [
      cloneVec2(vertex1),
      cloneVec2(vertex2),
      vec2(0, 0)
    ];
    let cross = (vertex_list[0].x * vertex_list[1].y) - (vertex_list[0].y * vertex_list[1].x);
    if (Number.isFinite(cross) && cross < 0) {
      let temp = vertex_list[0];
      vertex_list[0] = vertex_list[1];
      vertex_list[1] = temp;
    }
    return vertex_list;
  }

  function createChassisShape(body, vertices, density) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return b2.createPolygonShape(body, {
          vertices: vertices,
          density: density,
          friction: 10,
          restitution: 0.2,
          groupIndex: -1,
        });
      } catch (error) {
        if (attempt === 2) {
          throw error;
        }
        scaleChassisTriangle(vertices, 1.5);
      }
    }
    throw new Error("Unable to create chassis shape");
  }

  function scaleChassisTriangle(vertices, scale) {
    for (let i = 0; i < 2; i++) {
      vertices[i].x *= scale;
      vertices[i].y *= scale;
    }
  }

  function createWheel(world, radius, density, friction) {
    let body = b2.createBody(world, {
      type: b2.dynamicBody,
      position: vec2(0, 0),
    });
    let center = vec2(0, 0);
    let shape = b2.createCircleShape(body, {
      center: center,
      radius: radius,
      density: density,
      friction: friction,
      restitution: 0.2,
      groupIndex: -1,
    });

    return {
      body: body,
      shape: shape,
      center: center,
      radius: radius,
      density: density,
      friction: friction,
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
    return scoringCore.getInitialState(world_def);
  }

  function updateState(constants, worldConstruct, state) {
    let position = getBodyPosition(worldConstruct.chassis);
    let velocity = getBodyVelocity(worldConstruct.chassis);
    return scoringCore.updateState(constants, {
      position: position,
      velocity: velocity,
    }, state);
  }

  function getStatus(state, constants) {
    return scoringCore.getStatus(state, constants);
  }

  function calculateScore(state, constants) {
    return scoringCore.calculateScore(state, constants);
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
      generationSize: 20, schema: schema, championLength: 0,
      mutation_range: 1, gen_mutation: 0.05,
      randomImmigrantRate: 0.15,
      dissimilarParentSampleSize: 4
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
        schema = config.schema,
        generateRandom = config.generateRandom,
        selectFromAllParents = config.selectFromAllParents;

      let newGeneration = new Array(generationSize);
      let openSlots = Math.max(0, generationSize - champion_length);
      let randomImmigrantCount = getRandomImmigrantCount(config, openSlots);
      let childLimit = generationSize - randomImmigrantCount;
      let parentGenomes = createScoreGenomeList(schema, scores);
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
      for (let k = champion_length; k < childLimit; k++) {
        let parent1 = selectFromAllParents(scores, parentList);
        if (!Number.isInteger(parent1) || parent1 < 0 || parent1 >= scores.length) {
          parent1 = 0;
        }
        let parent2 = pickDissimilarParent(config, scores, parentGenomes, parent1, parentList);
        let pair = [parent1, parent2]
        parentList.push(pair);
        newborn = makeChild(config, [scores[parent1].def, scores[parent2].def]);
        newborn = mutate(config, newborn);
        newborn.bornGeneration = previousState.counter + 1;
        newborn.is_elite = false;
        newborn.origin = "bred";
        newborn.index = k;
        newGeneration[k] = newborn;
      }
      for (let k = childLimit; k < generationSize; k++) {
        newborn = create.createGenerationZero(schema, generateRandom);
        newborn.bornGeneration = previousState.counter + 1;
        newborn.is_elite = false;
        newborn.origin = "random_immigrant";
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

    function getRandomImmigrantCount(config, openSlots) {
      if (openSlots <= 0) {
        return 0;
      }
      let rate = clamp(parseFiniteFloat(config.randomImmigrantRate, 0), 0, 1);
      if (rate <= 0) {
        return 0;
      }
      return clamp(Math.round(openSlots * rate), 1, openSlots);
    }

    function createScoreGenomeList(schema, scores) {
      let genomes = new Array(scores.length);
      for (let i = 0; i < scores.length; i++) {
        genomes[i] = normalizeGenomeForComparison(schema, scores[i].def);
      }
      return genomes;
    }

    function pickDissimilarParent(config, scores, parentGenomes, parent1, parentList) {
      if (scores.length < 2) {
        return parent1;
      }
      let sampleSize = Math.max(1, parseFiniteInteger(config.dissimilarParentSampleSize, 1));
      let bestParent = -1;
      let bestDistance = -1;
      for (let sample = 0; sample < sampleSize; sample++) {
        let candidate = selectDifferentParent(config.selectFromAllParents, scores, parentList, parent1);
        if (candidate === parent1) {
          continue;
        }
        let distance = getGenomeDistance(config.schema, parentGenomes[parent1], parentGenomes[candidate]);
        if (distance > bestDistance) {
          bestDistance = distance;
          bestParent = candidate;
        }
      }
      if (bestParent !== -1) {
        return bestParent;
      }
      return selectDifferentParent(config.selectFromAllParents, scores, parentList, parent1);
    }

    function selectDifferentParent(selectFromAllParents, scores, parentList, parent1) {
      let candidate = parent1;
      let attempts = Math.max(4, scores.length * 2);
      while (candidate === parent1 && attempts > 0) {
        candidate = selectFromAllParents(scores, parentList, parent1);
        attempts--;
      }
      if (candidate !== parent1 && Number.isInteger(candidate) && candidate >= 0 && candidate < scores.length) {
        return candidate;
      }
      for (let i = 0; i < scores.length; i++) {
        if (i !== parent1) {
          return i;
        }
      }
      return parent1;
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
    ctx.lineWidth = 1 / zoom;

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
        ctx.fillStyle = getFloorFrictionColor(b.friction);
        ctx.beginPath();
        cw_drawWorldPoly(ctx, b.worldVertices, b.worldVertices.length);
        ctx.fill();
        ctx.stroke();
      }
      if (shapePosition > camera_x + 10) {
        break;
      }
    }
  }

  function getFloorFrictionColor(friction) {
    let course = currentRunner && currentRunner.scene ? currentRunner.scene.course : null;
    return renderCore.getFloorFrictionColor(
      friction,
      course ? course.frictionRange : { min: TERRAIN_DEFAULTS.frictionMin, max: TERRAIN_DEFAULTS.frictionMax }
    );
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
      let schema = config && config.schema ? config.schema : generationConfig.constants.schema;
      let nextState = cw_storeGraphScores(
        lastState, scores, generationSize, schema
      );
      let graphScale = cw_getGraphScale(nextState, graphwidth, graphheight);
      cw_clearGraphics(graphcanvas, graphctx, graphwidth, graphheight);
      cw_updateGraphScaleLabels(graphScale.yMax);
      cw_plotAverage(nextState, graphctx, graphScale);
      cw_plotElite(nextState, graphctx, graphScale);
      cw_plotTop(nextState, graphctx, graphScale);
      cw_listTopScores(topScoresElem, nextState);
      return nextState;
    },
  };


  function cw_storeGraphScores(lastState, cw_carScores, generationSize, schema) {
    let diversity = cw_measureScoreDiversity(schema, cw_carScores);
    let summary = scoringCore.summarizeGeneration(cw_carScores, world_def.course, diversity);
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
      cw_diversityStats: (lastState.cw_diversityStats || []).concat([
        diversity
      ]),
      cw_generationSummaries: (lastState.cw_generationSummaries || []).concat([
        summary
      ]),
    }
  }

  function cw_measureScoreDiversity(schema, scores) {
    let generation = new Array(scores.length);
    for (let i = 0; i < scores.length; i++) {
      generation[i] = scores[i].def;
    }
    return geneticsCore.measureGenomeDiversity(schema, generation);
  }

  function cw_getGraphScale(state, graphwidth, graphheight) {
    return {
      width: graphwidth,
      height: graphheight,
      yMax: cw_niceGraphMax(cw_getMaxGraphValue(state) * 1.08)
    };
  }

  function cw_getMaxGraphValue(state) {
    let maxValue = 0;
    let series = [
      state.cw_graphTop || [],
      state.cw_graphElite || [],
      state.cw_graphAverage || []
    ];
    for (let s = 0; s < series.length; s++) {
      for (let i = 0; i < series[s].length; i++) {
        if (Number.isFinite(series[s][i])) {
          maxValue = Math.max(maxValue, series[s][i]);
        }
      }
    }
    return maxValue;
  }

  function cw_niceGraphMax(value) {
    if (!Number.isFinite(value) || value <= 0) {
      return 1;
    }
    let exponent = Math.floor(Math.log10(value));
    let magnitude = Math.pow(10, exponent);
    let fraction = value / magnitude;
    let niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
    return niceFraction * magnitude;
  }

  function cw_updateGraphScaleLabels(yMax) {
    let scaleLabels = [
      ["s100", yMax],
      ["s75", yMax * 0.75],
      ["s50", yMax * 0.5],
      ["s25", yMax * 0.25],
      ["s0", 0]
    ];
    for (let i = 0; i < scaleLabels.length; i++) {
      let label = document.getElementById(scaleLabels[i][0]);
      if (label) {
        label.textContent = cw_formatGraphScaleLabel(scaleLabels[i][1]);
      }
    }
  }

  function cw_formatGraphScaleLabel(value) {
    if (!Number.isFinite(value)) {
      return "--";
    }
    if (value >= 1000) {
      return formatDetailNumber(value / 1000, value >= 10000 ? 0 : 1) + "k";
    }
    if (value >= 10) {
      return Math.round(value).toString();
    }
    if (value >= 1) {
      return formatDetailNumber(value, 1);
    }
    return formatDetailNumber(value, 2);
  }

  function cw_scaleGraphY(value, scale) {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return clamp(value, 0, scale.yMax) / scale.yMax * scale.height;
  }

  function cw_plotSeries(values, graphctx, scale, color) {
    let graphsize = values.length;
    if (graphsize === 0) {
      return;
    }
    graphctx.strokeStyle = color;
    graphctx.beginPath();
    graphctx.moveTo(0, 0);
    for (let k = 0; k < graphsize; k++) {
      graphctx.lineTo(
        scale.width * (k + 1) / graphsize,
        cw_scaleGraphY(values[k], scale)
      );
    }
    graphctx.stroke();
  }

  function cw_plotTop(state, graphctx, scale) {
    cw_plotSeries(state.cw_graphTop, graphctx, scale, "#d94f45");
  }

  function cw_plotElite(state, graphctx, scale) {
    cw_plotSeries(state.cw_graphElite, graphctx, scale, "#2f8a4c");
  }

  function cw_plotAverage(state, graphctx, scale) {
    cw_plotSeries(state.cw_graphAverage, graphctx, scale, "#2563eb");
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
    cw_appendDiversityStats(fragment, state);

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

  function cw_appendDiversityStats(fragment, state) {
    let stats = state.cw_diversityStats || [];
    let latest = stats.length > 0 ? stats[stats.length - 1] : null;
    if (!latest) {
      return;
    }
    fragment.appendChild(document.createTextNode(
      "Diversity avg " + cw_formatDiversityPercent(latest.averageDistance) +
      " / nearest " + cw_formatDiversityPercent(latest.nearestDistance) +
      " / max " + cw_formatDiversityPercent(latest.maxDistance)
    ));
    fragment.appendChild(document.createElement("br"));
    fragment.appendChild(document.createElement("br"));
  }

  function cw_formatDiversityPercent(value) {
    if (!Number.isFinite(value)) {
      return "--";
    }
    return Math.round(value * 100) + "%";
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

    let wheels = myCar.car.car.wheels;
    let chassis = myCar.car.car.chassis;
    let chassisTransform = getBodyTransform(chassis);
    let chassisAngle = chassisTransform.angle || 0;
    let chassisCos = Math.cos(chassisAngle);
    let chassisSin = Math.sin(chassisAngle);

    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1.5 / zoom;
    ctx.beginPath();
    let drewSuspension = false;
    for (let i = 0; i < wheels.length; i++) {
      let wheel = wheels[i];
      if (!wheel.suspension) {
        continue;
      }
      let wheelTransform = getBodyTransform(wheel);
      let wheelCenter = wheel.center.x === 0 && wheel.center.y === 0
        ? wheelTransform.position
        : transformPoint(wheelTransform, wheel.center);
      let chassisAnchor = transformPointWithTrig(
        chassisTransform,
        wheel.suspension.localAnchorA,
        chassisCos,
        chassisSin
      );
      ctx.moveTo(chassisAnchor.x, chassisAnchor.y);
      ctx.lineTo(wheelCenter.x, wheelCenter.y);
      drewSuspension = true;
    }
    if (drewSuspension) {
      ctx.stroke();
    }

    ctx.strokeStyle = "#24313a";
    ctx.lineWidth = 1 / zoom;

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
    this.minimapmarker = requireElementById("bar" + car_def.index);
    this.lastIdleTimerWidth = null;
    this.lastMarkerLeft = null;
    if (shouldUpdateLivePanels()) {
      this.idleTimerText.textContent = car_def.index.toString();
    }

    if (this.is_elite) {
      if (shouldUpdateLivePanels()) {
        this.idleTimerBar.backgroundColor = "#2563eb";
        this.minimapmarker.style.borderLeft = "1px solid #2563eb";
        this.minimapmarker.textContent = car_def.index.toString();
      }
    } else {
      if (shouldUpdateLivePanels()) {
        this.idleTimerBar.backgroundColor = "#d49718";
        this.minimapmarker.style.borderLeft = "1px solid #d49718";
        this.minimapmarker.textContent = car_def.index.toString();
      }
    }

  }

  cw_Car.prototype.getPosition = function () {
    return getBodyPosition(this.car.car.chassis);
  }

  cw_Car.prototype.kill = function (currentRunner, constants, updateLivePanels) {
    if (updateLivePanels !== false) {
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
    let course = terrainCore.createCourse(getResolvedCourseConfig(world_def));
    let floorTiles = cw_createFloor(world, course.tiles);
    course.tiles = floorTiles;
    let finishLine = course.finishLine;
    return {
      world: world,
      course: course,
      floorTiles: floorTiles,
      finishLine: finishLine
    };
  }

  function getResolvedCourseConfig(world_def) {
    let config = terrainCore.normalizeCourseConfig(world_def.courseConfig || {
      seed: world_def.floorseed,
      tileCount: world_def.maxFloorTiles,
      tileDimensions: world_def.tileDimensions,
      mutable: world_def.mutable_floor,
      terrain: world_def.terrain,
    });
    world_def.courseConfig = config;
    world_def.floorseed = config.seed;
    world_def.maxFloorTiles = config.tileCount;
    world_def.tileDimensions = vec2(config.tileDimensions.x, config.tileDimensions.y);
    world_def.mutable_floor = config.mutable;
    return config;
  }

  function setWorldCourseSeed(seed, targetWorldDef) {
    targetWorldDef.floorseed = seed;
    targetWorldDef.courseConfig = terrainCore.normalizeCourseConfig(Object.assign(
      {},
      targetWorldDef.courseConfig || {},
      { seed: seed }
    ));
  }

  function cw_createFloor(world, courseTiles) {
    let cw_floorTiles = [];
    for (let k = 0; k < courseTiles.length; k++) {
      cw_floorTiles.push(cw_createFloorTile(world, courseTiles[k]));
    }
    return cw_floorTiles;
  }

  function cw_createTerrainState(terrainParameters) {
    let parameters = normalizeTerrainParameters(terrainParameters);
    return Object.assign({
      angle: 0,
      targetAngle: 0,
      targetTilesLeft: 0,
      lastTargetSign: 1,
    }, parameters);
  }

  function cw_nextFloorAngle(terrain, tileIndex, maxFloorTiles, currentHeight) {
    if (tileIndex < terrain.startFlatTiles) {
      terrain.angle = 0;
      terrain.targetAngle = 0;
      terrain.targetTilesLeft = 0;
      return 0;
    }

    let progress = maxFloorTiles > 1 ? tileIndex / (maxFloorTiles - 1) : 1;
    let difficulty = cw_smoothStep(progress * terrain.difficultyRamp);
    let allowedAngle = terrain.maxAngle * (terrain.difficultyFloor + difficulty * (1 - terrain.difficultyFloor));
    if (terrain.targetTilesLeft <= 0) {
      let maxTargetTiles = Math.max(terrain.targetMinTiles, terrain.targetMaxTiles - difficulty * terrain.targetShortening);
      terrain.targetTilesLeft = Math.floor(
        terrain.targetMinTiles + Math.random() * (maxTargetTiles - terrain.targetMinTiles + 1)
      );
      terrain.lastTargetSign = Math.random() < terrain.flipChance ? -terrain.lastTargetSign : terrain.lastTargetSign;
      let minimumAngle = allowedAngle * clamp(terrain.minAngleBase + difficulty * terrain.minAngleDifficulty, 0, 0.95);
      terrain.targetAngle = terrain.lastTargetSign * (
        minimumAngle + Math.random() * (allowedAngle - minimumAngle)
      );
    }

    terrain.targetTilesLeft--;
    let heightCorrection = clamp(-currentHeight / terrain.maxHeight, -1, 1) * terrain.heightBias;
    let desiredAngle = terrain.targetAngle + heightCorrection + (Math.random() * 2 - 1) * terrain.noise;
    desiredAngle = clamp(desiredAngle, -allowedAngle, allowedAngle);

    let angleStep = clamp(
      desiredAngle - terrain.angle,
      -terrain.maxAngleStep,
      terrain.maxAngleStep
    );
    terrain.angle = clamp(terrain.angle + angleStep, -allowedAngle, allowedAngle);
    return terrain.angle;
  }

  function cw_smoothStep(value) {
    let t = clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function cw_nextFloorFriction(terrain, tileIndex, maxFloorTiles) {
    if (maxFloorTiles <= 1) {
      return terrain.frictionMax;
    }
    let progress = tileIndex / (maxFloorTiles - 1);
    let wave = terrain.frictionWaves === 0
      ? 0.5
      : (Math.sin(progress * TWO_PI * terrain.frictionWaves) + 1) / 2;
    let drift = cw_smoothStep(progress);
    let jitter = (Math.random() * 2 - 1) * terrain.frictionNoise;
    let blend = clamp((drift * 0.55) + (wave * 0.35) + 0.1 + jitter, 0, 1);
    return terrain.frictionMin + (terrain.frictionMax - terrain.frictionMin) * blend;
  }

  function cw_createFloorTile(world, courseTile) {
    let position = cloneVec2(courseTile.worldVertices[0]);
    let body = b2.createBody(world, {
      position: position,
    });

    let shape = b2.createPolygonShape(body, {
      vertices: courseTile.vertices,
      density: 0,
      friction: courseTile.friction,
    });
    return Object.assign({}, courseTile, {
      body: body,
      shape: shape,
      vertices: courseTile.vertices,
      worldVertices: courseTile.worldVertices,
    });
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

  function normalizeWorldRunListeners(listeners) {
    listeners = listeners || {};
    return {
      preCarStep: typeof listeners.preCarStep === "function" ? listeners.preCarStep : null,
      carStep: typeof listeners.carStep === "function" ? listeners.carStep : null,
      carDeath: typeof listeners.carDeath === "function" ? listeners.carDeath : null,
      generationEnd: typeof listeners.generationEnd === "function" ? listeners.generationEnd : null,
    };
  }

  function worldRun(world_def, defs, listeners) {
    if (world_def.mutable_floor) {
      // GHOST DISABLED
      setWorldCourseSeed(btoa(Math.seedrandom()), world_def);
    }

    let normalizedDefs = normalizeGeneration(world_def.schema, defs);
    let scene = setupScene(world_def);
    world_def.finishLine = scene.finishLine;
    world_def.course = scene.course;
    world_def.courseStartX = scene.course.startX;
    world_def.courseProgress = terrainCore.getProgress;
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
    let activeListeners = normalizeWorldRunListeners(listeners);
    return {
      scene: scene,
      cars: cars,
      setListeners: function (nextListeners) {
        activeListeners = normalizeWorldRunListeners(nextListeners);
      },
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
        if (activeListeners.preCarStep) {
          activeListeners.preCarStep();
        }
        let aliveCount = 0;
        for (let i = 0; i < alivecars.length; i++) {
          let car = alivecars[i];
          car.state = carRun.updateState(
            world_def, car.car, car.state
          );
          let status = carRun.getStatus(car.state, world_def);
          if (activeListeners.carStep) {
            activeListeners.carStep(car);
          }
          if (status === 0) {
            alivecars[aliveCount++] = car;
            continue;
          }
          car.score = carRun.calculateScore(car.state, world_def);
          if (activeListeners.carDeath) {
            activeListeners.carDeath(car);
          }

          destroyCarBody(car.car);
        }
        alivecars.length = aliveCount;
        if (alivecars.length === 0 && activeListeners.generationEnd) {
          activeListeners.generationEnd(cars);
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
  let liveUiSuspended = false;
  let cw_paused = false;
  let cw_animationFrameId = null;
  let cw_runningInterval = null;

  const box2dfps = 60;
  const screenfps = 60;
  const headlessStepBudgetMs = 40;
  const headlessMaxStepsPerBatch = box2dfps * 20;

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
  const selectedCarSummaryElem = requireElementById("selected-car-summary");
  const selectedCarComponentsElem = requireElementById("selected-car-components");

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
  const minimapMinWidth = 800;
  let minimapPixelWidth = minimapMinWidth;
  let minimapfogdistance = 0;
  let lastFloorSignature = null;
  const fogdistance = requireElementById("minimapfog").style;


  const carConstants = carConstruct.carConstants();


  const max_idle_timer = box2dfps * 10;

  let cw_ghostReplayInterval = null;
  const STORAGE_KEYS = {
    savedGeneration: "cw_savedGeneration",
    genCounter: "cw_genCounter",
    ghost: "cw_ghost",
    topScores: "cw_topScores",
    diversityStats: "cw_diversityStats",
    generationSummaries: "cw_generationSummaries",
    floorSeed: "cw_floorSeed",
    terrainSettings: "cw_terrainSettings",
  };

  const distanceMeter = requireElementById("distancemeter");
  const heightMeter = requireElementById("heightmeter");
  const courseProgressMeter = document.getElementById("course-progress-meter");
  const courseSectionMeter = document.getElementById("course-section-meter");
  const leaderMeter = document.getElementById("leader-meter");
  const courseSummaryElem = document.getElementById("course-summary");
  const courseSectionListElem = document.getElementById("course-section-list");
  const generationSummaryElem = document.getElementById("generation-summary");
  const evolutionMetricsElem = document.getElementById("evolution-metrics");
  let lastDistanceDisplay = null;
  let lastHeightDisplay = null;
  let lastCourseProgressDisplay = null;
  let lastCourseSectionDisplay = null;
  let lastMinimapCameraLeft = null;
  let lastMinimapCameraTop = null;
  let lastParentageSignature = null;
  let lastSelectedCarSignature = null;
  let lastSelectedCarRenderTime = 0;

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
    maxFloorTiles: 1024,
    mutable_floor: true,
    terrain: normalizeTerrainParameters(),
    courseConfig: terrainCore.normalizeCourseConfig({
      seed: btoa(Math.seedrandom()),
      tileCount: 1024,
      tileDimensions: vec2(1.5, 0.15),
      preset: "grand_tour",
      mutable: true,
      difficultyRamp: 1,
    }),
    box2dfps: box2dfps,
    max_run_frames: box2dfps * 75,
    motorSpeed: 20,
    max_idle_timer: max_idle_timer,
    schema: generationConfig.constants.schema
  }

  const COURSE_TUNING_DEFAULTS = {
    preset: "grand_tour",
    tileCount: 1024,
    difficultyRamp: 1,
    maxSlope: 80,
    roughness: 100,
    recovery: 100,
  };
  let courseTuning = Object.assign({}, COURSE_TUNING_DEFAULTS);

  const terrainControls = [
    {
      inputId: "terrain-length",
      outputId: "terrain-length-value",
      getValue() { return courseTuning.tileCount; },
      setValue(value) {
        courseTuning.tileCount = clamp(parseFiniteInteger(value, courseTuning.tileCount), 120, 1024);
      },
      format(value) { return Math.round(value) + " tiles"; },
    },
    {
      inputId: "course-difficulty",
      outputId: "course-difficulty-value",
      getValue() { return roundToTenth(courseTuning.difficultyRamp * 100); },
      setValue(value) {
        courseTuning.difficultyRamp = clamp(parseFiniteFloat(value, courseTuning.difficultyRamp * 100), 50, 180) / 100;
      },
      format(value) { return Math.round(value) + "%"; },
    },
    {
      inputId: "terrain-max-slope",
      outputId: "terrain-max-slope-value",
      getValue() { return Math.round(courseTuning.maxSlope); },
      setValue(value) {
        courseTuning.maxSlope = clamp(parseFiniteFloat(value, courseTuning.maxSlope), 20, 80);
      },
      format(value) { return Math.round(value) + " deg"; },
    },
    {
      inputId: "terrain-roughness",
      outputId: "terrain-roughness-value",
      getValue() { return Math.round(courseTuning.roughness); },
      setValue(value) {
        courseTuning.roughness = clamp(parseFiniteFloat(value, courseTuning.roughness), 25, 140);
      },
      format(value) { return Math.round(value) + "%"; },
    },
    {
      inputId: "terrain-recovery",
      outputId: "terrain-recovery-value",
      getValue() { return Math.round(courseTuning.recovery); },
      setValue(value) {
        courseTuning.recovery = clamp(parseFiniteFloat(value, courseTuning.recovery), 25, 180);
      },
      format(value) { return Math.round(value) + "%"; },
    },
  ];

  let cw_deadCars;
  let graphState = {
    cw_topScores: [],
    cw_graphAverage: [],
    cw_graphElite: [],
    cw_graphTop: [],
    cw_diversityStats: [],
    cw_generationSummaries: [],
  };

  function resetGraphState() {
    graphState = {
      cw_topScores: [],
      cw_graphAverage: [],
      cw_graphElite: [],
      cw_graphTop: [],
      cw_diversityStats: [],
      cw_generationSummaries: [],
    };
  }

  function roundToTenth(value) {
    return Math.round(value * 10) / 10;
  }

  function formatTenth(value) {
    let rounded = roundToTenth(value);
    return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
  }

  function getTerrainSettingsSnapshot() {
    return {
      version: 2,
      courseConfig: terrainCore.normalizeCourseConfig(world_def.courseConfig),
      courseTuning: Object.assign({}, courseTuning),
    };
  }

  function applyTerrainSettingsSnapshot(settings) {
    if (!settings || typeof settings !== "object") {
      return;
    }
    if (settings.courseConfig) {
      world_def.courseConfig = terrainCore.normalizeCourseConfig(settings.courseConfig);
      courseTuning = Object.assign({}, COURSE_TUNING_DEFAULTS, settings.courseTuning || {});
    } else {
      world_def.courseConfig = terrainCore.normalizeCourseConfig(terrainCore.migrateTerrainSettings(settings));
      syncCourseTuningFromConfig(world_def.courseConfig);
    }
    applyCourseConfigMirrors();
    syncTerrainControlsFromWorld();
  }

  function getFloorSignature() {
    if (currentRunner && currentRunner.scene && currentRunner.scene.course) {
      return currentRunner.scene.course.signature;
    }
    return terrainCore.createCourse(world_def.courseConfig).signature;
  }

  function renderTerrainControl(control) {
    let input = requireElementById(control.inputId);
    let output = requireElementById(control.outputId);
    let value = control.getValue();
    input.value = value;
    output.textContent = control.format(value);
  }

  function syncTerrainControlsFromWorld() {
    rebuildCourseConfigFromTuning();
    let presetInput = document.getElementById("course-preset");
    if (presetInput) {
      presetInput.value = courseTuning.preset;
    }
    for (let i = 0; i < terrainControls.length; i++) {
      renderTerrainControl(terrainControls[i]);
    }
  }

  function applyTerrainControlsToWorld() {
    let presetInput = document.getElementById("course-preset");
    if (presetInput) {
      courseTuning.preset = presetInput.value;
    }
    for (let i = 0; i < terrainControls.length; i++) {
      let control = terrainControls[i];
      control.setValue(requireElementById(control.inputId).value);
    }
    rebuildCourseConfigFromTuning();
    syncTerrainControlsFromWorld();
  }

  function bindTerrainControls() {
    let presetInput = document.getElementById("course-preset");
    if (presetInput) {
      presetInput.addEventListener("change", function () {
        courseTuning.preset = this.value;
        rebuildCourseConfigFromTuning();
        syncTerrainControlsFromWorld();
      });
    }
    for (let i = 0; i < terrainControls.length; i++) {
      let control = terrainControls[i];
      requireElementById(control.inputId).addEventListener("input", function () {
        control.setValue(this.value);
        rebuildCourseConfigFromTuning();
        renderTerrainControl(control);
      });
    }
    syncTerrainControlsFromWorld();
  }

  function rebuildCourseConfigFromTuning() {
    let baseConfig = terrainCore.normalizeCourseConfig({
      seed: world_def.floorseed,
      tileCount: courseTuning.tileCount,
      tileDimensions: world_def.tileDimensions,
      preset: courseTuning.preset,
      mutable: world_def.mutable_floor,
      difficultyRamp: courseTuning.difficultyRamp,
    });
    let maxSlope = Math.max(getMaxSectionSlope(baseConfig.sections), 1);
    let slopeScale = courseTuning.maxSlope / maxSlope;
    let roughnessScale = courseTuning.roughness / 100;
    let recoveryScale = courseTuning.recovery / 100;
    let tunedSections = baseConfig.sections.map(function (section) {
      return {
        id: section.id,
        name: section.name,
        lengthWeight: section.lengthWeight,
        slope: {
          min: clamp(section.slope.min * slopeScale, -80, 80),
          max: clamp(section.slope.max * slopeScale, -80, 80),
          bias: clamp(section.slope.bias * slopeScale, -80, 80),
        },
        roughness: clamp(section.roughness * roughnessScale, 0, 1),
        heightBias: clamp(section.heightBias * recoveryScale, 0, 0.25),
        friction: Object.assign({}, section.friction),
        difficulty: section.difficulty,
      };
    });
    world_def.courseConfig = terrainCore.normalizeCourseConfig(Object.assign({}, baseConfig, {
      sections: tunedSections,
    }));
    applyCourseConfigMirrors();
  }

  function syncCourseTuningFromConfig(config) {
    let normalized = terrainCore.normalizeCourseConfig(config || world_def.courseConfig);
    courseTuning.preset = terrainCore.COURSE_PRESETS[normalized.preset] ? normalized.preset : COURSE_TUNING_DEFAULTS.preset;
    courseTuning.tileCount = normalized.tileCount;
    courseTuning.difficultyRamp = normalized.difficultyRamp;
    courseTuning.maxSlope = Math.round(getMaxSectionSlope(normalized.sections));
    courseTuning.roughness = Math.round(getAverageSectionValue(normalized.sections, "roughness") / Math.max(getAverageSectionValue(terrainCore.COURSE_PRESETS[courseTuning.preset].sections, "roughness"), 0.01) * 100);
    courseTuning.recovery = Math.round(getAverageSectionValue(normalized.sections, "heightBias") / Math.max(getAverageSectionValue(terrainCore.COURSE_PRESETS[courseTuning.preset].sections, "heightBias"), 0.01) * 100);
    courseTuning.roughness = clamp(courseTuning.roughness, 25, 140);
    courseTuning.recovery = clamp(courseTuning.recovery, 25, 180);
  }

  function applyCourseConfigMirrors() {
    let config = terrainCore.normalizeCourseConfig(world_def.courseConfig);
    world_def.courseConfig = config;
    world_def.floorseed = config.seed;
    world_def.maxFloorTiles = config.tileCount;
    world_def.tileDimensions = vec2(config.tileDimensions.x, config.tileDimensions.y);
    world_def.mutable_floor = config.mutable;
  }

  function getMaxSectionSlope(sections) {
    let maxSlope = 0;
    for (let i = 0; i < sections.length; i++) {
      maxSlope = Math.max(
        maxSlope,
        Math.abs(sections[i].slope.min),
        Math.abs(sections[i].slope.max),
        Math.abs(sections[i].slope.bias)
      );
    }
    return maxSlope;
  }

  function getAverageSectionValue(sections, key) {
    if (!Array.isArray(sections) || sections.length === 0) {
      return 0;
    }
    let sum = 0;
    for (let i = 0; i < sections.length; i++) {
      sum += Number.isFinite(sections[i][key]) ? sections[i][key] : 0;
    }
    return sum / sections.length;
  }



  // ==========================

  let generationState;

  // ======== Activity State ====
  let currentRunner;

  function destroyCurrentRunner() {
    if (currentRunner && typeof currentRunner.destroy === "function") {
      currentRunner.destroy();
    }
    currentRunner = null;
  }

  function showDistance(distance, height) {
    if (!shouldUpdateLivePanels()) {
      return;
    }
    if (distance !== lastDistanceDisplay) {
      distanceMeter.textContent = distance + " meters";
      lastDistanceDisplay = distance;
    }
    if (height !== lastHeightDisplay) {
      heightMeter.textContent = height + " meters";
      lastHeightDisplay = height;
    }
    let progress = currentRunner && currentRunner.scene
      ? terrainCore.getProgress(currentRunner.scene.course, leaderPosition.x)
      : null;
    if (progress) {
      let progressText = uiCore.formatPercent(progress.completion);
      let sectionText = progress.sectionName + " " + uiCore.formatPercent(progress.sectionProgress);
      if (courseProgressMeter && progressText !== lastCourseProgressDisplay) {
        courseProgressMeter.textContent = progressText;
        lastCourseProgressDisplay = progressText;
      }
      if (courseSectionMeter && sectionText !== lastCourseSectionDisplay) {
        courseSectionMeter.textContent = sectionText;
        lastCourseSectionDisplay = sectionText;
      }
      if (leaderMeter && Number.isInteger(leaderPosition.leader)) {
        leaderMeter.textContent = "Car " + leaderPosition.leader;
      }
    }
    if (distance > minimapfogdistance) {
      fogdistance.width = Math.max(0, minimapPixelWidth - Math.round(distance + 15) * minimapscale) + "px";
      minimapfogdistance = distance;
    }
  }

  function shouldUpdateLivePanels() {
    return doDraw && !liveUiSuspended;
  }

  function shouldCaptureReplay() {
    return shouldUpdateLivePanels();
  }

  function shouldUseHeadlessRunner() {
    return !doDraw;
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
    if (parent.origin === "random_immigrant") {
      details.push("immigrant");
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

  function getCarFocusLabel(carInfo) {
    return (carInfo && camera.target !== -1 && camera.target === carInfo) ? "Selected" : "Leader";
  }

  function formatDetailNumber(value, digits) {
    if (!Number.isFinite(value)) {
      return "--";
    }
    let fixed = value.toFixed(digits);
    return fixed.replace(/\.?0+$/, "");
  }

  function formatDetailPoint(point) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return "--";
    }
    return "(" + formatDetailNumber(point.x, 2) + ", " + formatDetailNumber(point.y, 2) + ")";
  }

  function formatDetailPair(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return "--";
    }
    return formatDetailNumber(x, 2) + ", " + formatDetailNumber(y, 2);
  }

  function formatDetailPercent(value) {
    if (!Number.isFinite(value)) {
      return "--";
    }
    return Math.max(0, Math.round(value * 100)) + "%";
  }

  function readBodyMass(entity) {
    if (!entity) {
      return null;
    }
    try {
      let mass = b2.getBodyMass(bodyHandle(entity));
      return Number.isFinite(mass) ? mass : null;
    } catch (error) {
      return null;
    }
  }

  function appendSelectedCarFact(label, value) {
    let fact = document.createElement("div");
    let name = document.createElement("span");
    let data = document.createElement("strong");
    fact.className = "selected-car-fact";
    name.textContent = label;
    data.textContent = value;
    fact.appendChild(name);
    fact.appendChild(data);
    selectedCarSummaryElem.appendChild(fact);
  }

  function createComponentDetail(label, value) {
    let detail = document.createElement("div");
    let name = document.createElement("span");
    let data = document.createElement("strong");
    detail.className = "component-detail";
    name.textContent = label;
    data.textContent = value;
    detail.appendChild(name);
    detail.appendChild(data);
    return detail;
  }

  function createComponentCard(title, rows, primary) {
    let card = document.createElement("section");
    let heading = document.createElement("h3");
    let details = document.createElement("div");
    card.className = primary ? "selected-car-component primary" : "selected-car-component";
    details.className = "component-details";
    heading.textContent = title;
    card.appendChild(heading);
    for (let i = 0; i < rows.length; i++) {
      details.appendChild(createComponentDetail(rows[i][0], rows[i][1]));
    }
    card.appendChild(details);
    return card;
  }

  function describeCarStatus(carInfo, cwCar) {
    if (!carInfo || !cwCar) {
      return "No car";
    }
    let status = carRun.getStatus(carInfo.state, {
      finishLine: currentRunner && currentRunner.scene ? currentRunner.scene.finishLine : Infinity,
      max_idle_timer: max_idle_timer,
    });
    let label = status === 1 ? "Finished" : status === -1 ? "Stopped" : "Active";
    if (carInfo.def && carInfo.def.is_elite) {
      label += " / Elite";
    }
    if (carInfo.def && carInfo.def.origin === "random_immigrant") {
      label += " / Immigrant";
    }
    return label;
  }

  function getCurrentCarScore(carInfo) {
    if (!carInfo || !carInfo.state || carInfo.state.frames <= 0) {
      return null;
    }
    return carRun.calculateScore(carInfo.state, world_def);
  }

  function getSelectedCarSignature(carInfo, focusLabel) {
    if (!carInfo || !carMap.has(carInfo)) {
      return "none|" + (generationState ? generationState.counter : "?");
    }
    let cwCar = carMap.get(carInfo);
    let position = cwCar.getPosition();
    let velocity = getBodyVelocity(carInfo.car.chassis);
    let state = carInfo.state || {};
    let def = carInfo.def || {};
    return [
      focusLabel,
      carInfo.index,
      def.id || "",
      generationState ? generationState.counter : "?",
      formatDetailPair(position.x, position.y),
      formatDetailPair(velocity.x, velocity.y),
      state.idle_timer,
      state.frames,
      state.maxPositionx,
      cwCar.alive
    ].join("|");
  }

  function renderEmptySelectedCarPanel() {
    appendSelectedCarFact("Focus", "No car");
    appendSelectedCarFact("Race", generationState ? formatGenerationLabel(generationState.counter) : "G?");
    selectedCarComponentsElem.appendChild(createComponentCard("Vehicle", [
      ["Status", "No active car"],
      ["Components", "--"]
    ], true));
  }

  function renderSelectedCarPanel(force) {
    let now = typeof performance === "object" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
    if (!force && now - lastSelectedCarRenderTime < 250) {
      return;
    }
    lastSelectedCarRenderTime = now;

    let carInfo = getParentageCarInfo();
    let focusLabel = getCarFocusLabel(carInfo);
    let signature = getSelectedCarSignature(carInfo, focusLabel);
    if (signature === lastSelectedCarSignature) {
      return;
    }
    lastSelectedCarSignature = signature;
    selectedCarSummaryElem.textContent = "";
    selectedCarComponentsElem.textContent = "";

    if (!carInfo || !carMap.has(carInfo)) {
      renderEmptySelectedCarPanel();
      return;
    }

    let cwCar = carMap.get(carInfo);
    let carInstance = carInfo.car;
    let typedDef = createInstance.applyTypes(generationConfig.constants.schema, carInfo.def || {});
    let position = cwCar.getPosition();
    let velocity = getBodyVelocity(carInstance.chassis);
    let score = getCurrentCarScore(carInfo);
    let idleRatio = carInfo.state ? carInfo.state.idle_timer / max_idle_timer : null;
    let chassisDensity = calculateChassisDensityWithDrivetrainCost(typedDef);
    let baseDensity = typedDef.chassis_density[0];
    let drivetrainDensityCost = chassisDensity - baseDensity;
    let telemetry = simulationCore.deriveVehicleTelemetry(
      typedDef,
      carInstance,
      world_def,
      readBodyMass
    );

    appendSelectedCarFact("Focus", focusLabel + " " + formatCarLabel(carInfo.index));
    appendSelectedCarFact("Status", describeCarStatus(carInfo, cwCar));
    appendSelectedCarFact("Position", formatDetailPoint(position));
    appendSelectedCarFact("Velocity", formatDetailPair(velocity.x, velocity.y));
    appendSelectedCarFact("Idle reserve", formatDetailPercent(idleRatio));
    appendSelectedCarFact("Score", score ? formatDetailNumber(score.v, 2) : "--");
    appendSelectedCarFact("Distance", score ? formatDetailNumber(score.x, 2) + " m" : "--");
    appendSelectedCarFact("Course", score ? formatDetailPercent(score.completion) : "--");
    appendSelectedCarFact("ID", formatShortId(carInfo.def && carInfo.def.id));

    let chassisRows = [
      ["Mass", formatDetailNumber(readBodyMass(carInstance.chassis), 2)],
      ["Base density", formatDetailNumber(baseDensity, 2)],
      ["Effective density", formatDetailNumber(chassisDensity, 2)],
      ["Triangles", carInstance.chassis.triangles.length.toString()]
    ];
    for (let i = 0; i < carInstance.chassis.vertex_list.length; i++) {
      chassisRows.push(["Vertex " + i, formatDetailPoint(carInstance.chassis.vertex_list[i])]);
    }
    selectedCarComponentsElem.appendChild(createComponentCard("Chassis", chassisRows, true));

    selectedCarComponentsElem.appendChild(createComponentCard("Drivetrain", [
      ["Power", formatDetailNumber(typedDef.motor_power[0], 2)],
      ["Gearing", formatDetailNumber(typedDef.motor_gearing[0], 2)],
      ["Density cost", formatDetailNumber(drivetrainDensityCost, 2)],
      ["Base motor", formatDetailNumber(world_def.motorSpeed, 2)],
      ["Power / mass", formatDetailNumber(telemetry.powerToWeight, 4)],
      ["Effective torque", formatDetailNumber(telemetry.effectiveMotorTorque, 2)]
    ], false));

    selectedCarComponentsElem.appendChild(createComponentCard("Derived Telemetry", [
      ["Total mass", formatDetailNumber(telemetry.mass, 2)],
      ["Wheel mass", formatDetailNumber(telemetry.wheelMass, 2)],
      ["Wheel friction avg", formatDetailNumber(telemetry.wheelFrictionAverage, 2)],
      ["Suspension travel avg", formatDetailNumber(telemetry.suspensionTravelAverage, 2)],
      ["Suspension stiffness avg", formatDetailNumber(telemetry.suspensionStiffnessAverage, 2) + " Hz"],
      ["Suspension damping avg", formatDetailNumber(telemetry.suspensionDampingAverage, 2)]
    ], false));

    for (let i = 0; i < carInstance.wheels.length; i++) {
      let wheel = carInstance.wheels[i];
      let suspension = wheel.suspension || {};
      let motor = wheel.motor || {};
      let mountVertexIndex = typedDef.wheel_vertex[i];
      let mountPoint = carInstance.chassis.vertex_list[mountVertexIndex];
      selectedCarComponentsElem.appendChild(createComponentCard("Wheel " + (i + 1), [
        ["Radius", formatDetailNumber(wheel.radius, 2)],
        ["Density", formatDetailNumber(wheel.density, 2)],
        ["Friction", formatDetailNumber(wheel.friction, 2)],
        ["Mass", formatDetailNumber(readBodyMass(wheel), 2)],
        ["Mount", "V" + mountVertexIndex + " " + formatDetailPoint(mountPoint)],
        ["Travel", formatDetailNumber(suspension.travel, 2)],
        ["Limits", formatDetailNumber(suspension.lowerTranslation, 2) + " / " + formatDetailNumber(suspension.upperTranslation, 2)],
        ["Stiffness", formatDetailNumber(suspension.hertz, 2) + " Hz"],
        ["Damping", formatDetailNumber(suspension.dampingRatio, 2)],
        ["Torque", formatDetailNumber(motor.maxMotorTorque, 2)],
        ["Motor speed", formatDetailNumber(motor.motorSpeed, 2)]
      ], false));
    }
  }

  function renderParentagePanel() {
    let carInfo = getParentageCarInfo();
    let focusLabel = getCarFocusLabel(carInfo);
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
    if (def.origin === "random_immigrant") {
      appendParentageFact("Origin", "Random immigrant");
    }
    appendParentageFact("ID", formatShortId(def.id));

    let ancestry = Array.isArray(def.ancestry) ? def.ancestry : [];
    if (ancestry.length === 0) {
      if (def.origin === "random_immigrant") {
        parentageListElem.appendChild(createParentageRow("Base", "Random immigrant", "Injected for diversity", 0, true));
      } else {
        parentageListElem.appendChild(createParentageRow("Base", "Founding vehicle", "No recorded parents", 0, true));
      }
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

  function resetRunTracking() {
    cw_deadCars = 0;
    leaderPosition = {
      x: 0, y: 0
    };
    lastParentageSignature = null;
    lastSelectedCarSignature = null;
  }

  function resetCarUI() {
    resetRunTracking();
    generationMeter.textContent = generationState.counter.toString();
    populationMeter.textContent = generationConfig.constants.generationSize.toString();
    if (!shouldUpdateLivePanels()) {
      return;
    }
    carsElem.textContent = "";
    renderParentagePanel();
    renderSelectedCarPanel(true);
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
      if (shouldUpdateLivePanels()) {
        renderParentagePanel();
        renderSelectedCarPanel(true);
      }
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
    if (shouldUpdateLivePanels()) {
      renderParentagePanel();
      renderSelectedCarPanel(true);
    }
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

  function clearHeadlessSimulationTimer() {
    if (cw_runningInterval !== null) {
      window.clearTimeout(cw_runningInterval);
      cw_runningInterval = null;
    }
  }

  function runHeadlessSimulationBatch() {
    if (doDraw || cw_paused || !currentRunner) {
      cw_runningInterval = null;
      return;
    }

    let deadline = performance.now() + headlessStepBudgetMs;
    let steps = 0;
    do {
      simulationStep();
      steps++;
    } while (
      !doDraw &&
      !cw_paused &&
      currentRunner &&
      steps < headlessMaxStepsPerBatch &&
      performance.now() < deadline
    );

    if (!doDraw && !cw_paused) {
      cw_runningInterval = window.setTimeout(runHeadlessSimulationBatch, 0);
    } else {
      cw_runningInterval = null;
    }
  }

  function toggleDisplay() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (doDraw) {
      doDraw = false;
      syncCurrentRunnerListeners();
      suspendVisibleCarUI();
      cw_stopSimulation();
      cw_paused = false;
      runHeadlessSimulationBatch();
    } else {
      doDraw = true;
      clearHeadlessSimulationTimer();
      syncCurrentRunnerListeners();
      setupCarUI();
      refreshVisibleSimulationUi();
      cw_startSimulation();
    }
  }

  function cw_drawMiniMap() {
    let floorTiles = currentRunner.scene.floorTiles;
    let last_tile = null;
    let tile_position = vec2(-5, 0);
    let floorSignature = getFloorSignature();
    let floorChanged = (lastFloorSignature !== floorSignature);
    lastFloorSignature = floorSignature;
    cw_sizeMiniMap(floorTiles);
    if (floorChanged) {
      minimapfogdistance = 0;
      fogdistance.width = Math.max(0, minimapPixelWidth - 2) + "px";
    }
    minimapctx.clearRect(0, 0, minimapcanvas.width, minimapcanvas.height);
    let sectionRects = renderCore.getSectionRects(currentRunner.scene.course, minimapscale, 35, minimapcanvas.height);
    for (let i = 0; i < sectionRects.length; i++) {
      minimapctx.globalAlpha = 0.16;
      minimapctx.fillStyle = sectionRects[i].color;
      minimapctx.fillRect(sectionRects[i].x, 0, sectionRects[i].width, sectionRects[i].height);
    }
    minimapctx.globalAlpha = 1;
    minimapctx.strokeStyle = "#214e6f";
    minimapctx.lineWidth = 2;
    minimapctx.beginPath();
    minimapctx.moveTo(0, 35 * minimapscale);
    for (let k = 0; k < floorTiles.length; k++) {
      last_tile = floorTiles[k];
      tile_position = last_tile.worldVertices[3];
      minimapctx.lineTo((tile_position.x + 5) * minimapscale, (-tile_position.y + 35) * minimapscale);
    }
    minimapctx.stroke();
    renderCoursePanel();
  }

  function cw_sizeMiniMap(floorTiles) {
    let lastTile = floorTiles[floorTiles.length - 1];
    let finishPoint = lastTile && lastTile.worldVertices ? lastTile.worldVertices[3] : null;
    let trackWidth = finishPoint ? Math.ceil((finishPoint.x + 7) * minimapscale) : minimapMinWidth;
    minimapPixelWidth = Math.max(minimapMinWidth, trackWidth);
    let width = minimapPixelWidth + "px";
    if (minimapholder.style.width !== width) {
      minimapholder.style.width = width;
      minimapholder.style.minWidth = width;
    }
    if (minimapcanvas.width !== minimapPixelWidth) {
      minimapcanvas.width = minimapPixelWidth;
      minimapcanvas.style.width = width;
    }
  }

  /* ==== END Drawing ======================================================== */
  /* ========================================================================= */
  const uiListeners = {
    preCarStep: function () {
      if (shouldCaptureReplay()) {
        ghost_move_frame(ghost);
      }
    },
    carStep(car) {
      if (shouldUpdateLivePanels()) {
        updateCarUI(car);
      }
    },
    carDeath(carInfo) {

      let k = carInfo.index;

      let car = carInfo.car, score = carInfo.score;
      let cwCar = carMap.get(carInfo);
      cwCar.kill(currentRunner, world_def, shouldUpdateLivePanels());

      // refocus camera to leader on death
      if (camera.target === carInfo) {
        cw_setCameraTarget(-1);
      }

      if (shouldCaptureReplay()) {
        ghost_compare_to_replay(cwCar.replay, ghost, score.v);
      }
      carMap.delete(carInfo);

      score.i = generationState.counter;

      cw_deadCars++;
      if (shouldUpdateLivePanels()) {
        let generationSize = generationConfig.constants.generationSize;
        populationMeter.textContent = (generationSize - cw_deadCars).toString();
      }

      if (leaderPosition.leader === k) {
        // leader is dead, find new leader
        cw_findLeader();
      }
      if (shouldUpdateLivePanels()) {
        renderParentagePanel();
        renderSelectedCarPanel(true);
      }
    },
    generationEnd(results) {
      cleanupRound(results);
      return cw_newRound(results);
    }
  }

  const headlessListeners = {
    carDeath(carInfo) {
      if (carInfo.score) {
        carInfo.score.i = generationState.counter;
      }
      cw_deadCars++;
      if (camera.target === carInfo) {
        camera.target = -1;
      }
      if (leaderPosition.leader === carInfo.index) {
        leaderPosition.leader = undefined;
      }
    },
    generationEnd(results) {
      cleanupRound(results);
      return cw_newRound(results);
    }
  };

  function getSimulationListeners() {
    return shouldUseHeadlessRunner() ? headlessListeners : uiListeners;
  }

  function createWorldRunner(defs) {
    return worldRun(world_def, defs, getSimulationListeners());
  }

  function syncCurrentRunnerListeners() {
    if (currentRunner && typeof currentRunner.setListeners === "function") {
      currentRunner.setListeners(getSimulationListeners());
    }
  }

  function suspendVisibleCarUI() {
    carMap.clear();
    lastParentageSignature = null;
    lastSelectedCarSignature = null;
  }

  function simulationStep() {
    currentRunner.step();
    if (!shouldUpdateLivePanels()) {
      return;
    }
    showDistance(
      Math.round(leaderPosition.x * 100) / 100,
      Math.round(leaderPosition.y * 100) / 100
    );
    renderSelectedCarPanel(false);
  }

  function gameLoop() {
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
    if (shouldUpdateLivePanels()) {
      updateIdleTimerUI(car);
    }
    if (position.x > leaderPosition.x) {
      leaderPosition = position;
      leaderPosition.leader = k;
      if (camera.target === -1 && shouldUpdateLivePanels()) {
        renderParentagePanel();
      }
    }
  }

  function updateIdleTimerUI(cwCar) {
    let idleTimerWidth = Math.round((cwCar.car.state.idle_timer / max_idle_timer) * 100) + "%";
    if (idleTimerWidth !== cwCar.lastIdleTimerWidth) {
      cwCar.idleTimerBar.width = idleTimerWidth;
      cwCar.lastIdleTimerWidth = idleTimerWidth;
    }
  }

  function refreshIdleTimerPanel() {
    let activeCars = new Set();
    carMap.forEach(function (cwCar, carInfo) {
      activeCars.add(carInfo.index);
      cwCar.idleTimerText.textContent = carInfo.index.toString();
      let markerColor = cwCar.is_elite ? "#2563eb" : "#d49718";
      cwCar.idleTimerBar.backgroundColor = markerColor;
      cwCar.minimapmarker.style.borderLeft = "1px solid " + markerColor;
      cwCar.minimapmarker.textContent = carInfo.index.toString();
      updateIdleTimerUI(cwCar);
    });
    for (let i = 0; i < generationConfig.constants.generationSize; i++) {
      if (activeCars.has(i)) {
        continue;
      }
      let idleTimerBarElement = requireElementById("idle_timer" + i);
      idleTimerBarElement.style.width = "0";
      let idleTimerText = idleTimerBarElement.nextElementSibling;
      if (idleTimerText) {
        idleTimerText.textContent = "\u2020";
      }
      let minimapMarker = requireElementById("bar" + i);
      minimapMarker.style.borderLeft = "1px solid #aeb8bd";
      minimapMarker.textContent = i.toString();
    }
  }

  function refreshLivePanels() {
    if (!generationState) {
      return;
    }
    generationMeter.textContent = generationState.counter.toString();
    populationMeter.textContent = carMap.size.toString();
    lastDistanceDisplay = null;
    lastHeightDisplay = null;
    lastCourseProgressDisplay = null;
    lastCourseSectionDisplay = null;
    showDistance(
      Math.round(leaderPosition.x * 100) / 100,
      Math.round(leaderPosition.y * 100) / 100
    );
    refreshIdleTimerPanel();
    lastParentageSignature = null;
    lastSelectedCarSignature = null;
    renderParentagePanel();
    renderSelectedCarPanel(true);
  }

  function refreshVisibleSimulationUi() {
    if (!shouldUpdateLivePanels() || !currentRunner) {
      return;
    }
    cw_findLeader();
    cw_drawMiniMap();
    renderCoursePanel();
    renderGenerationSummaryPanel();
    refreshLivePanels();
  }

  function renderCoursePanel() {
    if (!courseSummaryElem || !courseSectionListElem || !currentRunner || !currentRunner.scene) {
      return;
    }
    let course = currentRunner.scene.course;
    let summary = uiCore.summarizeCourse(course);
    courseSummaryElem.textContent = "";
    appendMetricFact(courseSummaryElem, "Preset", summary.label);
    appendMetricFact(courseSummaryElem, "Finish", summary.distance);
    appendMetricFact(courseSummaryElem, "Elevation", summary.elevation);
    appendMetricFact(courseSummaryElem, "Friction", summary.friction);

    courseSectionListElem.textContent = "";
    for (let i = 0; i < course.sections.length; i++) {
      let section = course.sections[i];
      let item = document.createElement("li");
      let marker = document.createElement("span");
      let label = document.createElement("strong");
      let meta = document.createElement("span");
      item.className = "course-section-item";
      marker.className = "course-section-marker";
      marker.style.backgroundColor = renderCore.getSectionColor(section, i);
      label.textContent = section.name;
      meta.textContent = uiCore.formatDistance(section.endX - section.startX) + " / difficulty " + uiCore.formatPercent(section.difficulty);
      item.appendChild(marker);
      item.appendChild(label);
      item.appendChild(meta);
      courseSectionListElem.appendChild(item);
    }
  }

  function renderGenerationSummaryPanel() {
    if (!generationSummaryElem || !evolutionMetricsElem) {
      return;
    }
    let summaries = graphState.cw_generationSummaries || [];
    let diversityStats = graphState.cw_diversityStats || [];
    let latestSummary = summaries.length > 0 ? summaries[summaries.length - 1] : null;
    let latestDiversity = diversityStats.length > 0 ? diversityStats[diversityStats.length - 1] : null;
    generationSummaryElem.textContent = "";
    evolutionMetricsElem.textContent = "";

    if (!latestSummary) {
      appendMetricFact(generationSummaryElem, "Finish rate", "--");
      appendMetricFact(generationSummaryElem, "Best section", "--");
      appendMetricFact(generationSummaryElem, "Best distance", "--");
      appendMetricFact(generationSummaryElem, "Average score", "--");
    } else {
      appendMetricFact(generationSummaryElem, "Finish rate", uiCore.formatPercent(latestSummary.finishRate));
      appendMetricFact(generationSummaryElem, "Best section", latestSummary.bestSectionName || "--");
      appendMetricFact(generationSummaryElem, "Best distance", uiCore.formatDistance(latestSummary.bestDistance));
      appendMetricFact(generationSummaryElem, "Average score", uiCore.formatNumber(latestSummary.averageScore, 1));
    }

    let evolution = geneticsCore.describeEvolution(generationConfig.constants, latestSummary, latestDiversity);
    appendMetricFact(evolutionMetricsElem, "Mutation", uiCore.formatPercent(evolution.mutationRate));
    appendMetricFact(evolutionMetricsElem, "Mutation size", uiCore.formatPercent(evolution.mutationSize));
    appendMetricFact(evolutionMetricsElem, "Elite clones", evolution.eliteClones.toString());
    appendMetricFact(evolutionMetricsElem, "Immigrants", uiCore.formatPercent(evolution.randomImmigrantRate));
    appendMetricFact(evolutionMetricsElem, "Diversity avg", uiCore.formatPercent(evolution.diversityAverage));
    appendMetricFact(evolutionMetricsElem, "Diversity nearest", uiCore.formatPercent(evolution.diversityNearest));
  }

  function appendMetricFact(parent, label, value) {
    let fact = document.createElement("div");
    let name = document.createElement("span");
    let data = document.createElement("strong");
    fact.className = "metric-fact";
    name.textContent = label;
    data.textContent = value;
    fact.appendChild(name);
    fact.appendChild(data);
    parent.appendChild(fact);
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

  function runWithLiveUiSuspended(callback) {
    let previousSuspended = liveUiSuspended;
    liveUiSuspended = true;
    try {
      callback();
    } finally {
      liveUiSuspended = previousSuspended;
      refreshVisibleSimulationUi();
    }
  }

  function fastForward() {
    runWithLiveUiSuspended(function () {
      let gen = generationState.counter;
      while (gen === generationState.counter) {
        currentRunner.step();
      }
    });
  }

  function maybeDrawMiniMap() {
    if (shouldUpdateLivePanels()) {
      cw_drawMiniMap();
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
    renderGenerationSummaryPanel();
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
      setWorldCourseSeed(btoa(Math.seedrandom()), world_def);
    } else {
      ghost_reset_ghost(ghost);
    }
    currentRunner = createWorldRunner(generationState.generation);
    if (!shouldUseHeadlessRunner()) {
      setupCarUI();
    }
    maybeDrawMiniMap();
    resetCarUI();
  }

  function cw_startSimulation() {
    if (cw_animationFrameId !== null) {
      return;
    }
    cw_paused = false;
    cw_animationFrameId = window.requestAnimationFrame(gameLoop);
  }

  function cw_stopSimulation() {
    cw_paused = true;
    if (cw_animationFrameId !== null) {
      window.cancelAnimationFrame(cw_animationFrameId);
      cw_animationFrameId = null;
    }
    clearHeadlessSimulationTimer();
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
    cw_updateGraphScaleLabels(1);
    resetGraphState();
    lastParentageSignature = null;
    lastSelectedCarSignature = null;
    renderParentagePanel();
    renderSelectedCarPanel(true);
    renderGenerationSummaryPanel();
  }

  function cw_resetWorld() {
    doDraw = true;
    applyTerrainControlsToWorld();
    cw_stopSimulation();
    setWorldCourseSeed(seedInput.value, world_def);
    cw_clearPopulationWorld();
    destroyCurrentRunner();
    cw_resetPopulationUI();

    Math.seedrandom();
    cw_generationZero();
    currentRunner = createWorldRunner(generationState.generation);

    ghost = ghost_create_ghost();
    resetCarUI();
    setupCarUI()
    cw_drawMiniMap();

    cw_startSimulation();
  }

  function setupCarUI() {
    carMap.clear();
    if (shouldUseHeadlessRunner() || !currentRunner) {
      return;
    }
    for (let i = 0; i < currentRunner.cars.length; i++) {
      let carInfo = currentRunner.cars[i];
      if (carRun.getStatus(carInfo.state, world_def) !== 0) {
        continue;
      }
      let car = new cw_Car(carInfo, carMap);
      carMap.set(carInfo, car);
      car.replay = ghost_create_replay();
      if (shouldCaptureReplay()) {
        ghost_add_replay_frame(car.replay, car.car.car);
      }
    }
    lastParentageSignature = null;
    lastSelectedCarSignature = null;
    if (shouldUpdateLivePanels()) {
      renderParentagePanel();
      renderSelectedCarPanel(true);
    }
  }

  requireElementById("fast-forward").addEventListener("click", fastForward);
  requireElementById("save-progress").addEventListener("click", saveProgress);
  requireElementById("restore-progress").addEventListener("click", restoreProgress);
  requireElementById("toggle-display").addEventListener("click", toggleDisplay);

  requireElementById("new-population").addEventListener("click", function () {
    doDraw = true;
    applyTerrainControlsToWorld();
    cw_stopSimulation();
    cw_clearPopulationWorld();
    destroyCurrentRunner();
    cw_resetPopulationUI();
    Math.seedrandom();
    cw_generationZero();
    ghost = ghost_create_ghost();
    currentRunner = createWorldRunner(generationState.generation);
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
      localStorage.setItem(STORAGE_KEYS.diversityStats, JSON.stringify(graphState.cw_diversityStats));
      localStorage.setItem(STORAGE_KEYS.generationSummaries, JSON.stringify(graphState.cw_generationSummaries));
      localStorage.setItem(STORAGE_KEYS.floorSeed, world_def.floorseed);
      localStorage.setItem(STORAGE_KEYS.terrainSettings, JSON.stringify(getTerrainSettingsSnapshot()));
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
    let restoredDiversityStats;
    let restoredGenerationSummaries;
    let restoredFloorSeed;
    let restoredTerrainSettings;
    try {
      restoredGeneration = normalizeGeneration(
        generationConfig.constants.schema,
        JSON.parse(savedGeneration)
      );
      restoredCounter = Math.max(0, parseFiniteInteger(localStorage.getItem(STORAGE_KEYS.genCounter), 0));
      restoredGhost = JSON.parse(localStorage.getItem(STORAGE_KEYS.ghost) || "null");
      restoredTopScores = JSON.parse(localStorage.getItem(STORAGE_KEYS.topScores) || "[]");
      restoredDiversityStats = JSON.parse(localStorage.getItem(STORAGE_KEYS.diversityStats) || "[]");
      restoredGenerationSummaries = JSON.parse(localStorage.getItem(STORAGE_KEYS.generationSummaries) || "[]");
      if (restoredGhost !== null && typeof restoredGhost !== "object") {
        restoredGhost = null;
      }
      if (!Array.isArray(restoredTopScores)) {
        restoredTopScores = [];
      }
      if (!Array.isArray(restoredDiversityStats)) {
        restoredDiversityStats = [];
      }
      if (!Array.isArray(restoredGenerationSummaries)) {
        restoredGenerationSummaries = [];
      }
      restoredFloorSeed = localStorage.getItem(STORAGE_KEYS.floorSeed) || world_def.floorseed;
      restoredTerrainSettings = JSON.parse(localStorage.getItem(STORAGE_KEYS.terrainSettings) || "null");
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
    graphState.cw_diversityStats = restoredDiversityStats;
    graphState.cw_generationSummaries = restoredGenerationSummaries;
    setWorldCourseSeed(restoredFloorSeed, world_def);
    seedInput.value = world_def.floorseed;
    applyTerrainSettingsSnapshot(restoredTerrainSettings);

    currentRunner = createWorldRunner(generationState.generation);
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
    setWorldCourseSeed(btoa(Math.seedrandom()), world_def);
    seedInput.value = world_def.floorseed;
    cw_generationZero();
    ghost = ghost_create_ghost();
    resetCarUI();
    currentRunner = createWorldRunner(generationState.generation);
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
    world_def.courseConfig = terrainCore.normalizeCourseConfig(Object.assign(
      {},
      world_def.courseConfig,
      { mutable: world_def.mutable_floor }
    ));
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
      0,
      generationConfig.constants.generationSize
    );
  }

// Expose to global scope for inline onclick handlers in index.html
  window.cw_setCameraTarget = cw_setCameraTarget;

  bindTerrainControls();
  cw_init();


})();
