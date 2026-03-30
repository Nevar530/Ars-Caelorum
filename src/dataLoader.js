export async function loadGameData() {
  const [mechs, weapons, sigils] = await Promise.all([
    loadJson("./data/mechs.json"),
    loadJson("./data/weapons.json"),
    loadJson("./data/sigils.json")
  ]);

  return {
    mechs,
    weapons,
    sigils
  };
}

async function loadJson(path) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
