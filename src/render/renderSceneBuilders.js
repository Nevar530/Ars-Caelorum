// src/render/renderSceneBuilders.js

import {
  getMapHeight,
  getMapWidth,
  getTile,
  getDetailRenderCells,
  isDetailTileUniform,
  getTileRenderElevation
} from "../map.js";
import { renderTerrainTile } from "./renderTerrain.js";
import { getUnitRenderSceneItems } from "./renderUnits.js";
import { projectScene } from "./projection.js";
import { getTerrainDepth, getUnitRenderContext, UNIT_SORT_EPSILON } from "./renderSceneMath.js";

export function buildTerrainSceneItems(state, reachableMap = new Map()) {
  const terrainSceneItems = [];
  const overlayTileItems = [];
  const { map } = state;
  const mapWidth = getMapWidth(map);
  const mapHeight = getMapHeight(map);

  for (let y = 0; y < mapHeight; y += 1) {
    for (let x = 0; x < mapWidth; x += 1) {
      const tile = getTile(map, x, y);
      if (!tile) continue;

      const renderElevation = getTileRenderElevation(tile);
      const projected = projectScene(state, x, y, renderElevation, 1);
      const hasDetailGeometry = !isDetailTileUniform(tile);
      const reachableData = reachableMap.get(`${x},${y}`) ?? null;

      const tileItem = {
        kind: "terrain",
        sourceKind: "tile",
        x,
        y,
        elevation: renderElevation,
        terrainTypeId: tile.terrainTypeId,
        terrainSpriteId: tile.terrainSpriteId,
        movementClass: tile.movementClass,
        spawnId: tile.spawnId,
        screenX: projected.x,
        screenY: projected.y,
        reachableCost: reachableData?.cost ?? null,
        reachableData,
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
        sortKey: projected.y * 1000 + projected.x,
        render(parent) {
          if (this.skipTerrain) return;
          renderTerrainTile(state, this, parent);
        }
      };

      terrainSceneItems.push(tileItem);
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

          terrainSceneItems.push({
            kind: "terrain",
            sourceKind: "detail",
            x: cell.x,
            y: cell.y,
            elevation: cell.elevation,
            fineElevation: cell.fineElevation,
            terrainTypeId: tile.terrainTypeId,
            terrainSpriteId: tile.terrainSpriteId,
            movementClass: tile.movementClass,
            spawnId: tile.spawnId,
            size: cell.size,
            leftFaceHeight: cell.leftFaceHeight,
            rightFaceHeight: cell.rightFaceHeight,
            screenX: cellProjected.x,
            screenY: cellProjected.y,
            sortDepth: getTerrainDepth({
              size: cell.size,
              screenY: cellProjected.y,
              leftFaceHeight: cell.leftFaceHeight,
              rightFaceHeight: cell.rightFaceHeight
            }),
            sortKey: cellProjected.y * 1000 + cellProjected.x,
            render(parent) {
              renderTerrainTile(state, this, parent);
            }
          });
        }
      }
    }
  }

  return { terrainSceneItems, overlayTileItems };
}

export function buildUnitSceneItems(state) {
  const units = state.units ?? [];
  const unitSceneItems = [];
  const unitStatusTagItems = [];
  const selectedUnitId = state.selection?.unitId ?? null;
  const activeUnitId = state.turn?.activeUnitId ?? null;

  for (const unit of units) {
    const context = getUnitRenderContext(state, unit);
    if (!context) continue;

    const shouldShowStatusTag =
      state.ui?.viewMode !== "top" &&
      (unit.instanceId === selectedUnitId || unit.instanceId === activeUnitId);

    if (shouldShowStatusTag) {
      unitStatusTagItems.push({
        x: context.projectedAnchor.x,
        y: context.projectedAnchor.y,
        unit
      });
    }

    const renderModel =
      state.ui?.viewMode === "top"
        ? {
            top: {
              center: {
                x: context.renderAnchor.x,
                y: context.renderAnchor.y
              },
              logicCenter: {
                x: context.projectedCenter.x,
                y: context.projectedCenter.y
              }
            }
          }
        : {
            iso: {
              center: {
                x: context.projectedAnchor.x,
                y: context.projectedAnchor.y
              },
              logicCenter: {
                x: context.projectedCenter.x,
                y: context.projectedCenter.y
              }
            }
          };

    const isActive = unit.instanceId === activeUnitId;
    const parts = getUnitRenderSceneItems(state, unit, renderModel, isActive);

    for (const part of parts) {
      unitSceneItems.push({
        kind: "unit_part",
        sortDepth: context.footprintSortDepth + (part.sortDepth - context.renderAnchor.y),
        sortKey: (context.sortKey * 1000) + part.sortKey + UNIT_SORT_EPSILON,
        render: part.render
      });
    }
  }

  return { unitSceneItems, unitStatusTagItems };
}
