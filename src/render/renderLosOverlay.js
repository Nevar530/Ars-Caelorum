// src/render/renderLosOverlay.js

import { getTile, getTileEffectiveElevation } from "../map.js";
import { getMechById } from "../mechs.js";
import {
  getLosHeights,
  getLosRayEndPoint,
  projectLosPoint
} from "./projection.js";
import { svgEl } from "../utils.js";

export function drawSceneLosPreview(state, parent) {
  if (state.ui.mode !== "action-target") return;

  const activeMech = getMechById(state.mechs, state.turn.activeMechId);
  const profile = state.ui.action.selectedAction;

  if (!activeMech || !profile) return;

  const focusedTarget = getFocusedEvaluatedTargetTile(state);
  if (!focusedTarget || !focusedTarget.los) return;

  const attackerTile = getTile(state.map, activeMech.x, activeMech.y);
  const targetTile = getTile(state.map, focusedTarget.x, focusedTarget.y);

  if (!attackerTile || !targetTile) return;

  const attackerScale = activeMech.scale ?? "mech";
  const targetScale = profile.scale ?? "mech";

  const attackerBaseElevation = getTileEffectiveElevation(attackerTile);
  const targetBaseElevation = getTileEffectiveElevation(targetTile);

  const attackerHeights = getLosHeights(attackerBaseElevation, attackerScale);
  const targetHeights = getLosHeights(targetBaseElevation, targetScale);

  const attackerFirePoint = projectLosPoint(
    state,
    activeMech.x,
    activeMech.y,
    attackerHeights.fire
  );

  const los = focusedTarget.los;
  const isMissile = isMissileProfile(profile);

  const chestRay = los.rays?.chest ?? { blocked: false };
  const headRay = los.rays?.head ?? { blocked: false };

  const chestEndPoint = getLosRayEndPoint(
    state,
    chestRay,
    focusedTarget.x,
    focusedTarget.y,
    targetHeights.chest
  );

  const headEndPoint = getLosRayEndPoint(
    state,
    headRay,
    focusedTarget.x,
    focusedTarget.y,
    targetHeights.head
  );

  if (isMissile) {
    const isValid = focusedTarget.visible === true;
    const missileColor = isValid ? "#52d092" : "#ff4a4a";

    let sourceFirePoint = attackerFirePoint;

    if (
      focusedTarget.missileSource === "spotter" &&
      focusedTarget.spotterPosition
    ) {
      const spotterTile = getTile(
        state.map,
        focusedTarget.spotterPosition.x,
        focusedTarget.spotterPosition.y
      );

      if (spotterTile) {
        const spotterHeights = getLosHeights(
          getTileEffectiveElevation(spotterTile),
          profile.scale ?? "mech"
        );

        sourceFirePoint = projectLosPoint(
          state,
          focusedTarget.spotterPosition.x,
          focusedTarget.spotterPosition.y,
          spotterHeights.fire
        );
      }
    }

    drawLosLine(parent, sourceFirePoint, headEndPoint, missileColor, 3.5, true);

    const arcColor = isValid ? "#ffffff" : "#111111";
    const impactPoint = projectLosPoint(
      state,
      focusedTarget.x,
      focusedTarget.y,
      targetBaseElevation
    );

    drawArcLine(parent, attackerFirePoint, impactPoint, arcColor);
    drawLosEndpoint(parent, sourceFirePoint, missileColor);
    drawLosEndpoint(parent, headEndPoint, missileColor);
    return;
  }

  let chestColor = "#52d092";
  let headColor = "#52d092";

  if (headRay.blocked) {
    chestColor = "#ff4a4a";
    headColor = "#ff4a4a";
  } else if (chestRay.blocked) {
    chestColor = "#f0b000";
    headColor = "#52d092";
  }

  drawLosLine(parent, attackerFirePoint, chestEndPoint, chestColor, 3, false);
  drawLosLine(parent, attackerFirePoint, headEndPoint, headColor, 3.5, true);

  drawLosEndpoint(parent, attackerFirePoint, headColor);
  drawLosEndpoint(parent, chestEndPoint, chestColor);
  drawLosEndpoint(parent, headEndPoint, headColor);
}

export function getFocusedEvaluatedTargetTile(state) {
  const targets = state.ui.action.evaluatedTargetTiles || [];
  return (
    targets.find((tile) => tile.x === state.focus.x && tile.y === state.focus.y) ??
    null
  );
}

export function drawLosLine(parent, from, to, color, width = 3, dashed = false) {
  const glow = svgEl("line");
  glow.setAttribute("x1", from.x);
  glow.setAttribute("y1", from.y);
  glow.setAttribute("x2", to.x);
  glow.setAttribute("y2", to.y);
  glow.setAttribute("stroke", color);
  glow.setAttribute("stroke-width", String(width + 4));
  glow.setAttribute("stroke-linecap", "round");
  glow.setAttribute("opacity", "0.18");
  if (dashed) {
    glow.setAttribute("stroke-dasharray", "8 6");
  }

  const line = svgEl("line");
  line.setAttribute("x1", from.x);
  line.setAttribute("y1", from.y);
  line.setAttribute("x2", to.x);
  line.setAttribute("y2", to.y);
  line.setAttribute("stroke", color);
  line.setAttribute("stroke-width", String(width));
  line.setAttribute("stroke-linecap", "round");
  if (dashed) {
    line.setAttribute("stroke-dasharray", "8 6");
  }

  parent.appendChild(glow);
  parent.appendChild(line);
}

export function drawArcLine(parent, from, to, color) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);

  const curveLift = Math.max(70, Math.min(150, distance * 0.45));

  const controlX = (from.x + to.x) / 2;
  const controlY = Math.min(from.y, to.y) - curveLift;

  const glow = svgEl("path");
  glow.setAttribute(
    "d",
    `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`
  );
  glow.setAttribute("fill", "none");
  glow.setAttribute("stroke", color);
  glow.setAttribute("stroke-width", "8");
  glow.setAttribute("stroke-linecap", "round");
  glow.setAttribute("stroke-dasharray", "10 7");
  glow.setAttribute("opacity", color === "#111111" ? "0.22" : "0.2");

  const path = svgEl("path");
  path.setAttribute(
    "d",
    `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`
  );
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", color);
  path.setAttribute("stroke-width", "3.5");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-dasharray", "10 7");

  parent.appendChild(glow);
  parent.appendChild(path);
}

export function drawLosEndpoint(parent, point, color) {
  const outer = svgEl("circle");
  outer.setAttribute("cx", point.x);
  outer.setAttribute("cy", point.y);
  outer.setAttribute("r", "6");
  outer.setAttribute("fill", color);
  outer.setAttribute("opacity", "0.22");

  const inner = svgEl("circle");
  inner.setAttribute("cx", point.x);
  inner.setAttribute("cy", point.y);
  inner.setAttribute("r", "2.75");
  inner.setAttribute("fill", color);

  parent.appendChild(outer);
  parent.appendChild(inner);
}

function isMissileProfile(profile) {
  return profile?.weaponType === "missile";
}
