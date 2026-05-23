(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SmartCarsSimulation = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

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

  return {
    createRunConfig: createRunConfig,
    deriveVehicleTelemetry: deriveVehicleTelemetry,
  };
});
