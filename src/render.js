(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SmartCarsRender = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SECTION_COLORS = [
    "#4f8f70",
    "#5e8dbd",
    "#a5754b",
    "#9b655c",
    "#6f82a6",
    "#70805b",
  ];

  function getFloorFrictionColor(friction, range) {
    range = range || { min: 0.35, max: 1.65 };
    let span = Math.max(range.max - range.min, 0.01);
    let t = clamp((friction - range.min) / span, 0, 1);
    let red = Math.round(132 + (1 - t) * 42);
    let green = Math.round(139 + t * 36);
    let blue = Math.round(122 - t * 20);
    return "rgb(" + red + "," + green + "," + blue + ")";
  }

  function getSectionColor(section, index) {
    let colorIndex = Number.isInteger(index) ? index : section && Number.isInteger(section.index) ? section.index : 0;
    return SECTION_COLORS[colorIndex % SECTION_COLORS.length];
  }

  function getMinimapPoint(point, scale, yBase) {
    return {
      x: (point.x + 5) * scale,
      y: (-point.y + yBase) * scale,
    };
  }

  function getCoursePathPoints(course, scale, yBase) {
    if (!course || !Array.isArray(course.tiles)) {
      return [];
    }
    let points = [{ x: 0, y: yBase * scale }];
    for (let i = 0; i < course.tiles.length; i++) {
      points.push(getMinimapPoint(course.tiles[i].worldVertices[3], scale, yBase));
    }
    return points;
  }

  function getSectionRects(course, scale, yBase, height) {
    if (!course || !Array.isArray(course.sections)) {
      return [];
    }
    return course.sections.map(function (section, index) {
      let left = (section.startX + 5) * scale;
      let right = (section.endX + 5) * scale;
      return {
        x: left,
        y: 0,
        width: Math.max(right - left, 1),
        height: height,
        color: getSectionColor(section, index),
        section: section,
      };
    });
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  return {
    getCoursePathPoints: getCoursePathPoints,
    getFloorFrictionColor: getFloorFrictionColor,
    getMinimapPoint: getMinimapPoint,
    getSectionColor: getSectionColor,
    getSectionRects: getSectionRects,
  };
});
