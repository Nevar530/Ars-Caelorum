export function createTestMechs() {
  return [
    {
      id: "hero-1",
      name: "A1",
      x: 5,
      y: 7,
      size: 1,
      facing: 0
    }
  ];
}

export function getMechAt(mechs, x, y) {
  return mechs.find((mech) => mech.x === x && mech.y === y) || null;
}
