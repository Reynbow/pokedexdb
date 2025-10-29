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
  hp: { name: "Health Feather", icon: "/items/health-feather.png", order: 10 },
  attack: { name: "Muscle Feather", icon: "/items/muscle-feather.png", order: 11 },
  defense: { name: "Resist Feather", icon: "/items/resist-feather.png", order: 12 },
  "special-attack": { name: "Genius Feather", icon: "/items/genius-feather.png", order: 13 },
  "special-defense": { name: "Clever Feather", icon: "/items/clever-feather.png", order: 14 },
  speed: { name: "Swift Feather", icon: "/items/swift-feather.png", order: 15 },
};

export const POWER_ITEM_VARIANTS = {
  hp: { name: "Power Weight", icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/power-weight.png", order: 0 },
  attack: { name: "Power Bracer", icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/power-bracer.png", order: 1 },
  defense: { name: "Power Belt", icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/power-belt.png", order: 2 },
  "special-attack": { name: "Power Lens", icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/power-lens.png", order: 3 },
  "special-defense": { name: "Power Band", icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/power-band.png", order: 4 },
  speed: { name: "Power Anklet", icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/power-anklet.png", order: 5 },
};


