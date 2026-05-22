export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function svgEl(tagName) {
  return document.createElementNS("http://www.w3.org/2000/svg", tagName);
}

export function makePolygon(points, className, fill) {
  const polygon = svgEl("polygon");
  polygon.setAttribute(
    "points",
    points.map((point) => `${point.x},${point.y}`).join(" ")
  );
  polygon.setAttribute("class", className);
  polygon.setAttribute("fill", fill);
  return polygon;
}

export function makeText(x, y, text, className) {
  const textEl = svgEl("text");
  textEl.setAttribute("x", x);
  textEl.setAttribute("y", y);
  textEl.setAttribute("class", className);
  textEl.textContent = text;
  return textEl;
}


export function getTileDistance(x1, y1, x2, y2) {
  return Math.max(Math.abs(Number(x2) - Number(x1)), Math.abs(Number(y2) - Number(y1)));
}
