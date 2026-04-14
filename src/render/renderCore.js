// src/render/renderCore.js

import { MAP_CONFIG, RENDER_CONFIG } from "../config.js";
import {
  getTile,
  getDetailGrid,
  getDetailRenderCells,
  isDetailTileUniform,
  getTileRenderElevation,
  getTileSummary,
  formatDetailElevation
} from "../map.js";
import { getReachableTiles } from "../movement.js";
import {
  renderTerrainTile,
  renderEditorTile,
  renderEditorMiniTile,
  renderEditorDetailCell
} from "./renderTerrain.js";
import { drawMech } from "./renderUnits.js";
import {
  drawSceneMoveOverlay,
  drawScenePathOverlayForTile,
  drawSceneActionOverlayForTile,
  drawSceneFocusOverlayForTile
} from "./renderOverlays.js";
import {
  ensureCameraState,
  updateCameraFraming,
  projectScene,
  getSceneSortKey,
  TOPDOWN_CONFIG
} from "./projection.js";
import { drawSceneLosPreview } from "./renderLosOverlay.js";
import { makeText } from "../utils.js";
import {
  getUnitFootprint,
  getUnitFootprintBounds,
  getUnitCenterPoint
} from "../scale/scaleMath.js";

const OVERLAY_SORT_EPSILON = 0.35;
const UNIT_SORT_EPSILON = 0.25;

export function renderAll(state, refs) {
  ensureCameraState(state);
  updateCameraFraming(state, refs);
  renderIso(state, refs);
  renderEditor(state, refs);
  renderEditorUi(state, refs);
}

