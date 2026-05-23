const assert = require("assert");

const terrain = require("../src/terrain");
const scoring = require("../src/scoring");

function testDeterministicCourse() {
  const config = {
    seed: "deterministic-seed",
    tileCount: 240,
    preset: "mountain_pass",
    difficultyRamp: 1.2,
  };
  const left = terrain.createCourse(config);
  const right = terrain.createCourse(config);
  assert.strictEqual(left.signature, right.signature);
  assert.deepStrictEqual(
    left.tiles.slice(0, 12).map(tileFingerprint),
    right.tiles.slice(0, 12).map(tileFingerprint)
  );
}

function testSectionCoverage() {
  const course = terrain.createCourse({
    seed: "coverage",
    tileCount: 257,
    preset: "grip_gauntlet",
  });
  assert.strictEqual(course.tiles.length, 257);
  assert.strictEqual(course.sections[0].startTile, 0);
  assert.strictEqual(course.sections[course.sections.length - 1].endTile, 257);
  for (let i = 1; i < course.sections.length; i++) {
    assert.strictEqual(course.sections[i - 1].endTile, course.sections[i].startTile);
  }
  assert.ok(Number.isFinite(course.finishLine));
  assert.ok(course.finishLine > 0);
}

function testNormalizedBounds() {
  const course = terrain.createCourse({
    seed: "bounds",
    tileCount: 180,
    preset: "grand_tour",
    difficultyRamp: 1.8,
  });
  for (const tile of course.tiles) {
    assert.ok(tile.friction >= 0.05 && tile.friction <= 5);
    assert.ok(tile.angle >= -80 * terrain.DEG_TO_RAD && tile.angle <= 80 * terrain.DEG_TO_RAD);
    assert.ok(tile.difficulty >= 0 && tile.difficulty <= 1.5);
    assert.ok(tile.elevation >= course.heightRange.min - 1e-9);
    assert.ok(tile.elevation <= course.heightRange.max + 1e-9);
    assert.ok(tile.sectionIndex >= 0 && tile.sectionIndex < course.sections.length);
  }
}

function testFinishedScoringRanksAboveComparableDistance() {
  const course = terrain.createCourse({ seed: "score", tileCount: 160 });
  const constants = {
    finishLine: course.finishLine,
    courseStartX: course.startX,
    course: course,
    courseProgress: terrain.getProgress,
    box2dfps: 60,
    max_idle_timer: 600,
    max_run_frames: 4500,
  };
  const nonFinished = {
    frames: 1200,
    idle_timer: 0,
    maxPositionx: course.finishLine - 0.5,
    maxPositiony: 3,
    minPositiony: -1,
    bestCompletion: 0.99,
    bestSectionIndex: course.sections.length - 1,
    bestSectionProgress: 0.9,
    failureReason: "stalled",
  };
  const finished = Object.assign({}, nonFinished, {
    idle_timer: 200,
    maxPositionx: course.finishLine - 0.6,
    failureReason: "finished",
  });
  assert.ok(scoring.calculateScore(finished, constants).v > scoring.calculateScore(nonFinished, constants).v);
}

function testLegacyMigration() {
  const migrated = terrain.normalizeCourseConfig(terrain.migrateTerrainSettings({
    seed: "legacy",
    maxFloorTiles: 312,
    terrain: {
      maxAngle: 55 * terrain.DEG_TO_RAD,
      noise: 0.12,
      heightBias: 0.08,
      frictionMin: 0.4,
      frictionMax: 1.8,
      frictionNoise: 0.3,
      difficultyRamp: 1.4,
    },
  }));
  const course = terrain.createCourse(migrated);
  assert.strictEqual(migrated.seed, "legacy");
  assert.strictEqual(migrated.tileCount, 312);
  assert.ok(migrated.sections.length >= 4);
  assert.strictEqual(course.tiles.length, 312);
  assert.ok(course.frictionRange.min >= 0.05);
  assert.ok(course.frictionRange.max <= 5);
}

function tileFingerprint(tile) {
  return {
    sectionId: tile.sectionId,
    friction: round(tile.friction),
    angle: round(tile.angle),
    elevation: round(tile.elevation),
    endX: round(tile.worldVertices[3].x),
    endY: round(tile.worldVertices[3].y),
  };
}

function round(value) {
  return Math.round(value * 1000000) / 1000000;
}

const tests = [
  testDeterministicCourse,
  testSectionCoverage,
  testNormalizedBounds,
  testFinishedScoringRanksAboveComparableDistance,
  testLegacyMigration,
];

for (const test of tests) {
  test();
  console.log("ok", test.name);
}
