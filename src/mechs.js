export function instantiateTestMechs(content) {
  const heroDefinition =
    content.mechs.find((mech) => mech.id === "hero_standard_01") ?? null;

  if (!heroDefinition) {
    return [];
  }

  return [
    createMechInstance(heroDefinition, {
      instanceId: "hero-1",
      x: 5,
      y: 7,
      facing: 0
    })
  ];
}

export function createMechInstance(definition, overrides = {}) {
  return {
    instanceId: overrides.instanceId ?? definition.id,
    definitionId: definition.id,
    name: definition.name,
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    facing: overrides.facing ?? 0,
    footprint: definition.footprint ?? 1,
    humanScaleSize: definition.humanScaleSize ?? 4,
    move: definition.move ?? 4,
    armor: definition.armor ?? 10,
    structure: definition.structure ?? 6,
    render: definition.render ?? {}
  };
}

export function getMechAt(mechs, x, y) {
  return mechs.find((mech) => mech.x === x && mech.y === y) ?? null;
}

export function getMechById(mechs, instanceId) {
  return mechs.find((mech) => mech.instanceId === instanceId) ?? null;
}

export function moveMechTo(mechs, instanceId, x, y) {
  const mech = getMechById(mechs, instanceId);
  if (!mech) return false;

  mech.x = x;
  mech.y = y;
  return true;
}

export function setMechFacing(mechs, instanceId, facing) {
  const mech = getMechById(mechs, instanceId);
  if (!mech) return false;

  mech.facing = ((facing % 4) + 4) % 4;
  return true;
}