export function renderIso(state, refs) {
  const { worldScene, worldUi } = refs;
  const units = state.units ?? state.mechs ?? [];
  const { map } = state;

  worldScene.innerHTML = "";
  worldUi.innerHTML = "";

  const sceneItems = [];
  const overlayTileItems = [];
  const reachableMap = new Map();

  if (state.ui.mode === "move") {
    for (const tile of getReachableTiles(state)) {
      reachableMap.set(`${tile.x},${tile.y}`, tile.cost);
    }
  }

  for (let y = 0; y < MAP_CONFIG.height; y += 1) {
    for (let x = 0; x < MAP_CONFIG.width; x += 1) {
      const tile = getTile(map, x, y);
      if (!tile) continue;

      const renderElevation = getTileRenderElevation(tile);
      const projected = projectScene(state, x, y, renderElevation, 1);
      const hasDetailGeometry = !isDetailTileUniform(tile);

      const tileItem = {
        kind: "terrain",
        sourceKind: "tile",
        x,
        y,
        elevation: renderElevation,
        screenX: projected.x,
        screenY: projected.y,
        sortKey: getSceneSortKey(state, x, y, renderElevation, 1),
        reachableCost: reachableMap.get(`${x},${y}`) ?? null,
        skipTerrain: hasDetailGeometry,
        size: 1,
        leftFaceHeight: renderElevation,
        rightFaceHeight: renderElevation,
        sortDepth: getTerrainDepth({
          size: 1,
          screenY: projected.y,
          leftFaceHeight: renderElevation,
          rightFaceHeight: renderElevation
        }),
        render(parent) {
          if (tileItem.skipTerrain) return;
          renderTerrainTile(state, tileItem, parent);
        }
      };

      sceneItems.push(tileItem);
      overlayTileItems.push(tileItem);

      if (hasDetailGeometry) {
        const detailCells = getDetailRenderCells(map, x, y);

        for (const cell of detailCells) {
          const cellProjected = projectScene(
            state,
            cell.x,
            cell.y,
            cell.elevation,
            cell.size
          );

          sceneItems.push({
            kind: "terrain",
            sourceKind: "detail",
            x: cell.x,
            y: cell.y,
            elevation: cell.elevation,
            fineElevation: cell.fineElevation,
            size: cell.size,
            leftFaceHeight: cell.leftFaceHeight,
            rightFaceHeight: cell.rightFaceHeight,
            screenX: cellProjected.x,
            screenY: cellProjected.y,
            sortKey: getSceneSortKey(state, cell.x, cell.y, cell.elevation, cell.size),
            sortDepth: getTerrainDepth({
              size: cell.size,
              screenY: cellProjected.y,
              leftFaceHeight: cell.leftFaceHeight,
              rightFaceHeight: cell.rightFaceHeight
            }),
            render(parent) {
              renderTerrainTile(state, this, parent);
            }
          });
        }
      }
    }
  }

  for (const unit of units) {
    const footprint = getUnitFootprint(unit);
    const bounds = getUnitFootprintBounds(unit);
    const centerPoint = getUnitCenterPoint(unit);
    const anchorTile = getTile(map, unit.x, unit.y);
    if (!anchorTile) continue;

    const tileElevation = getTileRenderElevation(anchorTile);
    const projectedCenter = projectScene(
      state,
      centerPoint.x,
      centerPoint.y,
      tileElevation,
      1
    );

    const renderModel =
      state.ui?.viewMode === "top"
        ? {
            top: {
              topLeftX: TOPDOWN_CONFIG.cellSize * bounds.minX + 140 + (state.camera?.offsetX ?? 0),
              topLeftY: TOPDOWN_CONFIG.cellSize * bounds.minY + 120 + (state.camera?.offsetY ?? 0),
              widthPx: footprint.width * TOPDOWN_CONFIG.cellSize,
              heightPx: footprint.height * TOPDOWN_CONFIG.cellSize
            }
          }
        : {
            iso: {
              center: {
                x: projectedCenter.x,
                y: projectedCenter.y
              }
            }
          };

    // Sort by foot contact / front edge, not by full body height.
    // This lets front terrain draw over the unit correctly.
    const footDepth = projectedCenter.y + (footprint.height * (RENDER_CONFIG.isoTileHeight / 2));

    sceneItems.push({
      kind: "unit",
      sortDepth: footDepth + UNIT_SORT_EPSILON,
      sortKey: getSceneSortKey(
        state,
        centerPoint.x,
        centerPoint.y,
        tileElevation,
        1
      ) + UNIT_SORT_EPSILON,
      render(parent) {
        const activeUnitId = state.turn.activeUnitId ?? state.turn.activeMechId ?? null;
        const isActive = unit.instanceId === activeUnitId;
        drawMech(state, unit, renderModel, parent, isActive);
      }
    });
  }

  sceneItems.sort(compareSceneItems);

  for (const item of sceneItems) {
    item.render(worldScene);
  }

  for (const item of overlayTileItems) {
    if (state.ui.mode === "move" && item.reachableCost !== null) {
      drawSceneMoveOverlay(state, item, worldUi, String(item.reachableCost), {
        drawShapes: false,
        drawLabels: true
      });
    }

    drawScenePathOverlayForTile(state, item, worldUi, {
      drawShapes: false,
      drawLabels: true
    });

    drawSceneActionOverlayForTile(state, item, worldUi, {
      drawShapes: false,
      drawLabels: true
    });

    drawSceneFocusOverlayForTile(state, item, worldUi, {
      drawShapes: false,
      drawLabels: true
    });
  }

  drawSceneLosPreview(state, worldUi);
}

function getTerrainDepth(item) {
  const size = item.size ?? 1;
  const faceHeight = Math.max(item.leftFaceHeight ?? 0, item.rightFaceHeight ?? 0);

  return (
    item.screenY +
    (RENDER_CONFIG.isoTileHeight * size) +
    (faceHeight * RENDER_CONFIG.elevationStepPx)
  );
}

function compareSceneItems(a, b) {
  if (a.sortDepth !== b.sortDepth) {
    return a.sortDepth - b.sortDepth;
  }

  if (a.sortKey !== b.sortKey) {
    return a.sortKey - b.sortKey;
  }

  return 0;
}

