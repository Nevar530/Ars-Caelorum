export async function loadGameData() {
  const [mechs, weapons, sigils, attacks, pilots, spawnPoints] = await Promise.all([
    loadJson("./data/mechs.json"),
    loadJson("./data/weapons.json"),
    loadJson("./data/sigils.json"),
    loadJson("./data/attacks.json"),
    loadJson("./data/pilots.json"),
    loadJson("./data/spawnPoints.json")
  ]);

  return {
    mechs,
    weapons,
    sigils,
    attacks,
    pilots,
    spawnPoints
  };
}

async function loadJson(path) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
