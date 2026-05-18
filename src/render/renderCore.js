// src/render/renderCore.js

import { getReachableTiles } from "../movement.js";
import { drawIsoStatusPlate } from "./renderUnits.js";
import {
  drawSceneMoveOverlay,
  drawScenePathOverlayForTile,
  drawSceneActionOverlayForTile,
  drawSceneDeploymentOverlayForTile,
  drawSceneFocusOverlayForTile,
  drawSceneActiveUnitOverlay
} from "./renderOverlays.js";
import {
  ensureCameraState,
  updateCameraFraming
} from "./projection.js";
import { drawSceneLosPreview } from "./renderLosOverlay.js";
import { buildTerrainSceneItems, buildMapEdgeSceneItems, buildStructureSceneItems, buildUnitSceneItems } from "./renderSceneBuilders.js";
import { buildTileOverlayStyleMap } from "./renderTileStyles.js";
import { compareSceneItems } from "./renderSceneMath.js";

export function renderAll(state, refs) {
  ensureCameraState(state);
  updateCameraFraming(state, refs);
  renderIso(state, refs);
}

export function renderIso(state, refs) {
  const { worldScene, worldUi } = refs;
  const { map } = state;

  worldScene.innerHTML = "";
  worldUi.innerHTML = "";

  const reachableMap = new Map();

  if (state.ui.mode === "move") {
    for (const tile of getReachableTiles(state)) {
      reachableMap.set(`${tile.x},${tile.y}`, tile);
    }
  }

  const tileOverlayStyleMap = buildTileOverlayStyleMap(state, reachableMap);
  const { terrainSceneItems, overlayTileItems } = buildTerrainSceneItems(state, reachableMap, tileOverlayStyleMap);
  const { mapEdgeSceneItems } = buildMapEdgeSceneItems(state);
  const { structureSceneItems } = buildStructureSceneItems(state);
  const { unitSceneItems, unitStatusTagItems } = buildUnitSceneItems(state);

  const mainSceneItems = [...terrainSceneItems, ...mapEdgeSceneItems, ...structureSceneItems, ...unitSceneItems];
  mainSceneItems.sort(compareSceneItems);

  for (const item of mainSceneItems) {
    item.render(worldScene);
  }

  for (const item of overlayTileItems) {
    if (state.ui.mode === "move" && item.reachableCost !== null) {
      drawSceneMoveOverlay(state, item, worldScene, String(item.reachableCost), {
        drawShapes: true,
        drawLabels: false
      });
    }

    drawScenePathOverlayForTile(state, item, worldScene, {
      drawShapes: true,
      drawLabels: false
    });

    drawSceneActionOverlayForTile(state, item, worldScene, {
      drawShapes: true,
      drawLabels: false
    });

    drawSceneDeploymentOverlayForTile(state, item, worldScene, {
      drawShapes: true,
      drawLabels: false
    });

    drawSceneFocusOverlayForTile(state, item, worldScene, {
      drawShapes: true,
      drawLabels: false
    });
  }

  drawSceneActiveUnitOverlay(state, worldUi);
  drawSceneLosPreview(state, worldUi);

  for (const item of unitStatusTagItems) {
    drawIsoStatusPlate(worldUi, item.unit, item.x, item.y);
  }
}
