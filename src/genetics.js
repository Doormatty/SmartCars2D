(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SmartCarsGenetics = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function getSchemaKeys(schema) {
    return Object.keys(schema || {});
  }

  function getDefaultNormal(schemaProp) {
    if (Number.isFinite(schemaProp.defaultNormal)) {
      return clamp(schemaProp.defaultNormal, 0, 1);
    }
    return 0.5;
  }

  function normalizeGeneValues(schemaProp, sourceValues) {
    let length = Number.isInteger(schemaProp.length) && schemaProp.length > 0 ? schemaProp.length : 0;
    let values = new Array(length);
    for (let i = 0; i < length; i++) {
      let sourceValue = sourceValues && Number.isFinite(sourceValues[i]) ? sourceValues[i] : getDefaultNormal(schemaProp);
      values[i] = clamp(sourceValue, 0, 1);
    }
    return values;
  }

  function normalizeGenomeForComparison(schema, source) {
    let clone = {};
    let keys = getSchemaKeys(schema);
    for (let i = 0; i < keys.length; i++) {
      let key = keys[i];
      clone[key] = normalizeGeneValues(schema[key], source && source[key]);
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
      let length = Number.isInteger(schemaProp.length) ? schemaProp.length : 0;
      let leftValues = left[key] || [];
      let rightValues = right[key] || [];
      for (let valueIndex = 0; valueIndex < length; valueIndex++) {
        let fallback = getDefaultNormal(schemaProp);
        let leftValue = Number.isFinite(leftValues[valueIndex]) ? leftValues[valueIndex] : fallback;
        let rightValue = Number.isFinite(rightValues[valueIndex]) ? rightValues[valueIndex] : fallback;
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
        pairCount: 0,
      };
    }

    let genomes = generation.map(function (genome) {
      return normalizeGenomeForComparison(schema, genome);
    });
    let nearestDistances = genomes.map(function () { return Infinity; });
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
      pairCount: pairCount,
    };
  }

  function describeEvolution(config, summary, diversity) {
    config = config || {};
    summary = summary || {};
    diversity = diversity || summary.diversity || {};
    return {
      mutationRate: parseNumber(config.gen_mutation, 0),
      mutationSize: parseNumber(config.mutation_range, 0),
      eliteClones: parseInteger(config.championLength, 0),
      randomImmigrantRate: parseNumber(config.randomImmigrantRate, 0),
      finishRate: parseNumber(summary.finishRate, 0),
      averageScore: parseNumber(summary.averageScore, 0),
      diversityAverage: parseNumber(diversity.averageDistance, 0),
      diversityNearest: parseNumber(diversity.nearestDistance, 0),
      diversityMax: parseNumber(diversity.maxDistance, 0),
    };
  }

  function parseNumber(value, fallback) {
    let parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function parseInteger(value, fallback) {
    let parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  return {
    describeEvolution: describeEvolution,
    getGenomeDistance: getGenomeDistance,
    measureGenomeDiversity: measureGenomeDiversity,
    normalizeGenomeForComparison: normalizeGenomeForComparison,
  };
});
