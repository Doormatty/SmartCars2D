(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SmartCarsTerrain = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TWO_PI = 2 * Math.PI;
  const DEG_TO_RAD = Math.PI / 180;
  const RAD_TO_DEG = 180 / Math.PI;

  const DEFAULT_TILE_DIMENSIONS = Object.freeze({ x: 1.5, y: 0.15 });

  const DEFAULT_SECTIONS = Object.freeze([
    Object.freeze({
      id: "launch",
      name: "Launch",
      lengthWeight: 0.08,
      slope: Object.freeze({ min: 0, max: 3, bias: 0 }),
      roughness: 0.04,
      heightBias: 0.05,
      friction: Object.freeze({ min: 1.1, max: 1.65, noise: 0.04, waves: 1 }),
      difficulty: 0.15,
    }),
    Object.freeze({
      id: "rolling",
      name: "Rolling Hills",
      lengthWeight: 0.22,
      slope: Object.freeze({ min: -13, max: 17, bias: 2 }),
      roughness: 0.18,
      heightBias: 0.06,
      friction: Object.freeze({ min: 0.82, max: 1.5, noise: 0.09, waves: 3 }),
      difficulty: 0.45,
    }),
    Object.freeze({
      id: "climb",
      name: "Climb",
      lengthWeight: 0.2,
      slope: Object.freeze({ min: 9, max: 28, bias: 9 }),
      roughness: 0.14,
      heightBias: 0.02,
      friction: Object.freeze({ min: 0.72, max: 1.35, noise: 0.08, waves: 2 }),
      difficulty: 0.68,
    }),
    Object.freeze({
      id: "rough",
      name: "Rough Traction",
      lengthWeight: 0.2,
      slope: Object.freeze({ min: -18, max: 24, bias: 0 }),
      roughness: 0.32,
      heightBias: 0.08,
      friction: Object.freeze({ min: 0.35, max: 1.15, noise: 0.22, waves: 6 }),
      difficulty: 0.82,
    }),
    Object.freeze({
      id: "descent",
      name: "Descent",
      lengthWeight: 0.18,
      slope: Object.freeze({ min: -30, max: 6, bias: -8 }),
      roughness: 0.18,
      heightBias: 0.11,
      friction: Object.freeze({ min: 0.5, max: 1.35, noise: 0.12, waves: 4 }),
      difficulty: 0.72,
    }),
    Object.freeze({
      id: "finish",
      name: "Finish",
      lengthWeight: 0.12,
      slope: Object.freeze({ min: -8, max: 10, bias: 0 }),
      roughness: 0.1,
      heightBias: 0.16,
      friction: Object.freeze({ min: 0.95, max: 1.7, noise: 0.05, waves: 1 }),
      difficulty: 0.35,
    }),
  ]);

  const COURSE_PRESETS = Object.freeze({
    grand_tour: Object.freeze({
      id: "grand_tour",
      name: "Grand Tour",
      difficultyRamp: 1,
      sections: DEFAULT_SECTIONS,
    }),
    proving_ground: Object.freeze({
      id: "proving_ground",
      name: "Proving Ground",
      difficultyRamp: 0.82,
      sections: Object.freeze([
        DEFAULT_SECTIONS[0],
        scaleSection(DEFAULT_SECTIONS[1], { difficulty: 0.8, roughness: 0.75, slope: 0.75 }),
        scaleSection(DEFAULT_SECTIONS[2], { difficulty: 0.85, roughness: 0.7, slope: 0.78 }),
        scaleSection(DEFAULT_SECTIONS[5], { lengthWeight: 0.24, difficulty: 0.75, roughness: 0.65, slope: 0.7 }),
      ]),
    }),
    grip_gauntlet: Object.freeze({
      id: "grip_gauntlet",
      name: "Grip Gauntlet",
      difficultyRamp: 1.18,
      sections: Object.freeze([
        DEFAULT_SECTIONS[0],
        scaleSection(DEFAULT_SECTIONS[1], { lengthWeight: 0.18, difficulty: 1.05, roughness: 1.05, slope: 1 }),
        scaleSection(DEFAULT_SECTIONS[3], { lengthWeight: 0.33, difficulty: 1.15, roughness: 1.2, frictionMin: 0.78 }),
        scaleSection(DEFAULT_SECTIONS[4], { lengthWeight: 0.22, difficulty: 1.05, roughness: 1.05, slope: 1 }),
        DEFAULT_SECTIONS[5],
      ]),
    }),
    mountain_pass: Object.freeze({
      id: "mountain_pass",
      name: "Mountain Pass",
      difficultyRamp: 1.3,
      sections: Object.freeze([
        DEFAULT_SECTIONS[0],
        scaleSection(DEFAULT_SECTIONS[2], { lengthWeight: 0.3, difficulty: 1.12, roughness: 1.05, slope: 1.18 }),
        scaleSection(DEFAULT_SECTIONS[3], { lengthWeight: 0.24, difficulty: 1.1, roughness: 1.05, slope: 1 }),
        scaleSection(DEFAULT_SECTIONS[4], { lengthWeight: 0.24, difficulty: 1.05, roughness: 1.05, slope: 1.1 }),
        DEFAULT_SECTIONS[5],
      ]),
    }),
  });

  const DEFAULT_COURSE_CONFIG = Object.freeze({
    seed: "abc",
    tileCount: 1024,
    tileDimensions: DEFAULT_TILE_DIMENSIONS,
    preset: "grand_tour",
    mutable: true,
    difficultyRamp: 1,
    sections: DEFAULT_SECTIONS,
  });

  function createCourse(config) {
    let normalized = normalizeCourseConfig(config);
    let rng = createSeededRandom(normalized.seed + "|" + normalized.signatureSeed);
    let sectionBounds = resolveSections(normalized);
    let tiles = new Array(normalized.tileCount);
    let dimensions = normalized.tileDimensions;
    let tilePosition = { x: -5, y: 0 };
    let angle = 0;
    let heightMin = 0;
    let heightMax = 0;
    let frictionMin = Infinity;
    let frictionMax = -Infinity;

    for (let k = 0; k < normalized.tileCount; k++) {
      let section = findSectionForTile(sectionBounds, k);
      let localSpan = Math.max(section.endTile - section.startTile, 1);
      let localProgress = (k - section.startTile) / localSpan;
      let courseProgress = normalized.tileCount > 1 ? k / (normalized.tileCount - 1) : 1;
      let difficulty = clamp(section.difficulty * difficultyAt(courseProgress, normalized.difficultyRamp), 0, 1.5);
      let desiredAngle = getSectionAngle(section, localProgress, difficulty, tilePosition.y, rng);
      let maxStep = (5 + 14 * difficulty + section.roughness * 18) * DEG_TO_RAD;
      angle += clamp(desiredAngle - angle, -maxStep, maxStep);
      angle = clamp(angle, -80 * DEG_TO_RAD, 80 * DEG_TO_RAD);

      let friction = getSectionFriction(section, localProgress, courseProgress, rng);
      let tile = createTile(dimensions, tilePosition, angle, friction);
      tile.index = k;
      tile.sectionId = section.id;
      tile.sectionName = section.name;
      tile.sectionIndex = section.index;
      tile.sectionProgress = localProgress;
      tile.courseProgress = courseProgress;
      tile.difficulty = difficulty;
      tile.elevation = tile.worldVertices[3].y;

      tiles[k] = tile;
      tilePosition = clonePoint(tile.worldVertices[3]);
      heightMin = Math.min(heightMin, tilePosition.y);
      heightMax = Math.max(heightMax, tilePosition.y);
      frictionMin = Math.min(frictionMin, friction);
      frictionMax = Math.max(frictionMax, friction);
    }

    let finishTile = tiles[tiles.length - 1];
    let finishPoint = finishTile ? finishTile.worldVertices[3] : { x: -5, y: 0 };
    let finishLine = finishPoint.x + 5;
    let course = {
      config: normalized,
      tiles: tiles,
      sections: decorateSectionWorldBounds(sectionBounds, tiles),
      finishLine: finishLine,
      startX: -5,
      heightRange: { min: heightMin, max: heightMax },
      frictionRange: {
        min: Number.isFinite(frictionMin) ? frictionMin : 0,
        max: Number.isFinite(frictionMax) ? frictionMax : 0,
      },
    };
    course.signature = createCourseSignature(course);
    return course;
  }

  function normalizeCourseConfig(source) {
    let sourceConfig = source && typeof source === "object" ? source : {};
    if (sourceConfig.terrain || sourceConfig.maxFloorTiles) {
      sourceConfig = migrateTerrainSettings(sourceConfig);
    }

    let presetId = typeof sourceConfig.preset === "string" && sourceConfig.preset
      ? sourceConfig.preset
      : DEFAULT_COURSE_CONFIG.preset;
    let preset = COURSE_PRESETS[presetId] || COURSE_PRESETS[DEFAULT_COURSE_CONFIG.preset];
    let sections = Array.isArray(sourceConfig.sections) && sourceConfig.sections.length > 0
      ? sourceConfig.sections
      : preset.sections;

    let normalized = {
      seed: stringifySeed(sourceConfig.seed, DEFAULT_COURSE_CONFIG.seed),
      tileCount: clamp(parseInteger(sourceConfig.tileCount, DEFAULT_COURSE_CONFIG.tileCount), 120, 1024),
      tileDimensions: normalizeDimensions(sourceConfig.tileDimensions || sourceConfig.tile_dimensions || DEFAULT_TILE_DIMENSIONS),
      preset: presetId,
      presetName: preset.name,
      mutable: sourceConfig.mutable !== undefined ? sourceConfig.mutable === true || sourceConfig.mutable === "1" : DEFAULT_COURSE_CONFIG.mutable,
      difficultyRamp: clamp(parseNumber(sourceConfig.difficultyRamp, preset.difficultyRamp || DEFAULT_COURSE_CONFIG.difficultyRamp), 0.2, 2.5),
      sections: sections.map(normalizeSection).filter(Boolean),
    };
    if (normalized.sections.length === 0) {
      normalized.sections = DEFAULT_SECTIONS.map(normalizeSection);
    }
    normalized.signatureSeed = JSON.stringify({
      tileCount: normalized.tileCount,
      tileDimensions: normalized.tileDimensions,
      preset: normalized.preset,
      difficultyRamp: roundStable(normalized.difficultyRamp),
      sections: normalized.sections.map(sectionSignatureData),
    });
    return normalized;
  }

  function migrateTerrainSettings(settings) {
    let source = settings && typeof settings === "object" ? settings : {};
    let terrain = source.terrain && typeof source.terrain === "object" ? source.terrain : source;
    let maxAngle = clamp(parseNumber(terrain.maxAngle, 80 * DEG_TO_RAD), 20 * DEG_TO_RAD, 80 * DEG_TO_RAD);
    let slopeScale = maxAngle / (80 * DEG_TO_RAD);
    let roughnessScale = clamp(parseNumber(terrain.noise, 0.25) / 0.25, 0, 1.5);
    let frictionMin = clamp(parseNumber(terrain.frictionMin, 0.35), 0.05, 4);
    let frictionMax = clamp(parseNumber(terrain.frictionMax, 1.65), frictionMin, 5);
    let frictionNoise = clamp(parseNumber(terrain.frictionNoise, 0.18), 0, 1);
    let heightBias = clamp(parseNumber(terrain.heightBias, 0.032), 0, 0.25);
    let sections = DEFAULT_SECTIONS.map(function (section) {
      let migrated = scaleSection(section, {
        slope: slopeScale,
        roughness: Math.max(0.15, roughnessScale),
        difficulty: clamp(parseNumber(terrain.difficultyRamp, 1), 0.3, 2),
      });
      migrated.heightBias = clamp((migrated.heightBias + heightBias) / 2, 0, 0.25);
      migrated.friction = {
        min: clamp(frictionMin + (migrated.friction.min - 0.35) * 0.25, 0.05, 5),
        max: clamp(frictionMax - (1.65 - migrated.friction.max) * 0.25, 0.05, 5),
        noise: clamp((migrated.friction.noise + frictionNoise) / 2, 0, 1),
        waves: migrated.friction.waves,
      };
      if (migrated.friction.max < migrated.friction.min) {
        migrated.friction.max = migrated.friction.min;
      }
      return migrated;
    });

    return {
      seed: stringifySeed(source.seed || source.floorseed, DEFAULT_COURSE_CONFIG.seed),
      tileCount: clamp(parseInteger(source.tileCount || source.maxFloorTiles, DEFAULT_COURSE_CONFIG.tileCount), 120, 1024),
      tileDimensions: normalizeDimensions(source.tileDimensions || DEFAULT_TILE_DIMENSIONS),
      preset: "grand_tour",
      mutable: source.mutable !== undefined ? source.mutable === true || source.mutable === "1" : DEFAULT_COURSE_CONFIG.mutable,
      difficultyRamp: clamp(parseNumber(terrain.difficultyRamp, 1), 0.2, 2.5),
      sections: sections,
    };
  }

  function resolveSections(config) {
    let totalWeight = config.sections.reduce(function (sum, section) {
      return sum + section.lengthWeight;
    }, 0);
    if (totalWeight <= 0) {
      totalWeight = 1;
    }

    let sections = [];
    let used = 0;
    for (let i = 0; i < config.sections.length; i++) {
      let section = config.sections[i];
      let rawLength = section.lengthWeight / totalWeight * config.tileCount;
      let length = i === config.sections.length - 1
        ? config.tileCount - used
        : Math.max(1, Math.floor(rawLength));
      if (used + length > config.tileCount) {
        length = config.tileCount - used;
      }
      if (length <= 0) {
        continue;
      }
      let resolved = Object.assign({}, section, {
        index: sections.length,
        startTile: used,
        endTile: used + length,
      });
      sections.push(resolved);
      used += length;
    }

    while (used < config.tileCount) {
      sections[sections.length - 1].endTile++;
      used++;
    }
    return sections;
  }

  function decorateSectionWorldBounds(sections, tiles) {
    return sections.map(function (section) {
      let firstTile = tiles[section.startTile];
      let lastTile = tiles[Math.max(section.startTile, section.endTile - 1)];
      let startPoint = firstTile ? firstTile.worldVertices[0] : { x: -5, y: 0 };
      let endPoint = lastTile ? lastTile.worldVertices[3] : startPoint;
      return Object.assign({}, section, {
        startX: startPoint.x,
        endX: endPoint.x,
        startElevation: startPoint.y,
        endElevation: endPoint.y,
      });
    });
  }

  function getSectionAngle(section, localProgress, difficulty, currentHeight, rng) {
    let slope = section.slope;
    let wave = Math.sin((localProgress + section.index * 0.17) * Math.PI);
    let rough = (rng() * 2 - 1) * section.roughness * (0.25 + difficulty);
    let desiredDegrees = lerp(slope.min, slope.max, 0.5 + wave * 0.5);
    desiredDegrees = (desiredDegrees + slope.bias) / 2;
    desiredDegrees += rough * 45;
    desiredDegrees += clamp(-currentHeight * section.heightBias, -18, 18);
    return clamp(desiredDegrees * DEG_TO_RAD, -80 * DEG_TO_RAD, 80 * DEG_TO_RAD);
  }

  function getSectionFriction(section, localProgress, courseProgress, rng) {
    let profile = section.friction;
    let wave = profile.waves <= 0
      ? 0.5
      : (Math.sin((localProgress * profile.waves + courseProgress) * TWO_PI) + 1) / 2;
    let jitter = (rng() * 2 - 1) * profile.noise;
    let blend = clamp(wave * 0.55 + localProgress * 0.25 + 0.1 + jitter, 0, 1);
    return profile.min + (profile.max - profile.min) * blend;
  }

  function createTile(dimensions, position, angle, friction) {
    let coords = [
      { x: 0, y: 0 },
      { x: 0, y: -dimensions.y },
      { x: dimensions.x, y: -dimensions.y },
      { x: dimensions.x, y: 0 },
    ];
    let vertices = rotatePoints(coords, angle);
    let worldVertices = vertices.map(function (point) {
      return {
        x: position.x + point.x,
        y: position.y + point.y,
      };
    });
    return {
      vertices: vertices,
      worldVertices: worldVertices,
      friction: friction,
      angle: angle,
    };
  }

  function rotatePoints(points, angle) {
    let cos = Math.cos(angle);
    let sin = Math.sin(angle);
    return points.map(function (point) {
      return {
        x: cos * point.x - sin * point.y,
        y: sin * point.x + cos * point.y,
      };
    });
  }

  function findSectionForTile(sections, tileIndex) {
    for (let i = 0; i < sections.length; i++) {
      if (tileIndex >= sections[i].startTile && tileIndex < sections[i].endTile) {
        return sections[i];
      }
    }
    return sections[sections.length - 1];
  }

  function getProgress(course, distance) {
    if (!course || !Array.isArray(course.sections) || course.sections.length === 0) {
      return {
        completion: 0,
        sectionIndex: 0,
        sectionId: "unknown",
        sectionName: "Unknown",
        sectionProgress: 0,
      };
    }
    let x = Number.isFinite(distance) ? distance : 0;
    let travel = Math.max(course.finishLine - course.startX, 1);
    let completion = clamp((x - course.startX) / travel, 0, 1);
    let section = course.sections[0];
    for (let i = 0; i < course.sections.length; i++) {
      if (x >= course.sections[i].startX) {
        section = course.sections[i];
      }
      if (x < course.sections[i].endX) {
        section = course.sections[i];
        break;
      }
    }
    let sectionSpan = Math.max(section.endX - section.startX, 1);
    return {
      completion: completion,
      sectionIndex: section.index,
      sectionId: section.id,
      sectionName: section.name,
      sectionProgress: clamp((x - section.startX) / sectionSpan, 0, 1),
      difficulty: section.difficulty,
    };
  }

  function createCourseSignature(course) {
    let lastTile = course.tiles[course.tiles.length - 1];
    return JSON.stringify({
      seed: course.config.seed,
      preset: course.config.preset,
      tileCount: course.tiles.length,
      finishLine: roundStable(course.finishLine),
      lastElevation: lastTile ? roundStable(lastTile.elevation) : 0,
      heightMin: roundStable(course.heightRange.min),
      heightMax: roundStable(course.heightRange.max),
      frictionMin: roundStable(course.frictionRange.min),
      frictionMax: roundStable(course.frictionRange.max),
      sections: course.sections.map(function (section) {
        return [section.id, section.startTile, section.endTile, roundStable(section.startX), roundStable(section.endX)];
      }),
    });
  }

  function sectionSignatureData(section) {
    return {
      id: section.id,
      lengthWeight: roundStable(section.lengthWeight),
      slope: {
        min: roundStable(section.slope.min),
        max: roundStable(section.slope.max),
        bias: roundStable(section.slope.bias),
      },
      roughness: roundStable(section.roughness),
      heightBias: roundStable(section.heightBias),
      friction: {
        min: roundStable(section.friction.min),
        max: roundStable(section.friction.max),
        noise: roundStable(section.friction.noise),
        waves: roundStable(section.friction.waves),
      },
      difficulty: roundStable(section.difficulty),
    };
  }

  function normalizeSection(source, index) {
    if (!source || typeof source !== "object") {
      return null;
    }
    let id = typeof source.id === "string" && source.id ? source.id : "section_" + index;
    let friction = source.friction && typeof source.friction === "object" ? source.friction : {};
    let minFriction = clamp(parseNumber(friction.min, 0.8), 0.05, 5);
    let maxFriction = clamp(parseNumber(friction.max, 1.4), minFriction, 5);
    return {
      id: id,
      name: typeof source.name === "string" && source.name ? source.name : titleize(id),
      lengthWeight: Math.max(0.01, parseNumber(source.lengthWeight, 1)),
      slope: normalizeSlope(source.slope),
      roughness: clamp(parseNumber(source.roughness, 0.15), 0, 1),
      heightBias: clamp(parseNumber(source.heightBias, 0.05), 0, 0.25),
      friction: {
        min: minFriction,
        max: maxFriction,
        noise: clamp(parseNumber(friction.noise, 0.1), 0, 1),
        waves: clamp(parseNumber(friction.waves, 1), 0, 12),
      },
      difficulty: clamp(parseNumber(source.difficulty, 0.5), 0, 1.5),
    };
  }

  function normalizeSlope(source) {
    if (typeof source === "number") {
      let value = clamp(source, -80, 80);
      return { min: value, max: value, bias: value };
    }
    source = source && typeof source === "object" ? source : {};
    let min = clamp(parseNumber(source.min, -10), -80, 80);
    let max = clamp(parseNumber(source.max, 10), -80, 80);
    if (max < min) {
      let swap = max;
      max = min;
      min = swap;
    }
    return {
      min: min,
      max: max,
      bias: clamp(parseNumber(source.bias, 0), -80, 80),
    };
  }

  function scaleSection(section, options) {
    options = options || {};
    let slopeScale = Number.isFinite(options.slope) ? options.slope : 1;
    let roughnessScale = Number.isFinite(options.roughness) ? options.roughness : 1;
    let difficultyScale = Number.isFinite(options.difficulty) ? options.difficulty : 1;
    let frictionMinScale = Number.isFinite(options.frictionMin) ? options.frictionMin : 1;
    return {
      id: section.id,
      name: section.name,
      lengthWeight: Number.isFinite(options.lengthWeight) ? options.lengthWeight : section.lengthWeight,
      slope: {
        min: clamp(section.slope.min * slopeScale, -80, 80),
        max: clamp(section.slope.max * slopeScale, -80, 80),
        bias: clamp(section.slope.bias * slopeScale, -80, 80),
      },
      roughness: clamp(section.roughness * roughnessScale, 0, 1),
      heightBias: section.heightBias,
      friction: {
        min: clamp(section.friction.min * frictionMinScale, 0.05, 5),
        max: section.friction.max,
        noise: section.friction.noise,
        waves: section.friction.waves,
      },
      difficulty: clamp(section.difficulty * difficultyScale, 0, 1.5),
    };
  }

  function difficultyAt(progress, ramp) {
    return 0.4 + smoothStep(progress * ramp) * 0.6;
  }

  function smoothStep(value) {
    let t = clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function createSeededRandom(seed) {
    let state = hashString(String(seed || "abc"));
    return function () {
      state += 0x6D2B79F5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(value) {
    let hash = 1779033703 ^ value.length;
    for (let i = 0; i < value.length; i++) {
      hash = Math.imul(hash ^ value.charCodeAt(i), 3432918353);
      hash = (hash << 13) | (hash >>> 19);
    }
    return hash >>> 0;
  }

  function normalizeDimensions(source) {
    return {
      x: clamp(parseNumber(source.x !== undefined ? source.x : source.width, DEFAULT_TILE_DIMENSIONS.x), 0.2, 5),
      y: clamp(parseNumber(source.y !== undefined ? source.y : source.height, DEFAULT_TILE_DIMENSIONS.y), 0.02, 1),
    };
  }

  function stringifySeed(value, fallback) {
    if (value === undefined || value === null || value === "") {
      return fallback;
    }
    return String(value);
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

  function lerp(a, b, t) {
    return a + (b - a) * clamp(t, 0, 1);
  }

  function clonePoint(point) {
    return { x: point.x, y: point.y };
  }

  function roundStable(value) {
    return Number.isFinite(value) ? Math.round(value * 1000000) / 1000000 : 0;
  }

  function titleize(value) {
    return String(value).replace(/[_-]+/g, " ").replace(/\b\w/g, function (letter) {
      return letter.toUpperCase();
    });
  }

  return {
    COURSE_PRESETS: COURSE_PRESETS,
    DEFAULT_COURSE_CONFIG: DEFAULT_COURSE_CONFIG,
    DEFAULT_SECTIONS: DEFAULT_SECTIONS,
    DEG_TO_RAD: DEG_TO_RAD,
    RAD_TO_DEG: RAD_TO_DEG,
    createCourse: createCourse,
    createSeededRandom: createSeededRandom,
    getProgress: getProgress,
    migrateTerrainSettings: migrateTerrainSettings,
    normalizeCourseConfig: normalizeCourseConfig,
  };
});
