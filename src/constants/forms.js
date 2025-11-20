export const FORM_ORDER = new Map([
  ["Regional", 1],
  ["Mega", 2],
  ["Gigantamax", 3],
  ["Paradox", 4],
  ["Ultra Beast", 5],
  ["Totem", 6],
  ["Other", 99],
]);

// Per-species opt-out for showing alternate forms in the pokedex list.
// Add national dex numbers here to suppress their forms while leaving the rest visible.
// Alternate forms are shown by default - only add entries here to hide specific pokemon's alternate forms.
export const ALT_FORM_HIDE_FLAGS = new Set([
  25, // hide Pikachu's alternates
]);


