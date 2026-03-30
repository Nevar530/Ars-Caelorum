import { MAP_CONFIG, RENDER_CONFIG } from "./config.js";
import { getTile, rotateCoord, tileTypeFromElevation } from "./map.js";
import { svgEl, makePolygon, makeText } from "./utils.js";

export function renderAll(state, refs) {
  renderIso(state, refs);
  renderEditor(state, refs);
}

export function renderIso(state, refs) {
  const { worldGround, worldMechs, worldUi, rotationLabel } = refs;
  const { map, mechs, rotation } = state;

  worldGround.innerHTML = "";
  worldMechs.innerHTML = "";
  worldUi.innerHTML = "";

  const drawList = [];

  for (let y = 0; y < MAP_CONFIG.mechHeight; y++) {
    for (let x = 0; x < MAP_CONFIG.mechWidth; x++) {
      const tile = getTile(map, x, y);
      const rotated = rotateCoord(
        x,
        y,
        MAP_CONFIG.mechWidth,
        MAP_CONFIG.mechHeight,
        rotation
      );
      const projected = isoProject(rotated.x, rotated.y, tile.elevation);

      drawList.push({
        x,
        y,
        elevation: tile.elevation,
        tile,
        rotatedX: rotated.x,
        rotatedY: rotated.y,
        screenX: projected.x,
        screenY: projected.y,
        sortKey: (rotated.x + rotated.y) * 100 + tile.elevation
      });
    }
  }

  drawList.sort((a, b) => a.sortKey - b.sortKey);

  for (const item of drawList) {
    drawIsoTile(item, worldGround);
  }

  renderMechs(state, refs);

  rotationLabel.textContent = `Rotation: ${rotation * 90}°`;
}

export function renderEditor(state, refs) {
  const { editor } = refs;
  const { map } = state;

  editor.innerHTML = "";

  const usable = RENDER_CONFIG.editorSize - (RENDER_CONFIG.editorPadding * 2);
  const cellWidth = usable / MAP_CONFIG.mechWidth;
  const cellHeight = usable / MAP_CONFIG.mechHeight;

  for (let y = 0; y < MAP_CONFIG.mechHeight; y++) {
    for (let x = 0; x < MAP_CONFIG.mechWidth; x++) {
      const tile = getTile(map, x, y);
      const px = RENDER_CONFIG.editorPadding + (x * cellWidth);
      const py = RENDER_CONFIG.editorPadding + (y * cellHeight);

      const group = svgEl("g");

      const rect = svgEl("rect");
      rect.setAttribute("x", px);
      rect.setAttribute("y", py);
      rect.setAttribute("width", cellWidth);
      rect.setAttribute("height", cellHeight);
      rect.setAttribute("fill", editorCellColor(tile.elevation));
      rect.setAttribute("class", "editor-cell");
      rect.dataset.x = String(x);
      rect.dataset.y = String(y);

      const label = makeText(
        px + (cellWidth / 2),
        py + (cellHeight / 2),
        String(tile.elevation),
        "editor-text"
      );

      group.appendChild(rect);
      group.appendChild(label);
      editor.appendChild(group);
    }
  }
}

function renderMechs(state, refs) {
  const { worldMechs, worldUi } = refs;
  const { map, mechs, rotation } = state;

  const sortedMechs = mechs
    .map((mech) => {
      const tile = getTile(map, mech.x, mech.y);
      const rotated = rotateCoord(
        mech.x,
        mech.y,
        MAP_CONFIG.mechWidth,
        MAP_CONFIG.mechHeight,
        rotation
      );
      const projected = isoProject(rotated.x, rotated.y, tile.elevation);

      return {
        ...mech,
        elevation: tile.elevation,
        rotatedX: rotated.x,
        rotatedY: rotated.y,
        screenX: projected.x,
        screenY: projected.y,
        sortKey: (rotated.x + rotated.y) * 100 + tile.elevation + 50
      };
    })
    .sort((a, b) => a.sortKey - b.sortKey);

  for (const mech of sortedMechs) {
    drawMechFootprint(mech, worldUi);
    drawMech(mech, worldMechs);
  }
}

function isoProject(x, y, elevation) {
  const screenX =
    (x - y) * (RENDER_CONFIG.isoTileWidth / 2) + RENDER_CONFIG.originX;

  const screenY =
    (x + y) * (RENDER_CONFIG.isoTileHeight / 2) +
    RENDER_CONFIG.originY -
    (elevation * RENDER_CONFIG.elevationStepPx);

  return { x: screenX, y: screenY };
}

