export function createState({
  map,
  mechs = [],
  rotation = 0,
  content = { mechs: [], weapons: [], sigils: [] }
}) {
  return {
    map,
    mechs,
    rotation,
    content,
    selection: {
      mechId: null,
      tile: null
    },
    hover: {
      tile: null
    }
  };
}
