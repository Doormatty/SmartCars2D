(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./build/Box2D_v3.1.1.js"));
  } else {
    root.Box2D = factory(root.Box2DModule);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (defaultModuleFactory) {
  "use strict";

  function readVec2(value, fallbackX, fallbackY) {
    value = value || {};
    return {
      x: Number(value.x == null ? fallbackX : value.x),
      y: Number(value.y == null ? fallbackY : value.y),
    };
  }

  function readNumber(value, fallback) {
    return Number(value == null ? fallback : value);
  }

  function readFiniteNumber(value, fallback, name) {
    var number = readNumber(value, fallback);
    if (!Number.isFinite(number)) {
      throw new TypeError(name + " must be a finite number");
    }

    return number;
  }

  function readPositiveNumber(value, fallback, name) {
    var number = readFiniteNumber(value, fallback, name);
    if (number <= 0) {
      throw new RangeError(name + " must be greater than zero");
    }

    return number;
  }

  function readNonNegativeNumber(value, fallback, name) {
    var number = readFiniteNumber(value, fallback, name);
    if (number < 0) {
      throw new RangeError(name + " must be zero or greater");
    }

    return number;
  }

  function readInteger(value, fallback, name) {
    var number = readFiniteNumber(value, fallback, name);
    if (Math.floor(number) !== number) {
      throw new RangeError(name + " must be an integer");
    }

    return number;
  }

  function readPositiveInteger(value, fallback, name) {
    var number = readInteger(value, fallback, name);
    if (number <= 0) {
      throw new RangeError(name + " must be greater than zero");
    }

    return number;
  }

  function readUint32(value, fallback, name) {
    var number = readInteger(value, fallback, name);
    if (number < 0 || number > 0xffffffff) {
      throw new RangeError(name + " must be a 32-bit unsigned integer");
    }

    return number >>> 0;
  }

  function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value || {}, key);
  }

  function isArrayLike(value) {
    return Array.isArray(value) || (ArrayBuffer.isView(value) && typeof value.length === "number");
  }

  function handleValue(value, kind) {
    if (typeof value === "number") {
      return value;
    }

    if (!value || value.kind !== kind || typeof value.handle !== "number") {
      throw new TypeError("Expected a Box2D " + kind + " handle");
    }

    return value.handle;
  }

  function makeHandle(kind, handle) {
    if (!handle) {
      throw new Error("Box2D failed to create " + kind);
    }

    return Object.freeze({ kind: kind, handle: handle });
  }

  function makeOptionalHandle(kind, handle) {
    return handle ? Object.freeze({ kind: kind, handle: handle }) : null;
  }

  function readFilter(def) {
    def = def || {};
    var filter = def.filter || {};
    return {
      categoryBits: readUint32(def.categoryBits == null ? filter.categoryBits : def.categoryBits, 1, "filter.categoryBits"),
      maskBits: readUint32(def.maskBits == null ? filter.maskBits : def.maskBits, 0xffffffff, "filter.maskBits"),
      groupIndex: readInteger(def.groupIndex == null ? filter.groupIndex : def.groupIndex, 0, "filter.groupIndex"),
    };
  }

  function readSurfaceMaterial(def) {
    def = def || {};
    var material = def.surfaceMaterial || def.material || {};
    return {
      friction: readNonNegativeNumber(def.friction == null ? material.friction : def.friction, 0.6, "surfaceMaterial.friction"),
      restitution: readNonNegativeNumber(
        def.restitution == null ? material.restitution : def.restitution,
        0,
        "surfaceMaterial.restitution"
      ),
      rollingResistance: readNonNegativeNumber(
        def.rollingResistance == null ? material.rollingResistance : def.rollingResistance,
        0,
        "surfaceMaterial.rollingResistance"
      ),
      tangentSpeed: readFiniteNumber(
        def.tangentSpeed == null ? material.tangentSpeed : def.tangentSpeed,
        0,
        "surfaceMaterial.tangentSpeed"
      ),
      userMaterialId: readUint32(
        def.userMaterialId == null ? material.userMaterialId : def.userMaterialId,
        0,
        "surfaceMaterial.userMaterialId"
      ),
      customColor: readUint32(def.customColor == null ? material.customColor : def.customColor, 0, "surfaceMaterial.customColor"),
    };
  }

  function readShapeOptions(def, densityFallback) {
    def = def || {};
    var filter = readFilter(def);
    var material = readSurfaceMaterial(def);
    return {
      density: readNonNegativeNumber(def.density, densityFallback, "shape.density"),
      friction: material.friction,
      restitution: material.restitution,
      rollingResistance: material.rollingResistance,
      tangentSpeed: material.tangentSpeed,
      userMaterialId: material.userMaterialId,
      customColor: material.customColor,
      groupIndex: filter.groupIndex,
      categoryBits: filter.categoryBits,
      maskBits: filter.maskBits,
      isSensor: def.isSensor ? 1 : 0,
      enableSensorEvents: def.enableSensorEvents ? 1 : 0,
      enableContactEvents: def.enableContactEvents ? 1 : 0,
      enableHitEvents: def.enableHitEvents ? 1 : 0,
    };
  }

  function normalizeVertices(vertices) {
    if (!isArrayLike(vertices)) {
      throw new TypeError("vertices must be an array or typed array");
    }

    if (ArrayBuffer.isView(vertices)) {
      if (vertices.length % 2 !== 0) {
        throw new Error("flat vertex arrays must contain x/y pairs");
      }

      var typedFlat = Float32Array.from(vertices);
      for (var ti = 0; ti < typedFlat.length; ++ti) {
        if (!Number.isFinite(typedFlat[ti])) {
          throw new TypeError("vertices[" + ti + "] must be a finite number");
        }
      }
      return typedFlat;
    }

    if (vertices.length === 0) {
      return new Float32Array();
    }

    if (typeof vertices[0] === "number") {
      if (vertices.length % 2 !== 0) {
        throw new Error("flat vertex arrays must contain x/y pairs");
      }

      var arrayFlat = Float32Array.from(vertices);
      for (var ai = 0; ai < arrayFlat.length; ++ai) {
        if (!Number.isFinite(arrayFlat[ai])) {
          throw new TypeError("vertices[" + ai + "] must be a finite number");
        }
      }
      return arrayFlat;
    }

    var flat = new Float32Array(vertices.length * 2);
    for (var i = 0; i < vertices.length; ++i) {
      var vertex = vertices[i];
      if (Array.isArray(vertex)) {
        flat[i * 2] = readFiniteNumber(vertex[0], undefined, "vertices[" + i + "].x");
        flat[i * 2 + 1] = readFiniteNumber(vertex[1], undefined, "vertices[" + i + "].y");
      } else {
        flat[i * 2] = readFiniteNumber(vertex && vertex.x, undefined, "vertices[" + i + "].x");
        flat[i * 2 + 1] = readFiniteNumber(vertex && vertex.y, undefined, "vertices[" + i + "].y");
      }
    }

    return flat;
  }

  function validateVertexCount(count, min, max, name) {
    if (count < min) {
      throw new RangeError(name + " requires at least " + min + " vertices");
    }

    if (max != null && count > max) {
      throw new RangeError(name + " supports at most " + max + " vertices");
    }
  }

  function readFiniteVec2(value, fallbackX, fallbackY, name) {
    value = value || {};
    return {
      x: readFiniteNumber(value.x, fallbackX, name + ".x"),
      y: readFiniteNumber(value.y, fallbackY, name + ".y"),
    };
  }

  function ensureDistinctPoints(a, b, name) {
    if (a.x === b.x && a.y === b.y) {
      throw new RangeError(name + " endpoints must be different");
    }
  }

  function copyFloat32ToOutput(output, source) {
    if (typeof output.set === "function") {
      output.set(source);
      return;
    }

    for (var i = 0; i < source.length; ++i) {
      output[i] = source[i];
    }
  }

  async function Box2D(options) {
    options = options || {};

    var moduleFactory = options.moduleFactory || defaultModuleFactory;
    if (typeof moduleFactory !== "function") {
      throw new Error("Box2D v3 wasm module factory is not available");
    }

    var moduleOptions = Object.assign({}, options.module || {});
    var Module = await moduleFactory(moduleOptions);

    function createWorld(def) {
      def = def || {};
      var gravity = readFiniteVec2(def.gravity, 0, -10, "world.gravity");
      return makeHandle("world", Module._b2js_create_world(gravity.x, gravity.y));
    }

    function createBody(world, def) {
      def = def || {};
      var position = readFiniteVec2(def.position, 0, 0, "body.position");
      var angle = readFiniteNumber(def.angle, 0, "body.angle");
      var type = readInteger(def.type, api.staticBody, "body.type");
      if (type < api.staticBody || type > api.dynamicBody) {
        throw new RangeError("body.type must be staticBody, kinematicBody, or dynamicBody");
      }

      return makeHandle("body", Module._b2js_create_body(handleValue(world, "world"), type, position.x, position.y, angle));
    }

    function createBoxShape(body, def) {
      def = def || {};
      var options = readShapeOptions(def, 1);
      var hx = readPositiveNumber(def.hx == null ? def.halfWidth : def.hx, undefined, "box.hx");
      var hy = readPositiveNumber(def.hy == null ? def.halfHeight : def.hy, undefined, "box.hy");
      return makeHandle(
        "shape",
        Module._b2js_create_box_shape(
          handleValue(body, "body"),
          hx,
          hy,
          options.density,
          options.friction,
          options.restitution,
          options.rollingResistance,
          options.tangentSpeed,
          options.userMaterialId,
          options.customColor,
          options.groupIndex,
          options.categoryBits,
          options.maskBits,
          options.isSensor,
          options.enableSensorEvents,
          options.enableContactEvents,
          options.enableHitEvents
        )
      );
    }

    function createCircleShape(body, def) {
      def = def || {};
      var center = readFiniteVec2(def.center, 0, 0, "circle.center");
      var radius = readPositiveNumber(def.radius, undefined, "circle.radius");
      var options = readShapeOptions(def, 1);
      return makeHandle(
        "shape",
        Module._b2js_create_circle_shape(
          handleValue(body, "body"),
          center.x,
          center.y,
          radius,
          options.density,
          options.friction,
          options.restitution,
          options.rollingResistance,
          options.tangentSpeed,
          options.userMaterialId,
          options.customColor,
          options.groupIndex,
          options.categoryBits,
          options.maskBits,
          options.isSensor,
          options.enableSensorEvents,
          options.enableContactEvents,
          options.enableHitEvents
        )
      );
    }

    function createCapsuleShape(body, def) {
      def = def || {};
      var center1 = readFiniteVec2(def.center1 || def.p1, 0, -0.5, "capsule.center1");
      var center2 = readFiniteVec2(def.center2 || def.p2, 0, 0.5, "capsule.center2");
      ensureDistinctPoints(center1, center2, "capsule");
      var radius = readPositiveNumber(def.radius, undefined, "capsule.radius");
      var options = readShapeOptions(def, 1);
      return makeHandle(
        "shape",
        Module._b2js_create_capsule_shape(
          handleValue(body, "body"),
          center1.x,
          center1.y,
          center2.x,
          center2.y,
          radius,
          options.density,
          options.friction,
          options.restitution,
          options.rollingResistance,
          options.tangentSpeed,
          options.userMaterialId,
          options.customColor,
          options.groupIndex,
          options.categoryBits,
          options.maskBits,
          options.isSensor,
          options.enableSensorEvents,
          options.enableContactEvents,
          options.enableHitEvents
        )
      );
    }

    function createSegmentShape(body, def) {
      def = def || {};
      var p1 = readFiniteVec2(def.p1, 0, 0, "segment.p1");
      var p2 = readFiniteVec2(def.p2, 0, 0, "segment.p2");
      ensureDistinctPoints(p1, p2, "segment");
      var options = readShapeOptions(def, 0);
      return makeHandle(
        "shape",
        Module._b2js_create_segment_shape(
          handleValue(body, "body"),
          p1.x,
          p1.y,
          p2.x,
          p2.y,
          options.friction,
          options.restitution,
          options.rollingResistance,
          options.tangentSpeed,
          options.userMaterialId,
          options.customColor,
          options.groupIndex,
          options.categoryBits,
          options.maskBits,
          options.isSensor,
          options.enableSensorEvents,
          options.enableContactEvents,
          options.enableHitEvents
        )
      );
    }

    function createPolygonShape(body, def) {
      def = def || {};
      var vertices = normalizeVertices(def.vertices);
      var count = vertices.length / 2;
      validateVertexCount(count, 3, 8, "polygon");
      var ptr = Module._malloc(vertices.byteLength);
      var options = readShapeOptions(def, 1);

      try {
        Module.HEAPF32.set(vertices, ptr >> 2);
        return makeHandle(
          "shape",
          Module._b2js_create_polygon_shape(
            handleValue(body, "body"),
            ptr,
            count,
            options.density,
            options.friction,
            options.restitution,
            options.rollingResistance,
            options.tangentSpeed,
            options.userMaterialId,
            options.customColor,
            options.groupIndex,
            options.categoryBits,
            options.maskBits,
            options.isSensor,
            options.enableSensorEvents,
            options.enableContactEvents,
            options.enableHitEvents
          )
        );
      } finally {
        Module._free(ptr);
      }
    }

    function createChain(body, def) {
      def = def || {};
      var vertices = normalizeVertices(def.vertices || def.points);
      var count = vertices.length / 2;
      validateVertexCount(count, 4, null, "chain");
      var ptr = Module._malloc(vertices.byteLength);
      var material = readSurfaceMaterial(def);
      var filter = readFilter(def);

      try {
        Module.HEAPF32.set(vertices, ptr >> 2);
        return makeHandle(
          "chain",
          Module._b2js_create_chain(
            handleValue(body, "body"),
            ptr,
            count,
            def.isLoop || def.loop ? 1 : 0,
            material.friction,
            material.restitution,
            material.rollingResistance,
            material.tangentSpeed,
            material.userMaterialId,
            material.customColor,
            filter.groupIndex,
            filter.categoryBits,
            filter.maskBits,
            def.enableSensorEvents ? 1 : 0
          )
        );
      } finally {
        Module._free(ptr);
      }
    }

    function readJointAnchors(def) {
      def = def || {};
      if (def.localAnchorA || def.localAnchorB) {
        return {
          local: true,
          a: readVec2(def.localAnchorA, 0, 0),
          b: readVec2(def.localAnchorB, 0, 0),
        };
      }

      if (def.anchorA || def.anchorB) {
        return {
          local: false,
          a: readVec2(def.anchorA, 0, 0),
          b: readVec2(def.anchorB, 0, 0),
        };
      }

      var anchor = readVec2(def.anchor, 0, 0);
      return { local: false, a: anchor, b: anchor };
    }

    function readJointAxis(def, fallbackX, fallbackY) {
      def = def || {};
      if (def.localAxis) {
        var localAxis = readVec2(def.localAxis, fallbackX, fallbackY);
        return { x: localAxis.x, y: localAxis.y, local: true };
      }

      var axis = readVec2(def.axis, fallbackX, fallbackY);
      return { x: axis.x, y: axis.y, local: false };
    }

    function createDistanceJoint(world, bodyA, bodyB, def) {
      def = def || {};
      var anchors = readJointAnchors(def);
      var range = def.lengthRange || {};
      var springForceRange = def.springForceRange || {};
      return makeHandle(
        "joint",
        Module._b2js_create_distance_joint(
          handleValue(world, "world"),
          handleValue(bodyA, "body"),
          handleValue(bodyB, "body"),
          anchors.local ? 1 : 0,
          anchors.a.x,
          anchors.a.y,
          anchors.b.x,
          anchors.b.y,
          readNumber(def.length, NaN),
          def.enableSpring ? 1 : 0,
          readNumber(def.lowerSpringForce == null ? springForceRange.lower : def.lowerSpringForce, NaN),
          readNumber(def.upperSpringForce == null ? springForceRange.upper : def.upperSpringForce, NaN),
          readNumber(def.hertz, 0),
          readNumber(def.dampingRatio, 0),
          def.enableLimit ? 1 : 0,
          readNumber(def.minLength == null ? range.min : def.minLength, NaN),
          readNumber(def.maxLength == null ? range.max : def.maxLength, NaN),
          def.enableMotor ? 1 : 0,
          readNumber(def.maxMotorForce, 0),
          readNumber(def.motorSpeed, 0),
          def.collideConnected ? 1 : 0,
          readNumber(def.constraintHertz, NaN),
          readNumber(def.constraintDampingRatio, NaN),
          readNumber(def.forceThreshold, NaN),
          readNumber(def.torqueThreshold, NaN),
          readNumber(def.drawScale, NaN)
        )
      );
    }

    function createRevoluteJoint(world, bodyA, bodyB, def) {
      def = def || {};
      var anchors = readJointAnchors(def);
      var referenceAngle = readNumber(def.referenceAngle, 0);
      var localAngleA = readNumber(def.localAngleA, 0);
      var localAngleB = hasOwn(def, "localAngleB") ? readNumber(def.localAngleB, 0) : -referenceAngle;
      return makeHandle(
        "joint",
        Module._b2js_create_revolute_joint(
          handleValue(world, "world"),
          handleValue(bodyA, "body"),
          handleValue(bodyB, "body"),
          anchors.local ? 1 : 0,
          anchors.a.x,
          anchors.a.y,
          anchors.b.x,
          anchors.b.y,
          localAngleA,
          localAngleB,
          readNumber(def.targetAngle, 0),
          def.enableSpring ? 1 : 0,
          readNumber(def.hertz, 0),
          readNumber(def.dampingRatio, 0),
          def.enableLimit ? 1 : 0,
          readNumber(def.lowerAngle, 0),
          readNumber(def.upperAngle, 0),
          def.enableMotor ? 1 : 0,
          readNumber(def.motorSpeed, 0),
          readNumber(def.maxMotorTorque, 0),
          def.collideConnected ? 1 : 0,
          readNumber(def.constraintHertz, NaN),
          readNumber(def.constraintDampingRatio, NaN),
          readNumber(def.forceThreshold, NaN),
          readNumber(def.torqueThreshold, NaN),
          readNumber(def.drawScale, NaN)
        )
      );
    }

    function createFilterJoint(world, bodyA, bodyB, def) {
      def = def || {};
      return makeHandle(
        "joint",
        Module._b2js_create_filter_joint(
          handleValue(world, "world"),
          handleValue(bodyA, "body"),
          handleValue(bodyB, "body"),
          def.collideConnected ? 1 : 0,
          readNumber(def.constraintHertz, NaN),
          readNumber(def.constraintDampingRatio, NaN),
          readNumber(def.forceThreshold, NaN),
          readNumber(def.torqueThreshold, NaN),
          readNumber(def.drawScale, NaN)
        )
      );
    }

    function createPrismaticJoint(world, bodyA, bodyB, def) {
      def = def || {};
      var anchors = readJointAnchors(def);
      var axis = readJointAxis(def, 1, 0);
      return makeHandle(
        "joint",
        Module._b2js_create_prismatic_joint(
          handleValue(world, "world"),
          handleValue(bodyA, "body"),
          handleValue(bodyB, "body"),
          anchors.local || axis.local ? 1 : 0,
          anchors.a.x,
          anchors.a.y,
          anchors.b.x,
          anchors.b.y,
          axis.x,
          axis.y,
          readNumber(def.localAngleB, 0),
          def.enableSpring ? 1 : 0,
          readNumber(def.hertz, 0),
          readNumber(def.dampingRatio, 0),
          readNumber(def.targetTranslation, 0),
          def.enableLimit ? 1 : 0,
          readNumber(def.lowerTranslation == null ? def.lowerLimit : def.lowerTranslation, 0),
          readNumber(def.upperTranslation == null ? def.upperLimit : def.upperTranslation, 0),
          def.enableMotor ? 1 : 0,
          readNumber(def.motorSpeed, 0),
          readNumber(def.maxMotorForce, 0),
          def.collideConnected ? 1 : 0,
          readNumber(def.constraintHertz, NaN),
          readNumber(def.constraintDampingRatio, NaN),
          readNumber(def.forceThreshold, NaN),
          readNumber(def.torqueThreshold, NaN),
          readNumber(def.drawScale, NaN)
        )
      );
    }

    function createWheelJoint(world, bodyA, bodyB, def) {
      def = def || {};
      var anchors = readJointAnchors(def);
      var axis = readJointAxis(def, 0, 1);
      return makeHandle(
        "joint",
        Module._b2js_create_wheel_joint(
          handleValue(world, "world"),
          handleValue(bodyA, "body"),
          handleValue(bodyB, "body"),
          anchors.local || axis.local ? 1 : 0,
          anchors.a.x,
          anchors.a.y,
          anchors.b.x,
          anchors.b.y,
          axis.x,
          axis.y,
          readNumber(def.localAngleB, 0),
          def.enableSpring ? 1 : 0,
          readNumber(def.hertz, 0),
          readNumber(def.dampingRatio, 0),
          def.enableLimit ? 1 : 0,
          readNumber(def.lowerTranslation == null ? def.lowerLimit : def.lowerTranslation, 0),
          readNumber(def.upperTranslation == null ? def.upperLimit : def.upperTranslation, 0),
          def.enableMotor ? 1 : 0,
          readNumber(def.motorSpeed, 0),
          readNumber(def.maxMotorTorque, 0),
          def.collideConnected ? 1 : 0,
          readNumber(def.constraintHertz, NaN),
          readNumber(def.constraintDampingRatio, NaN),
          readNumber(def.forceThreshold, NaN),
          readNumber(def.torqueThreshold, NaN),
          readNumber(def.drawScale, NaN)
        )
      );
    }

    function createMotorJoint(world, bodyA, bodyB, def) {
      def = def || {};
      var linearVelocity = readVec2(def.linearVelocity, 0, 0);
      return makeHandle(
        "joint",
        Module._b2js_create_motor_joint(
          handleValue(world, "world"),
          handleValue(bodyA, "body"),
          handleValue(bodyB, "body"),
          def.collideConnected ? 1 : 0,
          linearVelocity.x,
          linearVelocity.y,
          readNumber(def.angularVelocity, 0),
          readNumber(def.maxVelocityForce, 0),
          readNumber(def.maxVelocityTorque, 0),
          readNumber(def.linearHertz, 0),
          readNumber(def.linearDampingRatio, 0),
          readNumber(def.maxSpringForce, 0),
          readNumber(def.angularHertz, 0),
          readNumber(def.angularDampingRatio, 0),
          readNumber(def.maxSpringTorque, 0),
          readNumber(def.constraintHertz, NaN),
          readNumber(def.constraintDampingRatio, NaN),
          readNumber(def.forceThreshold, NaN),
          readNumber(def.torqueThreshold, NaN),
          readNumber(def.drawScale, NaN)
        )
      );
    }

    function setRevoluteJointMotor(joint, def) {
      def = def || {};
      Module._b2js_revolute_joint_set_motor(
        handleValue(joint, "joint"),
        def.enabled === false ? 0 : 1,
        Number(def.motorSpeed == null ? 0 : def.motorSpeed),
        Number(def.maxMotorTorque == null ? 0 : def.maxMotorTorque)
      );
    }

    function jointHandle(joint) {
      return handleValue(joint, "joint");
    }

    function readFrame(def) {
      def = def || {};
      var position = readVec2(def.position || def.p, 0, 0);
      return {
        x: position.x,
        y: position.y,
        angle: readNumber(def.angle, 0),
      };
    }

    function getJointLocalFrame(joint, suffix) {
      var handle = jointHandle(joint);
      return {
        position: {
          x: Module["_b2js_joint_get_local_frame_" + suffix + "_x"](handle),
          y: Module["_b2js_joint_get_local_frame_" + suffix + "_y"](handle),
        },
        angle: Module["_b2js_joint_get_local_frame_" + suffix + "_angle"](handle),
      };
    }

    function step(world, timeStep, subStepCount) {
      Module._b2js_step(handleValue(world, "world"), Number(timeStep), subStepCount == null ? 4 : Number(subStepCount));
    }

    function getBodyPosition(body) {
      var handle = handleValue(body, "body");
      return {
        x: Module._b2js_body_get_position_x(handle),
        y: Module._b2js_body_get_position_y(handle),
      };
    }

    function getBodyVelocity(body) {
      var handle = handleValue(body, "body");
      return {
        x: Module._b2js_body_get_velocity_x(handle),
        y: Module._b2js_body_get_velocity_y(handle),
      };
    }

    function getBodyTransform(body) {
      var handle = handleValue(body, "body");
      return {
        position: {
          x: Module._b2js_body_get_position_x(handle),
          y: Module._b2js_body_get_position_y(handle),
        },
        angle: Module._b2js_body_get_angle(handle),
      };
    }

    function readBodyTransforms(bodies, out) {
      if (!isArrayLike(bodies)) {
        throw new TypeError("bodies must be an array or typed array");
      }

      var count = bodies.length;
      var handles = new Int32Array(count);
      for (var i = 0; i < count; ++i) {
        handles[i] = handleValue(bodies[i], "body");
      }

      var output = out || new Float32Array(count * 3);
      if (!output || typeof output.length !== "number") {
        throw new TypeError("output must be an array or typed array");
      }

      if (output.length < count * 3) {
        throw new Error("output array is too small");
      }

      if (count === 0) {
        return output;
      }

      var handlesPtr = Module._malloc(handles.byteLength);
      var outputPtr = Module._malloc(count * 3 * Float32Array.BYTES_PER_ELEMENT);

      try {
        Module.HEAP32.set(handles, handlesPtr >> 2);
        Module._b2js_read_body_transforms(handlesPtr, count, outputPtr);
        copyFloat32ToOutput(output, Module.HEAPF32.subarray(outputPtr >> 2, (outputPtr >> 2) + count * 3));
        return output;
      } finally {
        Module._free(handlesPtr);
        Module._free(outputPtr);
      }
    }

    function readRayResult(shapeHandle, data) {
      if (!shapeHandle) {
        return null;
      }

      return {
        shape: makeOptionalHandle("shape", shapeHandle),
        point: { x: data[0], y: data[1] },
        normal: { x: data[2], y: data[3] },
        fraction: data[4],
        nodeVisits: data[5],
        leafVisits: data[6],
      };
    }

    function castRayClosest(world, def) {
      def = def || {};
      var origin = readFiniteVec2(def.origin, 0, 0, "ray.origin");
      var translation = readFiniteVec2(def.translation, 0, 0, "ray.translation");
      var filter = readFilter(def);
      var ptr = Module._malloc(7 * Float32Array.BYTES_PER_ELEMENT);

      try {
        var shapeHandle = Module._b2js_world_cast_ray_closest(
          handleValue(world, "world"),
          origin.x,
          origin.y,
          translation.x,
          translation.y,
          filter.categoryBits,
          filter.maskBits,
          ptr
        );
        var data = Module.HEAPF32.slice(ptr >> 2, (ptr >> 2) + 7);
        return readRayResult(shapeHandle, data);
      } finally {
        Module._free(ptr);
      }
    }

    function overlapAABB(world, def) {
      def = def || {};
      var lower = readFiniteVec2(def.lowerBound || def.lower, 0, 0, "aabb.lowerBound");
      var upper = readFiniteVec2(def.upperBound || def.upper, 0, 0, "aabb.upperBound");
      var filter = readFilter(def);
      var capacity = readPositiveInteger(def.capacity, 64, "overlapAABB.capacity");
      var ptr = Module._malloc(capacity * Int32Array.BYTES_PER_ELEMENT);

      try {
        var count = Module._b2js_world_overlap_aabb(
          handleValue(world, "world"),
          lower.x,
          lower.y,
          upper.x,
          upper.y,
          filter.categoryBits,
          filter.maskBits,
          ptr,
          capacity
        );
        var handles = Module.HEAP32.subarray(ptr >> 2, (ptr >> 2) + count);
        var results = [];
        for (var i = 0; i < count; ++i) {
          results.push(makeOptionalHandle("shape", handles[i]));
        }
        return results;
      } finally {
        Module._free(ptr);
      }
    }

    function readPairEvents(world, countName, fillName, firstName, secondName) {
      var worldHandle = handleValue(world, "world");
      var count = Module[countName](worldHandle);
      if (count <= 0) {
        return [];
      }

      var ptr = Module._malloc(count * 2 * Int32Array.BYTES_PER_ELEMENT);
      try {
        var filled = Module[fillName](worldHandle, ptr, count);
        var handles = Module.HEAP32.subarray(ptr >> 2, (ptr >> 2) + filled * 2);
        var events = [];
        for (var i = 0; i < filled; ++i) {
          var event = {};
          event[firstName] = makeOptionalHandle("shape", handles[i * 2]);
          event[secondName] = makeOptionalHandle("shape", handles[i * 2 + 1]);
          events.push(event);
        }
        return events;
      } finally {
        Module._free(ptr);
      }
    }

    function getBodyEvents(world) {
      var worldHandle = handleValue(world, "world");
      var count = Module._b2js_world_get_body_event_count(worldHandle);
      if (count <= 0) {
        return [];
      }

      var bodyPtr = Module._malloc(count * Int32Array.BYTES_PER_ELEMENT);
      var transformPtr = Module._malloc(count * 3 * Float32Array.BYTES_PER_ELEMENT);
      var asleepPtr = Module._malloc(count * Int32Array.BYTES_PER_ELEMENT);
      try {
        var filled = Module._b2js_world_get_body_events(worldHandle, bodyPtr, transformPtr, asleepPtr, count);
        var bodies = Module.HEAP32.subarray(bodyPtr >> 2, (bodyPtr >> 2) + filled);
        var transforms = Module.HEAPF32.subarray(transformPtr >> 2, (transformPtr >> 2) + filled * 3);
        var asleep = Module.HEAP32.subarray(asleepPtr >> 2, (asleepPtr >> 2) + filled);
        var events = [];
        for (var i = 0; i < filled; ++i) {
          events.push({
            body: makeOptionalHandle("body", bodies[i]),
            position: { x: transforms[i * 3], y: transforms[i * 3 + 1] },
            angle: transforms[i * 3 + 2],
            fellAsleep: !!asleep[i],
          });
        }
        return events;
      } finally {
        Module._free(bodyPtr);
        Module._free(transformPtr);
        Module._free(asleepPtr);
      }
    }

    function getContactHitEvents(world) {
      var worldHandle = handleValue(world, "world");
      var count = Module._b2js_world_get_contact_hit_count(worldHandle);
      if (count <= 0) {
        return [];
      }

      var shapePtr = Module._malloc(count * 2 * Int32Array.BYTES_PER_ELEMENT);
      var dataPtr = Module._malloc(count * 5 * Float32Array.BYTES_PER_ELEMENT);
      try {
        var filled = Module._b2js_world_get_contact_hit_events(worldHandle, shapePtr, dataPtr, count);
        var shapes = Module.HEAP32.subarray(shapePtr >> 2, (shapePtr >> 2) + filled * 2);
        var data = Module.HEAPF32.subarray(dataPtr >> 2, (dataPtr >> 2) + filled * 5);
        var events = [];
        for (var i = 0; i < filled; ++i) {
          events.push({
            shapeA: makeOptionalHandle("shape", shapes[i * 2]),
            shapeB: makeOptionalHandle("shape", shapes[i * 2 + 1]),
            point: { x: data[i * 5], y: data[i * 5 + 1] },
            normal: { x: data[i * 5 + 2], y: data[i * 5 + 3] },
            approachSpeed: data[i * 5 + 4],
          });
        }
        return events;
      } finally {
        Module._free(shapePtr);
        Module._free(dataPtr);
      }
    }

    function getContactEvents(world) {
      return {
        begin: readPairEvents(world, "_b2js_world_get_contact_begin_count", "_b2js_world_get_contact_begin_events", "shapeA", "shapeB"),
        end: readPairEvents(world, "_b2js_world_get_contact_end_count", "_b2js_world_get_contact_end_events", "shapeA", "shapeB"),
        hit: getContactHitEvents(world),
      };
    }

    function getSensorEvents(world) {
      return {
        begin: readPairEvents(world, "_b2js_world_get_sensor_begin_count", "_b2js_world_get_sensor_begin_events", "sensor", "visitor"),
        end: readPairEvents(world, "_b2js_world_get_sensor_end_count", "_b2js_world_get_sensor_end_events", "sensor", "visitor"),
      };
    }

    function getJointEvents(world) {
      var worldHandle = handleValue(world, "world");
      var count = Module._b2js_world_get_joint_event_count(worldHandle);
      if (count <= 0) {
        return [];
      }

      var ptr = Module._malloc(count * Int32Array.BYTES_PER_ELEMENT);
      try {
        var filled = Module._b2js_world_get_joint_events(worldHandle, ptr, count);
        var handles = Module.HEAP32.subarray(ptr >> 2, (ptr >> 2) + filled);
        var events = [];
        for (var i = 0; i < filled; ++i) {
          events.push({ joint: makeOptionalHandle("joint", handles[i]) });
        }
        return events;
      } finally {
        Module._free(ptr);
      }
    }

    function getChainSegments(chain) {
      var handle = handleValue(chain, "chain");
      var count = Module._b2js_chain_get_segment_count(handle);
      if (count <= 0) {
        return [];
      }

      var ptr = Module._malloc(count * Int32Array.BYTES_PER_ELEMENT);
      try {
        var filled = Module._b2js_chain_get_segments(handle, ptr, count);
        var handles = Module.HEAP32.subarray(ptr >> 2, (ptr >> 2) + filled);
        var segments = [];
        for (var i = 0; i < filled; ++i) {
          segments.push(makeOptionalHandle("shape", handles[i]));
        }
        return segments;
      } finally {
        Module._free(ptr);
      }
    }

    function rayCastShape(shape, def) {
      def = def || {};
      var origin = readFiniteVec2(def.origin, 0, 0, "ray.origin");
      var translation = readFiniteVec2(def.translation, 0, 0, "ray.translation");
      var maxFraction = readNonNegativeNumber(def.maxFraction, 1, "ray.maxFraction");
      var ptr = Module._malloc(6 * Float32Array.BYTES_PER_ELEMENT);

      try {
        var hit = Module._b2js_shape_raycast(
          handleValue(shape, "shape"),
          origin.x,
          origin.y,
          translation.x,
          translation.y,
          maxFraction,
          ptr
        );
        if (!hit) {
          return null;
        }

        var data = Module.HEAPF32.subarray(ptr >> 2, (ptr >> 2) + 6);
        return {
          point: { x: data[0], y: data[1] },
          normal: { x: data[2], y: data[3] },
          fraction: data[4],
          iterations: data[5],
        };
      } finally {
        Module._free(ptr);
      }
    }

    function getShapeAABB(shape) {
      var ptr = Module._malloc(4 * Float32Array.BYTES_PER_ELEMENT);
      try {
        var ok = Module._b2js_shape_get_aabb(handleValue(shape, "shape"), ptr);
        if (!ok) {
          return null;
        }

        var data = Module.HEAPF32.subarray(ptr >> 2, (ptr >> 2) + 4);
        return {
          lowerBound: { x: data[0], y: data[1] },
          upperBound: { x: data[2], y: data[3] },
        };
      } finally {
        Module._free(ptr);
      }
    }

    function readSurfaceMaterialResult(ok, floatPtr, intPtr) {
      if (!ok) {
        return null;
      }

      var floats = Module.HEAPF32.subarray(floatPtr >> 2, (floatPtr >> 2) + 4);
      var ints = Module.HEAP32.subarray(intPtr >> 2, (intPtr >> 2) + 2);
      return {
        friction: floats[0],
        restitution: floats[1],
        rollingResistance: floats[2],
        tangentSpeed: floats[3],
        userMaterialId: ints[0] >>> 0,
        customColor: ints[1] >>> 0,
      };
    }

    function getShapeSurfaceMaterial(shape) {
      var floatPtr = Module._malloc(4 * Float32Array.BYTES_PER_ELEMENT);
      var intPtr = Module._malloc(2 * Int32Array.BYTES_PER_ELEMENT);
      try {
        return readSurfaceMaterialResult(
          Module._b2js_shape_get_surface_material(handleValue(shape, "shape"), floatPtr, intPtr),
          floatPtr,
          intPtr
        );
      } finally {
        Module._free(floatPtr);
        Module._free(intPtr);
      }
    }

    function setShapeSurfaceMaterial(shape, def) {
      var material = readSurfaceMaterial(def);
      Module._b2js_shape_set_surface_material(
        handleValue(shape, "shape"),
        material.friction,
        material.restitution,
        material.rollingResistance,
        material.tangentSpeed,
        material.userMaterialId,
        material.customColor
      );
    }

    function getChainSurfaceMaterial(chain, materialIndex) {
      var floatPtr = Module._malloc(4 * Float32Array.BYTES_PER_ELEMENT);
      var intPtr = Module._malloc(2 * Int32Array.BYTES_PER_ELEMENT);
      try {
        return readSurfaceMaterialResult(
          Module._b2js_chain_get_surface_material(handleValue(chain, "chain"), Number(materialIndex || 0), floatPtr, intPtr),
          floatPtr,
          intPtr
        );
      } finally {
        Module._free(floatPtr);
        Module._free(intPtr);
      }
    }

    function setChainSurfaceMaterial(chain, materialIndex, def) {
      if (typeof materialIndex === "object") {
        var swap = def;
        def = materialIndex;
        materialIndex = swap;
      }

      var material = readSurfaceMaterial(def);
      Module._b2js_chain_set_surface_material(
        handleValue(chain, "chain"),
        Number(materialIndex || 0),
        material.friction,
        material.restitution,
        material.rollingResistance,
        material.tangentSpeed,
        material.userMaterialId,
        material.customColor
      );
    }

    var api = {
      staticBody: 0,
      kinematicBody: 1,
      dynamicBody: 2,
      module: Module,
      createWorld: createWorld,
      destroyWorld: function (world) {
        Module._b2js_destroy_world(handleValue(world, "world"));
      },
      createBody: createBody,
      destroyBody: function (body) {
        Module._b2js_destroy_body(handleValue(body, "body"));
      },
      getBodyType: function (body) {
        return Module._b2js_body_get_type(handleValue(body, "body"));
      },
      setBodyType: function (body, type) {
        type = readInteger(type, undefined, "body.type");
        if (type < api.staticBody || type > api.dynamicBody) {
          throw new RangeError("body.type must be staticBody, kinematicBody, or dynamicBody");
        }

        Module._b2js_body_set_type(handleValue(body, "body"), type);
      },
      setBodyTransform: function (body, def) {
        def = def || {};
        var position = readFiniteVec2(def.position, 0, 0, "body.position");
        Module._b2js_body_set_transform(handleValue(body, "body"), position.x, position.y, readFiniteNumber(def.angle, 0, "body.angle"));
      },
      setBodyVelocity: function (body, def) {
        def = def || {};
        var velocity = readFiniteVec2(def.linearVelocity || def.velocity, 0, 0, "body.linearVelocity");
        Module._b2js_body_set_velocity(
          handleValue(body, "body"),
          velocity.x,
          velocity.y,
          readFiniteNumber(def.angularVelocity, 0, "body.angularVelocity")
        );
      },
      setBodyLinearVelocity: function (body, velocity) {
        velocity = readFiniteVec2(velocity, 0, 0, "body.linearVelocity");
        Module._b2js_body_set_linear_velocity(handleValue(body, "body"), velocity.x, velocity.y);
      },
      setBodyAngularVelocity: function (body, angularVelocity) {
        Module._b2js_body_set_angular_velocity(
          handleValue(body, "body"),
          readFiniteNumber(angularVelocity, undefined, "body.angularVelocity")
        );
      },
      getBodyAngularVelocity: function (body) {
        return Module._b2js_body_get_angular_velocity(handleValue(body, "body"));
      },
      applyForce: function (body, force, point, wake) {
        force = readFiniteVec2(force, 0, 0, "force");
        point = readFiniteVec2(point, 0, 0, "point");
        Module._b2js_body_apply_force(handleValue(body, "body"), force.x, force.y, point.x, point.y, wake === false ? 0 : 1);
      },
      applyForceToCenter: function (body, force, wake) {
        force = readFiniteVec2(force, 0, 0, "force");
        Module._b2js_body_apply_force_to_center(handleValue(body, "body"), force.x, force.y, wake === false ? 0 : 1);
      },
      applyTorque: function (body, torque, wake) {
        Module._b2js_body_apply_torque(handleValue(body, "body"), readFiniteNumber(torque, undefined, "torque"), wake === false ? 0 : 1);
      },
      applyLinearImpulse: function (body, impulse, point, wake) {
        impulse = readFiniteVec2(impulse, 0, 0, "impulse");
        point = readFiniteVec2(point, 0, 0, "point");
        Module._b2js_body_apply_linear_impulse(handleValue(body, "body"), impulse.x, impulse.y, point.x, point.y, wake === false ? 0 : 1);
      },
      applyLinearImpulseToCenter: function (body, impulse, wake) {
        impulse = readFiniteVec2(impulse, 0, 0, "impulse");
        Module._b2js_body_apply_linear_impulse_to_center(handleValue(body, "body"), impulse.x, impulse.y, wake === false ? 0 : 1);
      },
      applyAngularImpulse: function (body, impulse, wake) {
        Module._b2js_body_apply_angular_impulse(
          handleValue(body, "body"),
          readFiniteNumber(impulse, undefined, "impulse"),
          wake === false ? 0 : 1
        );
      },
      setBodyAwake: function (body, awake) {
        Module._b2js_body_set_awake(handleValue(body, "body"), awake ? 1 : 0);
      },
      isBodyAwake: function (body) {
        return !!Module._b2js_body_is_awake(handleValue(body, "body"));
      },
      setBodyEnabled: function (body, enabled) {
        Module._b2js_body_set_enabled(handleValue(body, "body"), enabled ? 1 : 0);
      },
      isBodyEnabled: function (body) {
        return !!Module._b2js_body_is_enabled(handleValue(body, "body"));
      },
      setBodyBullet: function (body, bullet) {
        Module._b2js_body_set_bullet(handleValue(body, "body"), bullet ? 1 : 0);
      },
      isBodyBullet: function (body) {
        return !!Module._b2js_body_is_bullet(handleValue(body, "body"));
      },
      setBodyGravityScale: function (body, gravityScale) {
        Module._b2js_body_set_gravity_scale(handleValue(body, "body"), readFiniteNumber(gravityScale, undefined, "body.gravityScale"));
      },
      getBodyGravityScale: function (body) {
        return Module._b2js_body_get_gravity_scale(handleValue(body, "body"));
      },
      setBodyDamping: function (body, def) {
        def = def || {};
        Module._b2js_body_set_damping(
          handleValue(body, "body"),
          readNonNegativeNumber(def.linearDamping, 0, "body.linearDamping"),
          readNonNegativeNumber(def.angularDamping, 0, "body.angularDamping")
        );
      },
      getBodyDamping: function (body) {
        var handle = handleValue(body, "body");
        return {
          linearDamping: Module._b2js_body_get_linear_damping(handle),
          angularDamping: Module._b2js_body_get_angular_damping(handle),
        };
      },
      createBoxShape: createBoxShape,
      createCircleShape: createCircleShape,
      createCapsuleShape: createCapsuleShape,
      createSegmentShape: createSegmentShape,
      createPolygonShape: createPolygonShape,
      createChain: createChain,
      destroyChain: function (chain) {
        Module._b2js_destroy_chain(handleValue(chain, "chain"));
      },
      getChainSegmentCount: function (chain) {
        return Module._b2js_chain_get_segment_count(handleValue(chain, "chain"));
      },
      getChainSegments: getChainSegments,
      getChainSurfaceMaterialCount: function (chain) {
        return Module._b2js_chain_get_surface_material_count(handleValue(chain, "chain"));
      },
      getChainSurfaceMaterial: getChainSurfaceMaterial,
      setChainSurfaceMaterial: setChainSurfaceMaterial,
      destroyShape: function (shape, updateBodyMass) {
        Module._b2js_destroy_shape(handleValue(shape, "shape"), updateBodyMass === false ? 0 : 1);
      },
      circleShape: 0,
      capsuleShape: 1,
      segmentShape: 2,
      polygonShape: 3,
      chainSegmentShape: 4,
      getShapeType: function (shape) {
        return Module._b2js_shape_get_type(handleValue(shape, "shape"));
      },
      isShapeSensor: function (shape) {
        return !!Module._b2js_shape_is_sensor(handleValue(shape, "shape"));
      },
      setShapeDensity: function (shape, density, updateBodyMass) {
        Module._b2js_shape_set_density(
          handleValue(shape, "shape"),
          readNonNegativeNumber(density, undefined, "shape.density"),
          updateBodyMass === false ? 0 : 1
        );
      },
      getShapeDensity: function (shape) {
        return Module._b2js_shape_get_density(handleValue(shape, "shape"));
      },
      setShapeFriction: function (shape, friction) {
        Module._b2js_shape_set_friction(handleValue(shape, "shape"), readNonNegativeNumber(friction, undefined, "shape.friction"));
      },
      getShapeFriction: function (shape) {
        return Module._b2js_shape_get_friction(handleValue(shape, "shape"));
      },
      setShapeRestitution: function (shape, restitution) {
        Module._b2js_shape_set_restitution(
          handleValue(shape, "shape"),
          readNonNegativeNumber(restitution, undefined, "shape.restitution")
        );
      },
      getShapeRestitution: function (shape) {
        return Module._b2js_shape_get_restitution(handleValue(shape, "shape"));
      },
      setShapeSurfaceMaterial: setShapeSurfaceMaterial,
      getShapeSurfaceMaterial: getShapeSurfaceMaterial,
      setShapeUserMaterial: function (shape, userMaterialId) {
        Module._b2js_shape_set_user_material(handleValue(shape, "shape"), readUint32(userMaterialId, undefined, "shape.userMaterialId"));
      },
      getShapeUserMaterial: function (shape) {
        return Module._b2js_shape_get_user_material(handleValue(shape, "shape")) >>> 0;
      },
      setShapeFilter: function (shape, filterDef) {
        var filter = readFilter(filterDef);
        Module._b2js_shape_set_filter(handleValue(shape, "shape"), filter.categoryBits, filter.maskBits, filter.groupIndex);
      },
      getShapeFilter: function (shape) {
        var handle = handleValue(shape, "shape");
        return {
          categoryBits: Module._b2js_shape_get_category_bits(handle),
          maskBits: Module._b2js_shape_get_mask_bits(handle),
          groupIndex: Module._b2js_shape_get_group_index(handle),
        };
      },
      enableShapeSensorEvents: function (shape, enabled) {
        Module._b2js_shape_enable_sensor_events(handleValue(shape, "shape"), enabled ? 1 : 0);
      },
      areShapeSensorEventsEnabled: function (shape) {
        return !!Module._b2js_shape_are_sensor_events_enabled(handleValue(shape, "shape"));
      },
      enableShapeContactEvents: function (shape, enabled) {
        Module._b2js_shape_enable_contact_events(handleValue(shape, "shape"), enabled ? 1 : 0);
      },
      areShapeContactEventsEnabled: function (shape) {
        return !!Module._b2js_shape_are_contact_events_enabled(handleValue(shape, "shape"));
      },
      enableShapeHitEvents: function (shape, enabled) {
        Module._b2js_shape_enable_hit_events(handleValue(shape, "shape"), enabled ? 1 : 0);
      },
      areShapeHitEventsEnabled: function (shape) {
        return !!Module._b2js_shape_are_hit_events_enabled(handleValue(shape, "shape"));
      },
      testShapePoint: function (shape, point) {
        point = readFiniteVec2(point, 0, 0, "point");
        return !!Module._b2js_shape_test_point(handleValue(shape, "shape"), point.x, point.y);
      },
      rayCastShape: rayCastShape,
      getShapeAABB: getShapeAABB,
      distanceJoint: 0,
      filterJoint: 1,
      motorJoint: 2,
      prismaticJoint: 3,
      revoluteJoint: 4,
      weldJoint: 5,
      wheelJoint: 6,
      createDistanceJoint: createDistanceJoint,
      createRevoluteJoint: createRevoluteJoint,
      createFilterJoint: createFilterJoint,
      createPrismaticJoint: createPrismaticJoint,
      createWheelJoint: createWheelJoint,
      createMotorJoint: createMotorJoint,
      setRevoluteJointMotor: setRevoluteJointMotor,
      destroyJoint: function (joint, wakeAttached) {
        Module._b2js_destroy_joint(jointHandle(joint), wakeAttached === false ? 0 : 1);
      },
      getJointType: function (joint) {
        return Module._b2js_joint_get_type(jointHandle(joint));
      },
      wakeJointBodies: function (joint) {
        Module._b2js_joint_wake_bodies(jointHandle(joint));
      },
      setJointCollideConnected: function (joint, shouldCollide) {
        Module._b2js_joint_set_collide_connected(jointHandle(joint), shouldCollide ? 1 : 0);
      },
      getJointCollideConnected: function (joint) {
        return !!Module._b2js_joint_get_collide_connected(jointHandle(joint));
      },
      setJointLocalFrameA: function (joint, def) {
        var frame = readFrame(def);
        Module._b2js_joint_set_local_frame_a(jointHandle(joint), frame.x, frame.y, frame.angle);
      },
      setJointLocalFrameB: function (joint, def) {
        var frame = readFrame(def);
        Module._b2js_joint_set_local_frame_b(jointHandle(joint), frame.x, frame.y, frame.angle);
      },
      getJointLocalFrameA: function (joint) {
        return getJointLocalFrame(joint, "a");
      },
      getJointLocalFrameB: function (joint) {
        return getJointLocalFrame(joint, "b");
      },
      setJointConstraintTuning: function (joint, def) {
        def = def || {};
        Module._b2js_joint_set_constraint_tuning(
          jointHandle(joint),
          readNumber(def.hertz, 0),
          readNumber(def.dampingRatio, 0)
        );
      },
      getJointConstraintTuning: function (joint) {
        var handle = jointHandle(joint);
        return {
          hertz: Module._b2js_joint_get_constraint_hertz(handle),
          dampingRatio: Module._b2js_joint_get_constraint_damping_ratio(handle),
        };
      },
      setJointForceThreshold: function (joint, threshold) {
        Module._b2js_joint_set_force_threshold(jointHandle(joint), Number(threshold));
      },
      getJointForceThreshold: function (joint) {
        return Module._b2js_joint_get_force_threshold(jointHandle(joint));
      },
      setJointTorqueThreshold: function (joint, threshold) {
        Module._b2js_joint_set_torque_threshold(jointHandle(joint), Number(threshold));
      },
      getJointTorqueThreshold: function (joint) {
        return Module._b2js_joint_get_torque_threshold(jointHandle(joint));
      },
      getJointConstraintForce: function (joint) {
        var handle = jointHandle(joint);
        return {
          x: Module._b2js_joint_get_constraint_force_x(handle),
          y: Module._b2js_joint_get_constraint_force_y(handle),
        };
      },
      getJointConstraintTorque: function (joint) {
        return Module._b2js_joint_get_constraint_torque(jointHandle(joint));
      },
      getJointLinearSeparation: function (joint) {
        return Module._b2js_joint_get_linear_separation(jointHandle(joint));
      },
      getJointAngularSeparation: function (joint) {
        return Module._b2js_joint_get_angular_separation(jointHandle(joint));
      },
      setDistanceJointLength: function (joint, length) {
        Module._b2js_distance_joint_set_length(jointHandle(joint), Number(length));
      },
      getDistanceJointLength: function (joint) {
        return Module._b2js_distance_joint_get_length(jointHandle(joint));
      },
      enableDistanceJointSpring: function (joint, enabled) {
        Module._b2js_distance_joint_enable_spring(jointHandle(joint), enabled ? 1 : 0);
      },
      isDistanceJointSpringEnabled: function (joint) {
        return !!Module._b2js_distance_joint_is_spring_enabled(jointHandle(joint));
      },
      setDistanceJointSpringForceRange: function (joint, lowerForce, upperForce) {
        Module._b2js_distance_joint_set_spring_force_range(jointHandle(joint), Number(lowerForce), Number(upperForce));
      },
      getDistanceJointSpringForceRange: function (joint) {
        var handle = jointHandle(joint);
        return {
          lower: Module._b2js_distance_joint_get_lower_spring_force(handle),
          upper: Module._b2js_distance_joint_get_upper_spring_force(handle),
        };
      },
      setDistanceJointSpringHertz: function (joint, hertz) {
        Module._b2js_distance_joint_set_spring_hertz(jointHandle(joint), Number(hertz));
      },
      getDistanceJointSpringHertz: function (joint) {
        return Module._b2js_distance_joint_get_spring_hertz(jointHandle(joint));
      },
      setDistanceJointSpringDampingRatio: function (joint, dampingRatio) {
        Module._b2js_distance_joint_set_spring_damping_ratio(jointHandle(joint), Number(dampingRatio));
      },
      getDistanceJointSpringDampingRatio: function (joint) {
        return Module._b2js_distance_joint_get_spring_damping_ratio(jointHandle(joint));
      },
      enableDistanceJointLimit: function (joint, enabled) {
        Module._b2js_distance_joint_enable_limit(jointHandle(joint), enabled ? 1 : 0);
      },
      isDistanceJointLimitEnabled: function (joint) {
        return !!Module._b2js_distance_joint_is_limit_enabled(jointHandle(joint));
      },
      setDistanceJointLengthRange: function (joint, minLength, maxLength) {
        Module._b2js_distance_joint_set_length_range(jointHandle(joint), Number(minLength), Number(maxLength));
      },
      getDistanceJointMinLength: function (joint) {
        return Module._b2js_distance_joint_get_min_length(jointHandle(joint));
      },
      getDistanceJointMaxLength: function (joint) {
        return Module._b2js_distance_joint_get_max_length(jointHandle(joint));
      },
      getDistanceJointCurrentLength: function (joint) {
        return Module._b2js_distance_joint_get_current_length(jointHandle(joint));
      },
      enableDistanceJointMotor: function (joint, enabled) {
        Module._b2js_distance_joint_enable_motor(jointHandle(joint), enabled ? 1 : 0);
      },
      isDistanceJointMotorEnabled: function (joint) {
        return !!Module._b2js_distance_joint_is_motor_enabled(jointHandle(joint));
      },
      setDistanceJointMotorSpeed: function (joint, motorSpeed) {
        Module._b2js_distance_joint_set_motor_speed(jointHandle(joint), Number(motorSpeed));
      },
      getDistanceJointMotorSpeed: function (joint) {
        return Module._b2js_distance_joint_get_motor_speed(jointHandle(joint));
      },
      setDistanceJointMaxMotorForce: function (joint, force) {
        Module._b2js_distance_joint_set_max_motor_force(jointHandle(joint), Number(force));
      },
      getDistanceJointMaxMotorForce: function (joint) {
        return Module._b2js_distance_joint_get_max_motor_force(jointHandle(joint));
      },
      getDistanceJointMotorForce: function (joint) {
        return Module._b2js_distance_joint_get_motor_force(jointHandle(joint));
      },
      enableRevoluteJointSpring: function (joint, enabled) {
        Module._b2js_revolute_joint_enable_spring(jointHandle(joint), enabled ? 1 : 0);
      },
      isRevoluteJointSpringEnabled: function (joint) {
        return !!Module._b2js_revolute_joint_is_spring_enabled(jointHandle(joint));
      },
      setRevoluteJointSpringHertz: function (joint, hertz) {
        Module._b2js_revolute_joint_set_spring_hertz(jointHandle(joint), Number(hertz));
      },
      getRevoluteJointSpringHertz: function (joint) {
        return Module._b2js_revolute_joint_get_spring_hertz(jointHandle(joint));
      },
      setRevoluteJointSpringDampingRatio: function (joint, dampingRatio) {
        Module._b2js_revolute_joint_set_spring_damping_ratio(jointHandle(joint), Number(dampingRatio));
      },
      getRevoluteJointSpringDampingRatio: function (joint) {
        return Module._b2js_revolute_joint_get_spring_damping_ratio(jointHandle(joint));
      },
      setRevoluteJointTargetAngle: function (joint, angle) {
        Module._b2js_revolute_joint_set_target_angle(jointHandle(joint), Number(angle));
      },
      getRevoluteJointTargetAngle: function (joint) {
        return Module._b2js_revolute_joint_get_target_angle(jointHandle(joint));
      },
      getRevoluteJointAngle: function (joint) {
        return Module._b2js_revolute_joint_get_angle(jointHandle(joint));
      },
      enableRevoluteJointLimit: function (joint, enabled) {
        Module._b2js_revolute_joint_enable_limit(jointHandle(joint), enabled ? 1 : 0);
      },
      isRevoluteJointLimitEnabled: function (joint) {
        return !!Module._b2js_revolute_joint_is_limit_enabled(jointHandle(joint));
      },
      getRevoluteJointLowerLimit: function (joint) {
        return Module._b2js_revolute_joint_get_lower_limit(jointHandle(joint));
      },
      getRevoluteJointUpperLimit: function (joint) {
        return Module._b2js_revolute_joint_get_upper_limit(jointHandle(joint));
      },
      setRevoluteJointLimits: function (joint, lower, upper) {
        Module._b2js_revolute_joint_set_limits(jointHandle(joint), Number(lower), Number(upper));
      },
      enableRevoluteJointMotor: function (joint, enabled) {
        Module._b2js_revolute_joint_enable_motor(jointHandle(joint), enabled ? 1 : 0);
      },
      isRevoluteJointMotorEnabled: function (joint) {
        return !!Module._b2js_revolute_joint_is_motor_enabled(jointHandle(joint));
      },
      setRevoluteJointMotorSpeed: function (joint, motorSpeed) {
        Module._b2js_revolute_joint_set_motor_speed(jointHandle(joint), Number(motorSpeed));
      },
      getRevoluteJointMotorSpeed: function (joint) {
        return Module._b2js_revolute_joint_get_motor_speed(jointHandle(joint));
      },
      getRevoluteJointMotorTorque: function (joint) {
        return Module._b2js_revolute_joint_get_motor_torque(jointHandle(joint));
      },
      setRevoluteJointMaxMotorTorque: function (joint, torque) {
        Module._b2js_revolute_joint_set_max_motor_torque(jointHandle(joint), Number(torque));
      },
      getRevoluteJointMaxMotorTorque: function (joint) {
        return Module._b2js_revolute_joint_get_max_motor_torque(jointHandle(joint));
      },
      enablePrismaticJointSpring: function (joint, enabled) {
        Module._b2js_prismatic_joint_enable_spring(jointHandle(joint), enabled ? 1 : 0);
      },
      isPrismaticJointSpringEnabled: function (joint) {
        return !!Module._b2js_prismatic_joint_is_spring_enabled(jointHandle(joint));
      },
      setPrismaticJointSpringHertz: function (joint, hertz) {
        Module._b2js_prismatic_joint_set_spring_hertz(jointHandle(joint), Number(hertz));
      },
      getPrismaticJointSpringHertz: function (joint) {
        return Module._b2js_prismatic_joint_get_spring_hertz(jointHandle(joint));
      },
      setPrismaticJointSpringDampingRatio: function (joint, dampingRatio) {
        Module._b2js_prismatic_joint_set_spring_damping_ratio(jointHandle(joint), Number(dampingRatio));
      },
      getPrismaticJointSpringDampingRatio: function (joint) {
        return Module._b2js_prismatic_joint_get_spring_damping_ratio(jointHandle(joint));
      },
      setPrismaticJointTargetTranslation: function (joint, translation) {
        Module._b2js_prismatic_joint_set_target_translation(jointHandle(joint), Number(translation));
      },
      getPrismaticJointTargetTranslation: function (joint) {
        return Module._b2js_prismatic_joint_get_target_translation(jointHandle(joint));
      },
      enablePrismaticJointLimit: function (joint, enabled) {
        Module._b2js_prismatic_joint_enable_limit(jointHandle(joint), enabled ? 1 : 0);
      },
      isPrismaticJointLimitEnabled: function (joint) {
        return !!Module._b2js_prismatic_joint_is_limit_enabled(jointHandle(joint));
      },
      getPrismaticJointLowerLimit: function (joint) {
        return Module._b2js_prismatic_joint_get_lower_limit(jointHandle(joint));
      },
      getPrismaticJointUpperLimit: function (joint) {
        return Module._b2js_prismatic_joint_get_upper_limit(jointHandle(joint));
      },
      setPrismaticJointLimits: function (joint, lower, upper) {
        Module._b2js_prismatic_joint_set_limits(jointHandle(joint), Number(lower), Number(upper));
      },
      enablePrismaticJointMotor: function (joint, enabled) {
        Module._b2js_prismatic_joint_enable_motor(jointHandle(joint), enabled ? 1 : 0);
      },
      isPrismaticJointMotorEnabled: function (joint) {
        return !!Module._b2js_prismatic_joint_is_motor_enabled(jointHandle(joint));
      },
      setPrismaticJointMotorSpeed: function (joint, motorSpeed) {
        Module._b2js_prismatic_joint_set_motor_speed(jointHandle(joint), Number(motorSpeed));
      },
      getPrismaticJointMotorSpeed: function (joint) {
        return Module._b2js_prismatic_joint_get_motor_speed(jointHandle(joint));
      },
      setPrismaticJointMaxMotorForce: function (joint, force) {
        Module._b2js_prismatic_joint_set_max_motor_force(jointHandle(joint), Number(force));
      },
      getPrismaticJointMaxMotorForce: function (joint) {
        return Module._b2js_prismatic_joint_get_max_motor_force(jointHandle(joint));
      },
      getPrismaticJointMotorForce: function (joint) {
        return Module._b2js_prismatic_joint_get_motor_force(jointHandle(joint));
      },
      getPrismaticJointTranslation: function (joint) {
        return Module._b2js_prismatic_joint_get_translation(jointHandle(joint));
      },
      getPrismaticJointSpeed: function (joint) {
        return Module._b2js_prismatic_joint_get_speed(jointHandle(joint));
      },
      enableWheelJointSpring: function (joint, enabled) {
        Module._b2js_wheel_joint_enable_spring(jointHandle(joint), enabled ? 1 : 0);
      },
      isWheelJointSpringEnabled: function (joint) {
        return !!Module._b2js_wheel_joint_is_spring_enabled(jointHandle(joint));
      },
      setWheelJointSpringHertz: function (joint, hertz) {
        Module._b2js_wheel_joint_set_spring_hertz(jointHandle(joint), Number(hertz));
      },
      getWheelJointSpringHertz: function (joint) {
        return Module._b2js_wheel_joint_get_spring_hertz(jointHandle(joint));
      },
      setWheelJointSpringDampingRatio: function (joint, dampingRatio) {
        Module._b2js_wheel_joint_set_spring_damping_ratio(jointHandle(joint), Number(dampingRatio));
      },
      getWheelJointSpringDampingRatio: function (joint) {
        return Module._b2js_wheel_joint_get_spring_damping_ratio(jointHandle(joint));
      },
      enableWheelJointLimit: function (joint, enabled) {
        Module._b2js_wheel_joint_enable_limit(jointHandle(joint), enabled ? 1 : 0);
      },
      isWheelJointLimitEnabled: function (joint) {
        return !!Module._b2js_wheel_joint_is_limit_enabled(jointHandle(joint));
      },
      getWheelJointLowerLimit: function (joint) {
        return Module._b2js_wheel_joint_get_lower_limit(jointHandle(joint));
      },
      getWheelJointUpperLimit: function (joint) {
        return Module._b2js_wheel_joint_get_upper_limit(jointHandle(joint));
      },
      setWheelJointLimits: function (joint, lower, upper) {
        Module._b2js_wheel_joint_set_limits(jointHandle(joint), Number(lower), Number(upper));
      },
      enableWheelJointMotor: function (joint, enabled) {
        Module._b2js_wheel_joint_enable_motor(jointHandle(joint), enabled ? 1 : 0);
      },
      isWheelJointMotorEnabled: function (joint) {
        return !!Module._b2js_wheel_joint_is_motor_enabled(jointHandle(joint));
      },
      setWheelJointMotorSpeed: function (joint, motorSpeed) {
        Module._b2js_wheel_joint_set_motor_speed(jointHandle(joint), Number(motorSpeed));
      },
      getWheelJointMotorSpeed: function (joint) {
        return Module._b2js_wheel_joint_get_motor_speed(jointHandle(joint));
      },
      setWheelJointMaxMotorTorque: function (joint, torque) {
        Module._b2js_wheel_joint_set_max_motor_torque(jointHandle(joint), Number(torque));
      },
      getWheelJointMaxMotorTorque: function (joint) {
        return Module._b2js_wheel_joint_get_max_motor_torque(jointHandle(joint));
      },
      getWheelJointMotorTorque: function (joint) {
        return Module._b2js_wheel_joint_get_motor_torque(jointHandle(joint));
      },
      setMotorJointLinearVelocity: function (joint, velocity) {
        velocity = readVec2(velocity, 0, 0);
        Module._b2js_motor_joint_set_linear_velocity(jointHandle(joint), velocity.x, velocity.y);
      },
      getMotorJointLinearVelocity: function (joint) {
        var handle = jointHandle(joint);
        return {
          x: Module._b2js_motor_joint_get_linear_velocity_x(handle),
          y: Module._b2js_motor_joint_get_linear_velocity_y(handle),
        };
      },
      setMotorJointAngularVelocity: function (joint, velocity) {
        Module._b2js_motor_joint_set_angular_velocity(jointHandle(joint), Number(velocity));
      },
      getMotorJointAngularVelocity: function (joint) {
        return Module._b2js_motor_joint_get_angular_velocity(jointHandle(joint));
      },
      setMotorJointMaxVelocityForce: function (joint, force) {
        Module._b2js_motor_joint_set_max_velocity_force(jointHandle(joint), Number(force));
      },
      getMotorJointMaxVelocityForce: function (joint) {
        return Module._b2js_motor_joint_get_max_velocity_force(jointHandle(joint));
      },
      setMotorJointMaxVelocityTorque: function (joint, torque) {
        Module._b2js_motor_joint_set_max_velocity_torque(jointHandle(joint), Number(torque));
      },
      getMotorJointMaxVelocityTorque: function (joint) {
        return Module._b2js_motor_joint_get_max_velocity_torque(jointHandle(joint));
      },
      setMotorJointLinearHertz: function (joint, hertz) {
        Module._b2js_motor_joint_set_linear_hertz(jointHandle(joint), Number(hertz));
      },
      getMotorJointLinearHertz: function (joint) {
        return Module._b2js_motor_joint_get_linear_hertz(jointHandle(joint));
      },
      setMotorJointLinearDampingRatio: function (joint, dampingRatio) {
        Module._b2js_motor_joint_set_linear_damping_ratio(jointHandle(joint), Number(dampingRatio));
      },
      getMotorJointLinearDampingRatio: function (joint) {
        return Module._b2js_motor_joint_get_linear_damping_ratio(jointHandle(joint));
      },
      setMotorJointAngularHertz: function (joint, hertz) {
        Module._b2js_motor_joint_set_angular_hertz(jointHandle(joint), Number(hertz));
      },
      getMotorJointAngularHertz: function (joint) {
        return Module._b2js_motor_joint_get_angular_hertz(jointHandle(joint));
      },
      setMotorJointAngularDampingRatio: function (joint, dampingRatio) {
        Module._b2js_motor_joint_set_angular_damping_ratio(jointHandle(joint), Number(dampingRatio));
      },
      getMotorJointAngularDampingRatio: function (joint) {
        return Module._b2js_motor_joint_get_angular_damping_ratio(jointHandle(joint));
      },
      setMotorJointMaxSpringForce: function (joint, force) {
        Module._b2js_motor_joint_set_max_spring_force(jointHandle(joint), Number(force));
      },
      getMotorJointMaxSpringForce: function (joint) {
        return Module._b2js_motor_joint_get_max_spring_force(jointHandle(joint));
      },
      setMotorJointMaxSpringTorque: function (joint, torque) {
        Module._b2js_motor_joint_set_max_spring_torque(jointHandle(joint), Number(torque));
      },
      getMotorJointMaxSpringTorque: function (joint) {
        return Module._b2js_motor_joint_get_max_spring_torque(jointHandle(joint));
      },
      setWorldGravity: function (world, gravity) {
        gravity = readFiniteVec2(gravity, 0, -10, "world.gravity");
        Module._b2js_world_set_gravity(handleValue(world, "world"), gravity.x, gravity.y);
      },
      getWorldGravity: function (world) {
        var handle = handleValue(world, "world");
        return {
          x: Module._b2js_world_get_gravity_x(handle),
          y: Module._b2js_world_get_gravity_y(handle),
        };
      },
      enableWorldSleeping: function (world, enabled) {
        Module._b2js_world_enable_sleeping(handleValue(world, "world"), enabled ? 1 : 0);
      },
      isWorldSleepingEnabled: function (world) {
        return !!Module._b2js_world_is_sleeping_enabled(handleValue(world, "world"));
      },
      enableWorldContinuous: function (world, enabled) {
        Module._b2js_world_enable_continuous(handleValue(world, "world"), enabled ? 1 : 0);
      },
      isWorldContinuousEnabled: function (world) {
        return !!Module._b2js_world_is_continuous_enabled(handleValue(world, "world"));
      },
      setWorldRestitutionThreshold: function (world, value) {
        Module._b2js_world_set_restitution_threshold(
          handleValue(world, "world"),
          readNonNegativeNumber(value, undefined, "world.restitutionThreshold")
        );
      },
      getWorldRestitutionThreshold: function (world) {
        return Module._b2js_world_get_restitution_threshold(handleValue(world, "world"));
      },
      setWorldHitEventThreshold: function (world, value) {
        Module._b2js_world_set_hit_event_threshold(
          handleValue(world, "world"),
          readNonNegativeNumber(value, undefined, "world.hitEventThreshold")
        );
      },
      getWorldHitEventThreshold: function (world) {
        return Module._b2js_world_get_hit_event_threshold(handleValue(world, "world"));
      },
      setWorldContactTuning: function (world, def) {
        def = def || {};
        Module._b2js_world_set_contact_tuning(
          handleValue(world, "world"),
          readNonNegativeNumber(def.hertz, 30, "world.contactHertz"),
          readNonNegativeNumber(def.dampingRatio, 10, "world.contactDampingRatio"),
          readNonNegativeNumber(def.pushSpeed, 3, "world.contactPushSpeed")
        );
      },
      setWorldContactRecycleDistance: function (world, value) {
        Module._b2js_world_set_contact_recycle_distance(
          handleValue(world, "world"),
          readNonNegativeNumber(value, undefined, "world.contactRecycleDistance")
        );
      },
      getWorldContactRecycleDistance: function (world) {
        return Module._b2js_world_get_contact_recycle_distance(handleValue(world, "world"));
      },
      setWorldMaximumLinearSpeed: function (world, value) {
        Module._b2js_world_set_maximum_linear_speed(
          handleValue(world, "world"),
          readPositiveNumber(value, undefined, "world.maximumLinearSpeed")
        );
      },
      getWorldMaximumLinearSpeed: function (world) {
        return Module._b2js_world_get_maximum_linear_speed(handleValue(world, "world"));
      },
      enableWorldWarmStarting: function (world, enabled) {
        Module._b2js_world_enable_warm_starting(handleValue(world, "world"), enabled ? 1 : 0);
      },
      isWorldWarmStartingEnabled: function (world) {
        return !!Module._b2js_world_is_warm_starting_enabled(handleValue(world, "world"));
      },
      getWorldAwakeBodyCount: function (world) {
        return Module._b2js_world_get_awake_body_count(handleValue(world, "world"));
      },
      enableWorldFrictionCallback: function (world, enabled) {
        Module._b2js_world_enable_friction_callback(handleValue(world, "world"), enabled ? 1 : 0);
      },
      enableWorldRestitutionCallback: function (world, enabled) {
        Module._b2js_world_enable_restitution_callback(handleValue(world, "world"), enabled ? 1 : 0);
      },
      clearFrictionMixRules: function () {
        Module._b2js_clear_friction_mix_rules();
      },
      addFrictionMixRule: function (materialA, materialB, friction) {
        return !!Module._b2js_add_friction_mix_rule(
          readUint32(materialA, undefined, "materialA"),
          readUint32(materialB, undefined, "materialB"),
          readNonNegativeNumber(friction, undefined, "friction")
        );
      },
      clearRestitutionMixRules: function () {
        Module._b2js_clear_restitution_mix_rules();
      },
      addRestitutionMixRule: function (materialA, materialB, restitution) {
        return !!Module._b2js_add_restitution_mix_rule(
          readUint32(materialA, undefined, "materialA"),
          readUint32(materialB, undefined, "materialB"),
          readNonNegativeNumber(restitution, undefined, "restitution")
        );
      },
      castRayClosest: castRayClosest,
      overlapAABB: overlapAABB,
      getBodyEvents: getBodyEvents,
      getContactEvents: getContactEvents,
      getSensorEvents: getSensorEvents,
      getJointEvents: getJointEvents,
      step: step,
      getBodyPosition: getBodyPosition,
      getBodyVelocity: getBodyVelocity,
      getBodyTransform: getBodyTransform,
      getBodyMass: function (body) {
        return Module._b2js_body_get_mass(handleValue(body, "body"));
      },
      readBodyTransforms: readBodyTransforms,
    };

    return api;
  }

  Box2D.default = Box2D;
  return Box2D;
});
