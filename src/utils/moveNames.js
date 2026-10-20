// Display names for PokeAPI move slugs ("u-turn" -> "U-turn", "double-edge" -> "Double-Edge").

// Official English names that title-casing the PokeAPI slug gets wrong (checked against PokeAPI's names).
const MOVE_NAME_OVERRIDES = new Map([
  ["vice-grip", "Vise Grip"],
  ["double-edge", "Double-Edge"],
  ["self-destruct", "Self-Destruct"],
  ["soft-boiled", "Soft-Boiled"],
  ["mud-slap", "Mud-Slap"],
  ["lock-on", "Lock-On"],
  ["will-o-wisp", "Will-O-Wisp"],
  ["wake-up-slap", "Wake-Up Slap"],
  ["u-turn", "U-turn"],
  ["x-scissor", "X-Scissor"],
  ["v-create", "V-create"],
  ["trick-or-treat", "Trick-or-Treat"],
  ["forests-curse", "Forest’s Curse"],
  ["freeze-dry", "Freeze-Dry"],
  ["topsy-turvy", "Topsy-Turvy"],
  ["kings-shield", "King’s Shield"],
  ["baby-doll-eyes", "Baby-Doll Eyes"],
  ["power-up-punch", "Power-Up Punch"],
  ["lands-wrath", "Land’s Wrath"],
  ["all-out-pummeling", "All-Out Pummeling"],
  ["savage-spin-out", "Savage Spin-Out"],
  ["never-ending-nightmare", "Never-Ending Nightmare"],
  ["soul-stealing-7-star-strike", "Soul-Stealing 7-Star Strike"],
  ["natures-madness", "Nature’s Madness"],
  ["multi-attack", "Multi-Attack"],
  ["10-000-000-volt-thunderbolt", "10,000,000 Volt Thunderbolt"],
  ["lets-snuggle-forever", "Let’s Snuggle Forever"],
]);
const LOWERCASE_WORDS = new Set(["of", "the", "or", "and", "to", "as"]);

export const titleCaseSlug = (slug) =>
  String(slug || "")
    .split("-")
    .filter(Boolean)
    .map((word, index) =>
      index > 0 && LOWERCASE_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");

/** Z-moves come as "breakneck-blitz--physical" / "--special"; both share the key "breakneck-blitz". */
export const getMoveGroupKey = (name) => String(name || "").split("--")[0];

/** "u-turn" → "U-turn", "breakneck-blitz--special" → "Breakneck Blitz (Special)" */
export const formatMoveName = (name) => {
  const [base, variant] = String(name || "").split("--");
  const label = MOVE_NAME_OVERRIDES.get(base) ?? titleCaseSlug(base);
  return variant ? `${label} (${titleCaseSlug(variant)})` : label;
};
