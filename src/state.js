export function createState({
  map,
  mechs = [],
  rotation = 0,
  content = { mechs: [], weapons: [], sigils: [] }
}) {
  const activeMechId = mechs.length > 0 ? mechs[0].instanceId : null;
  const activeMech = mechs.length > 0 ? mechs[0] : null;

  return {
    map,
    mechs,
    rotation,
    content,

    turn: {
      activeMechId,
      round: 1
    },

    selection: {
      mechId: activeMechId,
      action: null,
      targetTile: null,
      targetMechId: null
    },

    focus: {
      x: activeMech ? activeMech.x : 0,
      y: activeMech ? activeMech.y : 0
    },

    ui: {
      mode: "idle",
      previewPath: [],
      viewMode: "iso",
      facingPreview: null,
      preMove: null
    },

    camera: {
      angle: rotation * 90,
      isTurning: false
    },

    hover: {
      tile: null
    }
  };
}
