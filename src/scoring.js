(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SmartCarsScoring = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function getInitialState(constants) {
    return {
      frames: 0,
      idle_timer: constants.max_idle_timer,
      maxPositiony: 0,
      minPositiony: 0,
      maxPositionx: 0,
      bestCompletion: 0,
      bestSectionIndex: 0,
      bestSectionId: null,
      bestSectionName: null,
      bestSectionProgress: 0,
      failureReason: null,
    };
  }

  function updateState(constants, measurement, state) {
    if (state.idle_timer <= 0 || state.failureReason) {
      throw new Error("Already Dead");
    }
    if (hasSuccess(state, constants)) {
      throw new Error("already Finished");
    }

    let position = measurement.position;
    let velocity = measurement.velocity || { x: 0, y: 0 };
    let progress = readCourseProgress(constants, position.x);
    let nextState = {
      frames: state.frames + 1,
      idle_timer: state.idle_timer,
      maxPositionx: position.x > state.maxPositionx ? position.x : state.maxPositionx,
      maxPositiony: position.y > state.maxPositiony ? position.y : state.maxPositiony,
      minPositiony: position.y < state.minPositiony ? position.y : state.minPositiony,
      bestCompletion: Math.max(state.bestCompletion || 0, progress.completion),
      bestSectionIndex: Math.max(state.bestSectionIndex || 0, progress.sectionIndex || 0),
      bestSectionId: progress.sectionId || state.bestSectionId,
      bestSectionName: progress.sectionName || state.bestSectionName,
      bestSectionProgress: Math.max(state.bestSectionProgress || 0, progress.sectionProgress || 0),
      failureReason: null,
    };

    if (position.x > constants.finishLine) {
      nextState.idle_timer = state.idle_timer;
      nextState.failureReason = "finished";
      return nextState;
    }

    if (Number.isFinite(constants.max_run_frames) && nextState.frames >= constants.max_run_frames) {
      nextState.failureReason = "timed_out";
      return nextState;
    }

    if (Number.isFinite(constants.heightFailureY) && position.y < constants.heightFailureY) {
      nextState.failureReason = "height_failure";
      return nextState;
    }

    if (position.x > state.maxPositionx + 0.02) {
      nextState.idle_timer = constants.max_idle_timer;
      return nextState;
    }

    nextState.idle_timer = state.idle_timer - 1;
    if (Math.abs(velocity.x) < 0.001) {
      nextState.idle_timer -= 5;
    }
    if (nextState.idle_timer <= 0) {
      nextState.failureReason = "stalled";
    }
    return nextState;
  }

  function getStatus(state, constants) {
    if (hasSuccess(state, constants)) {
      return 1;
    }
    if (hasFailed(state, constants)) {
      return -1;
    }
    return 0;
  }

  function hasFailed(state, constants) {
    if (state.failureReason && state.failureReason !== "finished") {
      return true;
    }
    if (state.idle_timer <= 0) {
      return true;
    }
    if (Number.isFinite(constants.max_run_frames) && state.frames >= constants.max_run_frames) {
      return true;
    }
    return false;
  }

  function hasSuccess(state, constants) {
    return state.failureReason === "finished" || state.maxPositionx > constants.finishLine;
  }

  function calculateScore(state, constants) {
    let frames = Math.max(state.frames, 1);
    let avgspeed = (state.maxPositionx / frames) * constants.box2dfps;
    let position = state.maxPositionx;
    let progress = readCourseProgress(constants, position);
    let completion = Math.max(state.bestCompletion || 0, progress.completion || 0);
    let finishDistance = Math.max(constants.finishLine - (constants.courseStartX || -5), 1);
    let sectionIndex = Math.max(state.bestSectionIndex || 0, progress.sectionIndex || 0);
    let sectionProgress = Math.max(state.bestSectionProgress || 0, progress.sectionProgress || 0);
    let finished = hasSuccess(state, constants);
    let failureReason = finished ? "finished" : state.failureReason || (state.idle_timer <= 0 ? "stalled" : "running");
    let survivalRatio = Number.isFinite(constants.max_run_frames)
      ? clamp(frames / constants.max_run_frames, 0, 1)
      : clamp(frames / Math.max(constants.box2dfps * 20, 1), 0, 1);
    let stallPenalty = failureReason === "stalled" ? (1 - completion) * 35 : 0;
    let finishBonus = finished ? finishDistance * 2 + 500 : 0;
    let completionBonus = completion * finishDistance * 0.65;
    let sectionBonus = sectionIndex * 80 + sectionProgress * 45;
    let speedBonus = Math.max(0, avgspeed) * 12;
    let survivalBonus = survivalRatio * 20;
    let score = position + completionBonus + sectionBonus + speedBonus + survivalBonus + finishBonus - stallPenalty;

    return {
      v: score,
      s: avgspeed,
      x: position,
      y: state.maxPositiony,
      y2: state.minPositiony,
      completion: completion,
      sectionIndex: sectionIndex,
      sectionId: progress.sectionId || state.bestSectionId,
      sectionName: progress.sectionName || state.bestSectionName,
      sectionProgress: sectionProgress,
      finished: finished,
      failureReason: failureReason,
    };
  }

  function summarizeGeneration(scores, course, diversity) {
    let summary = {
      finishCount: 0,
      finishRate: 0,
      bestSectionIndex: 0,
      bestSectionName: "Launch",
      bestDistance: 0,
      averageScore: 0,
      bestScore: 0,
      diversity: diversity || null,
    };
    if (!Array.isArray(scores) || scores.length === 0) {
      return summary;
    }

    let scoreSum = 0;
    for (let i = 0; i < scores.length; i++) {
      let score = scores[i].score || scores[i];
      if (!score) {
        continue;
      }
      if (score.finished) {
        summary.finishCount++;
      }
      if (Number.isFinite(score.sectionIndex) && score.sectionIndex >= summary.bestSectionIndex) {
        summary.bestSectionIndex = score.sectionIndex;
        summary.bestSectionName = score.sectionName || getSectionName(course, score.sectionIndex);
      }
      summary.bestDistance = Math.max(summary.bestDistance, Number.isFinite(score.x) ? score.x : 0);
      summary.bestScore = Math.max(summary.bestScore, Number.isFinite(score.v) ? score.v : 0);
      scoreSum += Number.isFinite(score.v) ? score.v : 0;
    }
    summary.finishRate = summary.finishCount / scores.length;
    summary.averageScore = scoreSum / scores.length;
    return summary;
  }

  function readCourseProgress(constants, distance) {
    if (constants && constants.course && typeof constants.courseProgress === "function") {
      return constants.courseProgress(constants.course, distance);
    }
    if (constants && constants.course && typeof constants.course.getProgress === "function") {
      return constants.course.getProgress(distance);
    }
    let startX = constants && Number.isFinite(constants.courseStartX) ? constants.courseStartX : -5;
    let finishLine = constants && Number.isFinite(constants.finishLine) ? constants.finishLine : 1;
    let completion = clamp((distance - startX) / Math.max(finishLine - startX, 1), 0, 1);
    return {
      completion: completion,
      sectionIndex: 0,
      sectionId: "course",
      sectionName: "Course",
      sectionProgress: completion,
    };
  }

  function getSectionName(course, sectionIndex) {
    if (course && Array.isArray(course.sections) && course.sections[sectionIndex]) {
      return course.sections[sectionIndex].name;
    }
    return "Section " + (sectionIndex + 1);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  return {
    calculateScore: calculateScore,
    getInitialState: getInitialState,
    getStatus: getStatus,
    summarizeGeneration: summarizeGeneration,
    updateState: updateState,
  };
});
