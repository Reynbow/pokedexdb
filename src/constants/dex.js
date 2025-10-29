export const DEX_FILTERS = [
  { key: "national", label: "National", apiNames: ["national"], pad: 4, games: [] },
  {
    key: "kanto",
    label: "Kanto",
    apiNames: ["kanto"],
    pad: 3,
    games: [
      {
        key: "red-blue-yellow",
        label: "Red, Blue & Yellow",
        apiNames: ["kanto"],
        logos: ["red.png", "blue.png", "yellow.png"],
      },
      {
        key: "lets-go",
        label: "Let's Go Pikachu & Let's Go Eevee",
        apiNames: ["letsgo-kanto"],
        logos: ["letsgopikachu.png", "letsgoeevee.png"],
      },
      {
        key: "firered-leafgreen",
        label: "FireRed & LeafGreen",
        apiNames: ["kanto"],
        logos: ["firered.png", "leafgreen.png"],
      },
    ],
  },
  {
    key: "johto",
    label: "Johto",
    apiNames: ["original-johto", "updated-johto"],
    pad: 3,
    games: [
      {
        key: "gold-silver-crystal",
        label: "Gold, Silver & Crystal",
        apiNames: ["original-johto"],
        logos: ["gold.png", "silver.png", "crystal.png"],
      },
      {
        key: "heartgold-soulsilver",
        label: "HeartGold & SoulSilver",
        apiNames: ["updated-johto"],
        logos: ["heartgold.png", "soulsilver.png"],
      },
    ],
  },
  {
    key: "hoenn",
    label: "Hoenn",
    apiNames: ["hoenn", "updated-hoenn"],
    pad: 3,
    games: [
      {
        key: "ruby-sapphire-emerald",
        label: "Ruby, Sapphire & Emerald",
        apiNames: ["hoenn"],
        logos: ["ruby.png", "sapphire.png", "emerald.png"],
      },
      {
        key: "omega-ruby-alpha-sapphire",
        label: "Omega Ruby & Alpha Sapphire",
        apiNames: ["updated-hoenn"],
        logos: ["omegaruby.png", "alphasapphire.png"],
      },
    ],
  },
  {
    key: "sinnoh",
    label: "Sinnoh",
    apiNames: ["original-sinnoh", "extended-sinnoh"],
    pad: 3,
    games: [
      {
        key: "diamond-pearl",
        label: "Diamond & Pearl",
        apiNames: ["original-sinnoh"],
        logos: ["diamond.png", "pearl.png"],
      },
      {
        key: "platinum",
        label: "Platinum",
        apiNames: ["extended-sinnoh"],
        logos: ["platinum.png"],
      },
      {
        key: "brilliant-diamond-shining-pearl",
        label: "Brilliant Diamond & Shining Pearl",
        apiNames: ["original-sinnoh"],
        logos: ["brilliantdiamond.png", "shiningpearl.png"],
      },
    ],
  },
  {
    key: "unova",
    label: "Unova",
    apiNames: ["original-unova", "updated-unova"],
    pad: 3,
    games: [
      {
        key: "black-white",
        label: "Black & White",
        apiNames: ["original-unova"],
        logos: ["black.png", "white.png"],
      },
      {
        key: "black-2-white-2",
        label: "Black 2 & White 2",
        apiNames: ["updated-unova"],
        logos: ["black2.png", "white2.png"],
      },
    ],
  },
  {
    key: "kalos",
    label: "Kalos",
    apiNames: ["kalos-central", "kalos-coastal", "kalos-mountain", "lumiose-city"],
    pad: 3,
    games: [
      {
        key: "x-y",
        label: "X & Y",
        apiNames: ["kalos-central", "kalos-coastal", "kalos-mountain"],
        logos: ["x.png", "y.png"],
      },
      {
        key: "legends-za",
        label: "Legends: Z-A",
        apiNames: ["lumiose-city"],
        logos: ["za.png"],
      },
    ],
  },
  {
    key: "alola",
    label: "Alola",
    apiNames: ["original-alola", "updated-alola"],
    pad: 3,
    games: [
      {
        key: "sun-moon",
        label: "Sun & Moon",
        apiNames: ["original-alola"],
        logos: ["sun.png", "moon.png"],
      },
      {
        key: "ultra-sun-ultra-moon",
        label: "Ultra Sun & Ultra Moon",
        apiNames: ["updated-alola"],
        logos: ["ultrasun.png", "ultramoon.png"],
      },
    ],
  },
  {
    key: "galar",
    label: "Galar",
    apiNames: ["galar"],
    pad: 3,
    games: [
      {
        key: "sword-shield",
        label: "Sword & Shield",
        apiNames: ["galar"],
        logos: ["sword.png", "shield.png"],
      },
    ],
  },
  {
    key: "hisui",
    label: "Hisui",
    apiNames: ["hisui"],
    pad: 3,
    games: [
      {
        key: "legends-arceus",
        label: "Legends: Arceus",
        apiNames: ["hisui"],
        logos: ["arceus.png"],
      },
    ],
  },
  {
    key: "paldea",
    label: "Paldea",
    apiNames: ["paldea"],
    pad: 3,
    games: [
      {
        key: "scarlet-violet",
        label: "Scarlet & Violet",
        apiNames: ["paldea"],
        logos: ["scarlet.png", "violet.png"],
      },
    ],
  },
];

export const DEX_LOOKUP = new Map(DEX_FILTERS.map((cfg) => [cfg.key, cfg]));


