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
  const t = svgEl("text");
  t.setAttribute("x", x);
  t.setAttribute("y", y);
  t.setAttribute("class", className);
  t.textContent = text;
  return t;
}
