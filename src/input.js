// src/input.js

import { bindGameplayInput } from "./input/inputGameplay.js";
import { snapFocusToActiveMech, snapFocusToActiveUnit } from "./input/inputFocus.js";

export { snapFocusToActiveMech, snapFocusToActiveUnit };

export function bindInput(state, refs, actions) {
  bindGameplayInput(state, refs, actions);
}
