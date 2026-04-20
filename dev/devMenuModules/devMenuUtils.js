let generatedDevUnitCounter = 0;

export function nextDevUnitId() {
  generatedDevUnitCounter += 1;
  return `dev_unit_${String(generatedDevUnitCounter).padStart(4, "0")}`;
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function normalizeControlType(value) {
  return value === "CPU" ? "CPU" : "PC";
}

export function normalizeTeam(value) {
  return value === "enemy" ? "enemy" : "player";
}

export function safeUpper(value) {
  return String(value ?? "").toUpperCase();
}

export function getUnitScale(unit) {
  return unit?.scale ?? unit?.unitType ?? "mech";
}

export function getUnitFootprintLabel(unit) {
  const scale = getUnitScale(unit);
  return scale === "pilot" ? "1x1" : "3x3";
}

export function getUnitDisplayName(unit) {
  const frame = unit?.name ?? "Unnamed Frame";
  const pilot = unit?.pilotName ?? "No Pilot";
  return { frame, pilot };
}

export function formatSummaryValue(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
