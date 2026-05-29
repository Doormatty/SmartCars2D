(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SmartCarsSimulation = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CHASSIS_GEOMETRY_LIMITS = Object.freeze({
    freeAspectRatio: 3.25,
    severeAspectRatio: 8,
    minUsefulHeight: 0.55,
    heightRiskRange: 0.45,
    aspectDensityScale: 18,
    heightDensityScale: 650,
    maxDensityCost: 450,
  });

  function deriveVehicleTelemetry(typedDef, carInstance, constants, readBodyMass) {
    typedDef = typedDef || {};
    constants = constants || {};
    let wheels = carInstance && Array.isArray(carInstance.wheels) ? carInstance.wheels : [];
    let chassisMass = safeMass(carInstance && carInstance.chassis, readBodyMass);
    let wheelMass = 0;
    let wheelFrictionSum = 0;
    let torqueSum = 0;
    let travelSum = 0;
    let stiffnessSum = 0;
    let dampingSum = 0;

    for (let i = 0; i < wheels.length; i++) {
      let wheel = wheels[i];
      wheelMass += safeMass(wheel, readBodyMass);
      wheelFrictionSum += numberOr(wheel.friction, 0);
      if (wheel.motor) {
        torqueSum += numberOr(wheel.motor.maxMotorTorque, 0);
      }
      if (wheel.suspension) {
        travelSum += numberOr(wheel.suspension.travel, 0);
        stiffnessSum += numberOr(wheel.suspension.hertz, 0);
        dampingSum += numberOr(wheel.suspension.dampingRatio, 0);
      }
    }

    let totalMass = chassisMass + wheelMass;
    let motorPower = Array.isArray(typedDef.motor_power) ? numberOr(typedDef.motor_power[0], 0) : 0;
    let wheelCount = Math.max(wheels.length, 1);
    return {
      mass: totalMass,
      chassisMass: chassisMass,
      wheelMass: wheelMass,
      motorPower: motorPower,
      powerToWeight: totalMass > 0 ? motorPower / totalMass : 0,
      effectiveMotorTorque: torqueSum,
      wheelFrictionAverage: wheelFrictionSum / wheelCount,
      suspensionTravelAverage: travelSum / wheelCount,
      suspensionStiffnessAverage: stiffnessSum / wheelCount,
      suspensionDampingAverage: dampingSum / wheelCount,
      motorSpeed: numberOr(constants.motorSpeed, 0),
    };
  }

  function createRunConfig(overrides) {
    overrides = overrides || {};
    return {
      box2dfps: numberOr(overrides.box2dfps, 60),
      maxIdleSeconds: numberOr(overrides.maxIdleSeconds, 10),
      maxRunSeconds: numberOr(overrides.maxRunSeconds, 75),
    };
  }

  function measureChassisGeometry(vertexList) {
    let vertices = Array.isArray(vertexList) ? vertexList : [];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let twiceArea = 0;
    let maxPointDistance = 0;

    for (let i = 0; i < vertices.length; i++) {
      let point = vertices[i] || {};
      let x = numberOr(point.x, 0);
      let y = numberOr(point.y, 0);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      maxPointDistance = Math.max(maxPointDistance, Math.sqrt(x * x + y * y));

      let next = vertices[(i + 1) % vertices.length] || {};
      let nextX = numberOr(next.x, 0);
      let nextY = numberOr(next.y, 0);
      twiceArea += x * nextY - y * nextX;
    }

    if (vertices.length === 0) {
      minX = 0;
      maxX = 0;
      minY = 0;
      maxY = 0;
    }

    let width = Math.max(0, maxX - minX);
    let height = Math.max(0, maxY - minY);
    let shortAxis = Math.max(Math.min(width, height), Number.EPSILON);
    let longAxis = Math.max(width, height);
    let aspectRatio = longAxis / shortAxis;
    let thinness = clamp(
      (aspectRatio - CHASSIS_GEOMETRY_LIMITS.freeAspectRatio) /
      (CHASSIS_GEOMETRY_LIMITS.severeAspectRatio - CHASSIS_GEOMETRY_LIMITS.freeAspectRatio),
      0,
      1
    );
    let clearanceRisk = clamp(
      (CHASSIS_GEOMETRY_LIMITS.minUsefulHeight - height) /
      CHASSIS_GEOMETRY_LIMITS.heightRiskRange,
      0,
      1
    );

    return {
      width: width,
      height: height,
      area: Math.abs(twiceArea) / 2,
      aspectRatio: aspectRatio,
      thinness: thinness,
      clearanceRisk: clearanceRisk,
      groundClearanceEstimate: Math.max(0, -minY),
      mountSpread: longAxis,
      maxPointDistance: maxPointDistance,
      bounds: {
        minX: minX,
        maxX: maxX,
        minY: minY,
        maxY: maxY,
      },
    };
  }

  function calculateChassisGeometryCost(geometry) {
    geometry = geometry || {};
    let aspectRatio = numberOr(geometry.aspectRatio, 1);
    let height = numberOr(geometry.height, CHASSIS_GEOMETRY_LIMITS.minUsefulHeight);
    let aspectExcess = Math.max(0, aspectRatio - CHASSIS_GEOMETRY_LIMITS.freeAspectRatio);
    let heightDeficit = Math.max(0, CHASSIS_GEOMETRY_LIMITS.minUsefulHeight - height);
    let cost = aspectExcess * aspectExcess * CHASSIS_GEOMETRY_LIMITS.aspectDensityScale;
    cost += heightDeficit * heightDeficit * CHASSIS_GEOMETRY_LIMITS.heightDensityScale;
    return clamp(cost, 0, CHASSIS_GEOMETRY_LIMITS.maxDensityCost);
  }

  function calculateChassisMaterialProfile(geometry) {
    let risk = getChassisGeometryRisk(geometry);
    return {
      friction: 10 + risk * 12,
      restitution: Math.max(0.01, 0.08 - risk * 0.07),
      risk: risk,
    };
  }

  function calculateChassisSuspensionProfile(geometry) {
    let risk = getChassisGeometryRisk(geometry);
    return {
      travelMultiplier: 1 - risk * 0.35,
      dampingMultiplier: 1 + risk * 0.45,
      risk: risk,
    };
  }

  function getChassisGeometryRisk(geometry) {
    geometry = geometry || {};
    return clamp(Math.max(numberOr(geometry.thinness, 0), numberOr(geometry.clearanceRisk, 0)), 0, 1);
  }

  function safeMass(entity, readBodyMass) {
    if (typeof readBodyMass !== "function") {
      return 0;
    }
    let mass = readBodyMass(entity);
    return Number.isFinite(mass) ? mass : 0;
  }

  function numberOr(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  return {
    calculateChassisGeometryCost: calculateChassisGeometryCost,
    calculateChassisMaterialProfile: calculateChassisMaterialProfile,
    calculateChassisSuspensionProfile: calculateChassisSuspensionProfile,
    createRunConfig: createRunConfig,
    deriveVehicleTelemetry: deriveVehicleTelemetry,
    measureChassisGeometry: measureChassisGeometry,
  };
});
