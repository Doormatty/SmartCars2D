(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SmartCarsUI = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function formatNumber(value, digits) {
    if (!Number.isFinite(value)) {
      return "--";
    }
    let fixed = value.toFixed(Number.isInteger(digits) ? digits : 1);
    return fixed.replace(/\.?0+$/, "");
  }

  function formatPercent(value) {
    if (!Number.isFinite(value)) {
      return "--";
    }
    return Math.round(value * 100) + "%";
  }

  function formatDistance(value) {
    return formatNumber(value, 1) + " m";
  }

  function summarizeCourse(course) {
    if (!course) {
      return {
        label: "No course",
        distance: "--",
        elevation: "--",
        friction: "--",
      };
    }
    return {
      label: course.config.presetName || course.config.preset || "Course",
      distance: formatDistance(course.finishLine),
      elevation: formatNumber(course.heightRange.min, 1) + " / " + formatNumber(course.heightRange.max, 1),
      friction: formatNumber(course.frictionRange.min, 2) + " / " + formatNumber(course.frictionRange.max, 2),
    };
  }

  function setText(element, value) {
    if (element && element.textContent !== value) {
      element.textContent = value;
    }
  }

  return {
    formatDistance: formatDistance,
    formatNumber: formatNumber,
    formatPercent: formatPercent,
    setText: setText,
    summarizeCourse: summarizeCourse,
  };
});
