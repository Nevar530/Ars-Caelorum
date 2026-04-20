// src/input.js

import { bindEditorInput } from "./input/inputEditor.js";
import { bindGameplayInput } from "./input/inputGameplay.js";
import { snapFocusToActiveMech, snapFocusToActiveUnit } from "./input/inputFocus.js";

export { snapFocusToActiveMech, snapFocusToActiveUnit };

export function bindInput(state, refs, actions) {
  bindEditorInput(state, refs, actions);
  bindGameplayInput(state, refs, actions);
}
