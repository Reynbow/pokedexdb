export const EV_ITEM_GUIDE = [
  {
    name: "HP Up",
    stat: "HP",
    description: "+10 HP EVs instantly",
    icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/hp-up.png",
    statKeys: ["hp"],
    category: "Consumables",
    order: 0,
  },
  {
    name: "Protein",
    stat: "Attack",
    description: "+10 Attack EVs instantly",
    icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/protein.png",
    statKeys: ["attack"],
    category: "Consumables",
    order: 1,
  },
  {
    name: "Iron",
    stat: "Defense",
    description: "+10 Defense EVs instantly",
    icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/iron.png",
    statKeys: ["defense"],
    category: "Consumables",
    order: 2,
  },
  {
    name: "Calcium",
    stat: "Special Attack",
    description: "+10 Special Attack EVs instantly",
    icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/calcium.png",
    statKeys: ["special-attack"],
    category: "Consumables",
    order: 3,
  },
  {
    name: "Zinc",
    stat: "Special Defense",
    description: "+10 Special Defense EVs instantly",
    icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/zinc.png",
    statKeys: ["special-defense"],
    category: "Consumables",
    order: 4,
  },
  {
    name: "Carbos",
    stat: "Speed",
    description: "+10 Speed EVs instantly",
    icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/carbos.png",
    statKeys: ["speed"],
    category: "Consumables",
    order: 5,
  },
  {
    name: "Macho Brace",
    stat: "All stats",
    description: "Doubles EVs gained from battles while halving battle Speed",
    icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/macho-brace.png",
    statKeys: ["*"],
    category: "Held Items",
    order: 100,
  },
];

export const FEATHER_VARIANTS = {
  hp: { name: "Health Feather", icon: "/item-data/health-feather.png", order: 10 },
  attack: { name: "Muscle Feather", icon: "/item-data/muscle-feather.png", order: 11 },
  defense: { name: "Resist Feather", icon: "/item-data/resist-feather.png", order: 12 },
  "special-attack": { name: "Genius Feather", icon: "/item-data/genius-feather.png", order: 13 },
  "special-defense": { name: "Clever Feather", icon: "/item-data/clever-feather.png", order: 14 },
  speed: { name: "Swift Feather", icon: "/item-data/swift-feather.png", order: 15 },
};

export const POWER_ITEM_VARIANTS = {
  hp: { name: "Power Weight", icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/power-weight.png", order: 0 },
  attack: { name: "Power Bracer", icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/power-bracer.png", order: 1 },
  defense: { name: "Power Belt", icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/power-belt.png", order: 2 },
  "special-attack": { name: "Power Lens", icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/power-lens.png", order: 3 },
  "special-defense": { name: "Power Band", icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/power-band.png", order: 4 },
  speed: { name: "Power Anklet", icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/power-anklet.png", order: 5 },
};

/* ------------------------------------------------------------------------------------------
 * Generation-aware item data for the EV Training page (sources: Bulbapedia "Effort values",
 * the individual item pages, and "Effort level").
 * ---------------------------------------------------------------------------------------- */

// Bonus EVs a held Power Item adds for every Pokémon defeated, on top of the normal yield.
// Introduced in Generation IV (+4); raised to +8 from Generation VII onward.
export const getPowerItemBonus = (generation) => {
  if (!Number.isFinite(generation) || generation < 4) return 0;
  return generation >= 7 ? 8 : 4;
};

// Vitamins. Generations I-II: +2,560 Stat Experience per bottle, refused once that stat has
// 25,600. Generations III-VII: +10 EVs, refused once that stat has 100 EVs. Generation VIII+:
// +10 EVs all the way to the 252 per-stat / 510 total caps. Zinc was introduced in Generation III;
// before that Calcium raised the shared Special stat.
export const EV_PANEL_VITAMINS = [
  { key: "hp", name: "HP Up", stat: "HP", image: "/item-data/images/hpup.png" },
  { key: "attack", name: "Protein", stat: "Attack", image: "/item-data/images/protein.png" },
  { key: "defense", name: "Iron", stat: "Defense", image: "/item-data/images/iron.png" },
  { key: "special-attack", name: "Calcium", stat: "Sp. Atk", statGen1to2: "Special", image: "/item-data/images/calcium.png" },
  { key: "special-defense", name: "Zinc", stat: "Sp. Def", introduced: 3, image: "/item-data/images/zinc.png" },
  { key: "speed", name: "Carbos", stat: "Speed", image: "/item-data/images/carbos.png" },
];

// Feathers give +1 EV each (no 100-EV limit). Introduced in Generation V and called "Wings"
// in English until Sword and Shield renamed them.
export const EV_PANEL_FEATHERS = [
  { key: "hp", name: "Health Feather", wingName: "Health Wing", stat: "HP", image: "/item-data/images/healthfeather.png" },
  { key: "attack", name: "Muscle Feather", wingName: "Muscle Wing", stat: "Attack", image: "/item-data/images/musclefeather.png" },
  { key: "defense", name: "Resist Feather", wingName: "Resist Wing", stat: "Defense", image: "/item-data/images/resistfeather.png" },
  { key: "special-attack", name: "Genius Feather", wingName: "Genius Wing", stat: "Sp. Atk", image: "/item-data/images/geniusfeather.png" },
  { key: "special-defense", name: "Clever Feather", wingName: "Clever Wing", stat: "Sp. Def", image: "/item-data/images/cleverfeather.png" },
  { key: "speed", name: "Swift Feather", wingName: "Swift Wing", stat: "Speed", image: "/item-data/images/swiftfeather.png" },
];

export const EV_PANEL_POWER_ITEMS = [
  { key: "hp", name: "Power Weight", stat: "HP", image: "/item-data/images/powerweight.png" },
  { key: "attack", name: "Power Bracer", stat: "Attack", image: "/item-data/images/powerbracer.png" },
  { key: "defense", name: "Power Belt", stat: "Defense", image: "/item-data/images/powerbelt.png" },
  { key: "special-attack", name: "Power Lens", stat: "Sp. Atk", image: "/item-data/images/powerlens.png" },
  { key: "special-defense", name: "Power Band", stat: "Sp. Def", image: "/item-data/images/powerband.png" },
  { key: "speed", name: "Power Anklet", stat: "Speed", image: "/item-data/images/poweranklet.png" },
];

// Legends: Arceus Grit items. Each raises one stat's effort level by 1, but only within its band.
export const GRIT_ITEMS = [
  { name: "Grit Dust", image: "/item-data/images/gritdust.png", effect: "+1 EL when the stat is at EL 0–2 (up to 3)" },
  { name: "Grit Gravel", image: "/item-data/images/gritgravel.png", effect: "+1 EL when the stat is at EL 3–5 (up to 6)" },
  { name: "Grit Pebble", image: "/item-data/images/gritpebble.png", effect: "+1 EL when the stat is at EL 6–8 (up to 9)" },
  { name: "Grit Rock", image: "/item-data/images/gritrock.png", effect: "+1 EL at EL 9, reaching the maximum of 10" },
];

