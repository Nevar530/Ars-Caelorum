export function createState({ map, mechs, rotation = 0 }) {
  return {
    map,
    mechs,
    rotation,
    handlers: {
      raiseTile: null,
      lowerTile: null
    }
  };
}