export function renderEditor(state, refs) {
  const { editor } = refs;
  const { map } = state;

  editor.innerHTML = "";

  const pad = RENDER_CONFIG.editorPadding;
  const full = RENDER_CONFIG.editorSize;
  const inner = full - (pad * 2);

  if (state.ui.editor.mode === "detail") {
    renderDetailEditor(state, editor, map, pad, inner);
    return;
  }

  const cellWidth = inner / MAP_CONFIG.width;
  const cellHeight = inner / MAP_CONFIG.height;

  for (let y = 0; y < MAP_CONFIG.height; y += 1) {
    for (let x = 0; x < MAP_CONFIG.width; x += 1) {
      const tile = getTile(map, x, y);
      const isSelected =
        x === state.ui.editor.selectedTile.x &&
        y === state.ui.editor.selectedTile.y;

      renderEditorTile(
        tile,
        x,
        y,
        pad + (x * cellWidth),
        pad + (y * cellHeight),
        cellWidth,
        cellHeight,
        editor,
        { selected: isSelected }
      );
    }
  }
}

function renderDetailEditor(state, parent, map, pad, inner) {
  const selectedX = state.ui.editor.selectedTile.x;
  const selectedY = state.ui.editor.selectedTile.y;
  const selectedTile = getTile(map, selectedX, selectedY);
  const detail = getDetailGrid(selectedTile);
  const summary = getTileSummary(selectedTile);

  const miniSize = 126;
  const miniCellW = miniSize / MAP_CONFIG.width;
  const miniCellH = miniSize / MAP_CONFIG.height;

  const miniX = pad;
  const miniY = pad;

  for (let y = 0; y < MAP_CONFIG.height; y += 1) {
    for (let x = 0; x < MAP_CONFIG.width; x += 1) {
      const tile = getTile(map, x, y);
      const isSelected = x === selectedX && y === selectedY;

      renderEditorMiniTile(
        tile,
        x,
        y,
        miniX + (x * miniCellW),
        miniY + (y * miniCellH),
        miniCellW,
        miniCellH,
        parent,
        { selected: isSelected }
      );
    }
  }

  const infoX = miniX + miniSize + 16;
  const infoY = miniY + 20;

  parent.appendChild(
    makeText(infoX, infoY, `Tile ${selectedX},${selectedY}`, "editor-mode-title")
  );

  parent.appendChild(
    makeText(
      infoX,
      infoY + 22,
      `Base ${selectedTile?.elevation ?? 0} · Foot ${formatDetailElevation(summary?.mechFootFineElevation ?? 0)}`,
      "editor-mode-sub"
    )
  );

  parent.appendChild(
    makeText(
      infoX,
      infoY + 44,
      `Range ${formatDetailElevation(summary?.heightRangeFine ?? 0)} · ${summary?.mechEnterable ? "Mech Enterable" : "Mech Blocked"}`,
      "editor-mode-sub"
    )
  );

  parent.appendChild(
    makeText(
      infoX,
      infoY + 66,
      "Click map to change tile · Click big cells to edit detail",
      "editor-mode-sub"
    )
  );

  const detailBoxY = miniY + miniSize + 18;
  const detailBoxSize = inner - miniSize - 18;
  const gridSize = Math.min(detailBoxSize, inner);
  const cellSize = gridSize / detail.subdivisions;

  for (let sy = 0; sy < detail.subdivisions; sy += 1) {
    for (let sx = 0; sx < detail.subdivisions; sx += 1) {
      const detailCell = detail.cells[sy][sx];

      renderEditorDetailCell(
        detailCell,
        selectedX,
        selectedY,
        sx,
        sy,
        pad + (sx * cellSize),
        detailBoxY + (sy * cellSize),
        cellSize,
        cellSize,
        parent,
        {
          large: true
        }
      );
    }
  }
}

function renderEditorUi(state, refs) {
  if (!refs.editorModeLabel) return;

  if (state.ui.editor.mode === "detail") {
    refs.editorModeLabel.textContent =
      `Editor Mode: Detail Cells · Tile ${state.ui.editor.selectedTile.x},${state.ui.editor.selectedTile.y}`;
    return;
  }

  refs.editorModeLabel.textContent = "Editor Mode: Base Grid";
}