function drawIsoTile(item, parent) {
  const { x, y, elevation, screenX, screenY } = item;

  const type = tileTypeFromElevation(elevation);
  const colors = tileColors(type);

  const halfW = RENDER_CONFIG.isoTileWidth / 2;
  const halfH = RENDER_CONFIG.isoTileHeight / 2;
  const heightPx = elevation * RENDER_CONFIG.elevationStepPx;

  const top = {
    top: { x: screenX, y: screenY },
    right: { x: screenX + halfW, y: screenY + halfH },
    bottom: { x: screenX, y: screenY + RENDER_CONFIG.isoTileHeight },
    left: { x: screenX - halfW, y: screenY + halfH }
  };

  const leftFace = [
    top.left,
    top.bottom,
    { x: top.bottom.x, y: top.bottom.y + heightPx },
    { x: top.left.x, y: top.left.y + heightPx }
  ];

  const rightFace = [
    top.right,
    top.bottom,
    { x: top.bottom.x, y: top.bottom.y + heightPx },
    { x: top.right.x, y: top.right.y + heightPx }
  ];

  const topFace = [top.top, top.right, top.bottom, top.left];

  const group = svgEl("g");
  group.dataset.x = String(x);
  group.dataset.y = String(y);

  if (elevation > 0) {
    group.appendChild(makePolygon(leftFace, "tile-left", colors.left));
    group.appendChild(makePolygon(rightFace, "tile-right", colors.right));
  }

  group.appendChild(makePolygon(topFace, "tile-top", colors.top));
  group.appendChild(makePolygon(topFace, "tile-outline", "none"));

  if (RENDER_CONFIG.showCoords) {
    group.appendChild(
      makeText(
        screenX,
        screenY + (RENDER_CONFIG.isoTileHeight * 0.68),
        `${x},${y}:${elevation}`,
        "iso-label"
      )
    );
  }

  parent.appendChild(group);
}

function drawMech(mech, parent) {
  const group = svgEl("g");

  const shadow = svgEl("ellipse");
  shadow.setAttribute("cx", mech.screenX);
  shadow.setAttribute("cy", mech.screenY + 24);
  shadow.setAttribute("rx", 18);
  shadow.setAttribute("ry", 8);
  shadow.setAttribute("class", "mech-shadow");

  const body = svgEl("circle");
  body.setAttribute("cx", mech.screenX);
  body.setAttribute("cy", mech.screenY + 4);
  body.setAttribute("r", 14);
  body.setAttribute("class", "mech-body");

  const label = makeText(
    mech.screenX,
    mech.screenY + 8,
    mech.name,
    "mech-label"
  );

  group.appendChild(shadow);
  group.appendChild(body);
  group.appendChild(label);

  parent.appendChild(group);
}

function drawMechFootprint(mech, parent) {
  const halfW = RENDER_CONFIG.isoTileWidth / 2;
  const halfH = RENDER_CONFIG.isoTileHeight / 2;

  const footprint = [
    { x: mech.screenX, y: mech.screenY },
    { x: mech.screenX + halfW, y: mech.screenY + halfH },
    { x: mech.screenX, y: mech.screenY + RENDER_CONFIG.isoTileHeight },
    { x: mech.screenX - halfW, y: mech.screenY + halfH }
  ];

  const poly = makePolygon(
    footprint,
    "mech-footprint",
    "rgba(240,176,0,0.10)"
  );

  parent.appendChild(poly);
}

function tileColors(type) {
  switch (type) {
    case "peak":
      return {
        top: "#a08f72",
        left: "#6d5f49",
        right: "#85755c"
      };
    case "high":
      return {
        top: "#6f8b5e",
        left: "#506546",
        right: "#5e7751"
      };
    default:
      return {
        top: "#4e6b86",
        left: "#34495d",
        right: "#3e566d"
      };
  }
}

function editorCellColor(elevation) {
  if (elevation >= 5) return "#d97706";
  if (elevation >= 4) return "#b45309";
  if (elevation >= 3) return "#8b6b4a";
  if (elevation >= 2) return "#5e7751";
  if (elevation >= 1) return "#4e6b86";
  return "#243241";
}
