export const NEUTRAL_NATURE_KEY = "neutral";

export const NATURE_STAT_ORDER = new Map([
  ["attack", 0],
  ["defense", 1],
  ["special-attack", 2],
  ["special-defense", 3],
  ["speed", 4],
  [NEUTRAL_NATURE_KEY, 5],
]);

export const NATURE_STAT_LABELS = new Map([
  ["attack", "Attack"],
  ["defense", "Defense"],
  ["special-attack", "Sp. Atk"],
  ["special-defense", "Sp. Def"],
  ["speed", "Speed"],
  [NEUTRAL_NATURE_KEY, "Neutral"],
]);

export const NATURE_SUMMARIES = new Map([
  ["adamant", { raises: "attack", lowers: "special-attack" }],
  ["bashful", { raises: null, lowers: null }],
  ["bold", { raises: "defense", lowers: "attack" }],
  ["brave", { raises: "attack", lowers: "speed" }],
  ["calm", { raises: "special-defense", lowers: "attack" }],
  ["careful", { raises: "special-defense", lowers: "special-attack" }],
  ["docile", { raises: null, lowers: null }],
  ["gentle", { raises: "special-defense", lowers: "defense" }],
  ["hardy", { raises: null, lowers: null }],
  ["hasty", { raises: "speed", lowers: "defense" }],
  ["impish", { raises: "defense", lowers: "special-attack" }],
  ["jolly", { raises: "speed", lowers: "special-attack" }],
  ["lax", { raises: "defense", lowers: "special-defense" }],
  ["lonely", { raises: "attack", lowers: "defense" }],
  ["mild", { raises: "special-attack", lowers: "defense" }],
  ["modest", { raises: "special-attack", lowers: "attack" }],
  ["naive", { raises: "speed", lowers: "special-defense" }],
  ["naughty", { raises: "attack", lowers: "special-defense" }],
  ["quiet", { raises: "special-attack", lowers: "speed" }],
  ["quirky", { raises: null, lowers: null }],
  ["rash", { raises: "special-attack", lowers: "special-defense" }],
  ["relaxed", { raises: "defense", lowers: "speed" }],
  ["sassy", { raises: "special-defense", lowers: "speed" }],
  ["serious", { raises: null, lowers: null }],
  ["timid", { raises: "speed", lowers: "attack" }],
]);


