export const FLOW_ACTIONS = Object.freeze({
  CONTINUE: "continue",
  RESTART: "restart",
  LOAD_MISSION: "loadMission",
  MAIN_MENU: "mainMenu",
  MISSION_SELECT: "missionSelect"
});

export function normalizeMissionCampaignFlow(flow = {}) {
  return {
    onVictory: normalizeFlowBranch(flow?.onVictory, "victory"),
    onDefeat: normalizeFlowBranch(flow?.onDefeat, "defeat")
  };
}

export function getMissionFlowBranch(missionDefinition, result) {
  const flow = normalizeMissionCampaignFlow(missionDefinition?.campaignFlow ?? {});
  return result === "defeat" ? flow.onDefeat : flow.onVictory;
}

export function normalizeFlowBranch(branch = {}, result = "victory") {
  const source = branch && typeof branch === "object" ? branch : {};
  const fallbackAction = result === "defeat" ? FLOW_ACTIONS.RESTART : FLOW_ACTIONS.CONTINUE;
  const action = normalizeFlowAction(source.action, fallbackAction);
  const loadMissionId = String(source.loadMissionId ?? "").trim();

  if (action === FLOW_ACTIONS.LOAD_MISSION || action === FLOW_ACTIONS.CONTINUE) {
    return { action, loadMissionId };
  }

  return { action };
}

export function normalizeFlowAction(value, fallback = FLOW_ACTIONS.CONTINUE) {
  const action = String(value ?? "").trim();
  return Object.values(FLOW_ACTIONS).includes(action) ? action : fallback;
}
