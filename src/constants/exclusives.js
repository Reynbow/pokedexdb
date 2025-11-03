// Version exclusives mapping by game group key (see constants/dex.js for keys)
// Species names should be lowercase PokeAPI base species ids (no forms), hyphenated where appropriate.

export const GAME_VERSION_EXCLUSIVES = new Map([
  // Kanto
  [
    "red-blue-yellow",
    {
      versions: [
        {
          key: "red",
          species: new Set([
            "ekans",
            "arbok",
            "oddish",
            "gloom",
            "vileplume",
            "mankey",
            "primeape",
            "growlithe",
            "arcanine",
            "scyther",
            "electabuzz",
          ]),
        },
        {
          key: "blue",
          species: new Set([
            "sandshrew",
            "sandslash",
            "vulpix",
            "ninetales",
            "meowth",
            "persian",
            "bellsprout",
            "weepinbell",
            "victreebel",
            "magmar",
            "pinsir",
          ]),
        },
      ],
    },
  ],
  [
    "lets-go",
    {
      versions: [
        {
          key: "lets-go-pikachu",
          species: new Set([
            "sandshrew",
            "sandslash",
            "oddish",
            "gloom",
            "vileplume",
            "mankey",
            "primeape",
            "growlithe",
            "arcanine",
            "grimer",
            "muk",
            "scyther",
            "pinsir",
          ]),
        },
        {
          key: "lets-go-eevee",
          species: new Set([
            "vulpix",
            "ninetales",
            "bellsprout",
            "weepinbell",
            "victreebel",
            "meowth",
            "persian",
            "koffing",
            "weezing",
            "ekans",
            "arbok",
            "magmar",
          ]),
        },
      ],
    },
  ],
  [
    "firered-leafgreen",
    {
      versions: [
        {
          key: "firered",
          species: new Set([
            "ekans",
            "arbok",
            "oddish",
            "gloom",
            "vileplume",
            "psyduck",
            "golduck",
            "growlithe",
            "arcanine",
            "shellder",
            "cloyster",
            "electabuzz",
            "scyther",
            "wooper",
            "quagsire",
            "murkrow",
            "delibird",
            "skitty",
            "delcatty",
            "plusle",
          ]),
        },
        {
          key: "leafgreen",
          species: new Set([
            "sandshrew",
            "sandslash",
            "vulpix",
            "ninetales",
            "meowth",
            "persian",
            "bellsprout",
            "weepinbell",
            "victreebel",
            "slowpoke",
            "slowbro",
            "slowking",
            "staryu",
            "starmie",
            "magmar",
            "misdreavus",
            "sneasel",
            "aipom",
            "teddiursa",
            "ursaring",
            "mantine",
            "minun",
          ]),
        },
      ],
    },
  ],

  // Johto remakes (approximate; mirrors GS)
  [
    "heartgold-soulsilver",
    {
      versions: [
        {
          key: "heartgold",
          species: new Set([
            "mankey",
            "primeape",
            "growlithe",
            "arcanine",
            "spinarak",
            "ariados",
            "gligar",
            "teddiursa",
            "ursaring",
            "mantine",
            "sableye",
            "baltoy",
            "claydol",
            "kyogre",
            "ho-oh",
          ]),
        },
        {
          key: "soulsilver",
          species: new Set([
            "vulpix",
            "ninetales",
            "meowth",
            "persian",
            "ledyba",
            "ledian",
            "delibird",
            "skarmory",
            "phanpy",
            "donphan",
            "mawile",
            "gulpin",
            "swalot",
            "groudon",
            "lugia",
          ]),
        },
      ],
    },
  ],

  // Johto (original)
  [
    "gold-silver-crystal",
    {
      versions: [
        {
          key: "gold",
          species: new Set([
            "mankey",
            "primeape",
            "growlithe",
            "arcanine",
            "spinarak",
            "ariados",
            "gligar",
            "teddiursa",
            "ursaring",
            "mantine",
            "ho-oh",
          ]),
        },
        {
          key: "silver",
          species: new Set([
            "vulpix",
            "ninetales",
            "meowth",
            "persian",
            "ledyba",
            "ledian",
            "delibird",
            "skarmory",
            "phanpy",
            "donphan",
            "lugia",
          ]),
        },
        {
          key: "crystal",
          species: new Set([
            // Crystal availability differs; leave empty to avoid false positives
          ]),
        },
      ],
    },
  ],

  // Hoenn
  [
    "ruby-sapphire-emerald",
    {
      versions: [
        {
          key: "ruby",
          species: new Set([
            "seedot",
            "nuzleaf",
            "shiftry",
            "mawile",
            "zangoose",
            "solrock",
            "groudon",
            "plusle",
            "meditite",
            "medicham",
            "latios",
          ]),
        },
        {
          key: "sapphire",
          species: new Set([
            "lotad",
            "lombre",
            "ludicolo",
            "sableye",
            "seviper",
            "lunatone",
            "kyogre",
            "minun",
            "meditite",
            "medicham",
            "latias",
          ]),
        },
      ],
    },
  ],
  [
    "omega-ruby-alpha-sapphire",
    {
      versions: [
        {
          key: "omega-ruby",
          species: new Set([
            "seedot",
            "nuzleaf",
            "shiftry",
            "mawile",
            "solrock",
            "latios",
            "groudon",
            "ho-oh",
            "palkia",
            "dialga",
            "reshiram",
            "tornadus",
          ]),
        },
        {
          key: "alpha-sapphire",
          species: new Set([
            "lotad",
            "lombre",
            "ludicolo",
            "sableye",
            "lunatone",
            "latias",
            "kyogre",
            "lugia",
            "zekrom",
            "thundurus",
            "giratina",
          ]),
        },
      ],
    },
  ],

  // Sinnoh
  [
    "diamond-pearl",
    {
      versions: [
        {
          key: "diamond",
          species: new Set([
            // Kanto/Johto/Hoenn additions
            "seel",
            "dewgong",
            "scyther",
            "scizor",
            "murkrow",
            "honchkrow",
            "larvitar",
            "pupitar",
            "tyranitar",
            "poochyena",
            "mightyena",
            "aron",
            "lairon",
            "aggron",
            "kecleon",
            // Sinnoh fossils/lines
            "cranidos",
            "rampardos",
            "stunky",
            "skuntank",
            // Legendary
            "dialga",
          ]),
        },
        {
          key: "pearl",
          species: new Set([
            // Hoenn/Johto/Kanto lines
            "bagon",
            "shelgon",
            "salamence",
            "shieldon",
            "bastiodon",
            "purugly",
            "glameow",
            "houndour",
            "houndoom",
            "slowpoke",
            "slowbro",
            "slowking",
            "stantler",
            "spheal",
            "sealeo",
            "walrein",
            // Ghost line
            "misdreavus",
            "mismagius",
            // Legendary
            "palkia",
          ]),
        },
      ],
    },
  ],
  [
    "brilliant-diamond-shining-pearl",
    {
      versions: [
        {
          key: "brilliant-diamond",
          species: new Set([
            // Kanto/Johto lines & Legendaries
            "caterpie",
            "metapod",
            "butterfree",
            "ekans",
            "arbok",
            "growlithe",
            "arcanine",
            "seel",
            "dewgong",
            "scyther",
            "electabuzz",
            "murkrow",
            "honchkrow",
            "gligar",
            "gliscor",
            "scizor",
            "elekid",
            "electivire",
            "raikou",
            "entei",
            "suicune",
            // Hoenn lines
            "larvitar",
            "pupitar",
            "tyranitar",
            "seedot",
            "nuzleaf",
            "shiftry",
            "mawile",
            "zangoose",
            "solrock",
            "kecleon",
            // Sinnoh fossils/lines
            "cranidos",
            "rampardos",
            "stunky",
            "skuntank",
            // Legendary
            "dialga",
          ]),
        },
        {
          key: "shining-pearl",
          species: new Set([
            // Kanto/Johto lines & Legendaries
            "weedle",
            "kakuna",
            "beedrill",
            "sandshrew",
            "sandslash",
            "vulpix",
            "ninetales",
            "slowpoke",
            "slowbro",
            "magmar",
            "pinsir",
            "articuno",
            "zapdos",
            "moltres",
            "slowking",
            "misdreavus",
            "mismagius",
            "teddiursa",
            "ursaring",
            "stantler",
            "magby",
            "magmortar",
            "lugia",
            // Hoenn lines
            "lotad",
            "lombre",
            "ludicolo",
            "sableye",
            "seviper",
            "lunatone",
            "bagon",
            "shelgon",
            "salamence",
            // Sinnoh fossils/lines
            "shieldon",
            "bastiodon",
            "glameow",
            "purugly",
            // Legendary
            "palkia",
          ]),
        },
      ],
    },
  ],

  // Unova
  [
    "black-white",
    {
      versions: [
        {
          key: "black",
          species: new Set([
            "gothita",
            "gothorita",
            "gothitelle",
            "cottonee",
            "whimsicott",
            "vullaby",
            "mandibuzz",
            "tornadus",
            "reshiram",
          ]),
        },
        {
          key: "white",
          species: new Set([
            "solosis",
            "duosion",
            "reuniclus",
            "petilil",
            "lilligant",
            "rufflet",
            "braviary",
            "thundurus",
            "zekrom",
          ]),
        },
      ],
    },
  ],
  [
    "black-2-white-2",
    {
      versions: [
        {
          key: "black-2",
          species: new Set([
            // Lines unique to Black 2
            "magby",
            "magmar",
            "magmortar",
            "buneary",
            "lopunny",
            "plusle",
            "minun",
            // Unova exclusives
            "gothita",
            "gothorita",
            "gothitelle",
            "vullaby",
            "mandibuzz",
            // Legendaries / forms
            "registeel",
            "latios",
            "tornadus",
            "reshiram",
          ]),
        },
        {
          key: "white-2",
          species: new Set([
            // Lines unique to White 2
            "elekid",
            "electabuzz",
            "electivire",
            "skitty",
            "delcatty",
            // Unova exclusives
            "solosis",
            "duosion",
            "reuniclus",
            "rufflet",
            "braviary",
            // Legendaries / forms
            "regice",
            "latias",
            "thundurus",
            "zekrom",
          ]),
        },
      ],
    },
  ],

  // Kalos
  [
    "x-y",
    {
      versions: [
        {
          key: "x",
          species: new Set([
            "clauncher",
            "clawitzer",
            "staryu",
            "starmie",
            "swirlix",
            "slurpuff",
            "pinsir",
            "houndour",
            "houndoom",
            "poochyena",
            "mightyena",
            "aron",
            "lairon",
            "aggron",
            "sawk",
            "xerneas",
          ]),
        },
        {
          key: "y",
          species: new Set([
            "skrelp",
            "dragalge",
            "shellder",
            "cloyster",
            "spritzee",
            "aromatisse",
            "heracross",
            "larvitar",
            "pupitar",
            "tyranitar",
            "electrike",
            "manectric",
            "throh",
            "yveltal",
          ]),
        },
      ],
    },
  ],

  // Alola
  [
    "sun-moon",
    {
      versions: [
        {
          key: "sun",
          species: new Set([
            "passimian",
            "turtonator",
            "dewpider",
            "araquanid",
            "vulpix",
            "ninetales",
            "rufflet",
            "braviary",
            "tirtouga",
            "carracosta",
            "cranidos",
            "rampardos",
            "cottonee",
            "whimsicott",
            "petilil",
            "lilligant",
            "solgaleo",
            "buzzwole",
            "kartana",
          ]),
        },
        {
          key: "moon",
          species: new Set([
            "oranguru",
            "drampa",
            "surskit",
            "masquerain",
            "sandshrew",
            "sandslash",
            "vullaby",
            "mandibuzz",
            "archen",
            "archeops",
            "shieldon",
            "bastiodon",
            "goomy",
            "sliggoo",
            "goodra",
            "lunala",
            "pheromosa",
            "celesteela",
          ]),
        },
      ],
    },
  ],
  [
    "ultra-sun-ultra-moon",
    {
      versions: [
        {
          key: "ultra-sun",
          species: new Set([
            // Carries over and expands Sun exclusives
            "turtonator",
            "passimian",
            "rufflet",
            "braviary",
            "tirtouga",
            "carracosta",
            "cranidos",
            "rampardos",
            "cottonee",
            "whimsicott",
            "vulpix",
            "ninetales",
            "petilil",
            "lilligant",
            // Legendaries / UBs
            "solgaleo",
            "ho-oh",
            "groudon",
            "latios",
            "reshiram",
            "tornadus",
            "buzzwole",
            "kartana",
            "blacephalon",
          ]),
        },
        {
          key: "ultra-moon",
          species: new Set([
            // Carries over and expands Moon exclusives
            "drampa",
            "oranguru",
            "vullaby",
            "mandibuzz",
            "archen",
            "archeops",
            "shieldon",
            "bastiodon",
            "goomy",
            "sliggoo",
            "goodra",
            "sandshrew",
            "sandslash",
            // Legendaries / UBs
            "lunala",
            "lugia",
            "kyogre",
            "latias",
            "zekrom",
            "thundurus",
            "pheromosa",
            "celesteela",
            "stakataka",
          ]),
        },
      ],
    },
  ],

  // Galar
  [
    "sword-shield",
    {
      versions: [
        {
          key: "sword",
          species: new Set([
            // Regional/family lines
            "farfetchd", // Galarian Farfetch'd
            "sirfetchd",
            "seedot",
            "nuzleaf",
            "shiftry",
            "mawile",
            "solrock",
            "darumaka",
            "darmanitan",
            "scraggy",
            "scrafty",
            "gothita",
            "gothorita",
            "gothitelle",
            "rufflet",
            "braviary",
            "deino",
            "zweilous",
            "hydreigon",
            "swirlix",
            "slurpuff",
            "passimian",
            "turtonator",
            "jangmo-o",
            "hakamo-o",
            "kommo-o",
            "indeedee-male",
            "stonjourner",
            "flapple",
            // Legendaries
            "zacian",
          ]),
        },
        {
          key: "shield",
          species: new Set([
            // Regional/family lines
            "ponyta", // Galarian Ponyta
            "rapidash",
            "corsola", // Galarian Corsola
            "cursola",
            "larvitar",
            "pupitar",
            "tyranitar",
            "lotad",
            "lombre",
            "ludicolo",
            "sableye",
            "lunatone",
            "croagunk",
            "toxicroak",
            "solosis",
            "duosion",
            "reuniclus",
            "vullaby",
            "mandibuzz",
            "spritzee",
            "aromatisse",
            "goomy",
            "sliggoo",
            "goodra",
            "oranguru",
            "drampa",
            "eiscue",
            "indeedee-female",
            "appletun",
            // Legendaries
            "zamazenta",
          ]),
        },
      ],
    },
  ],

  // Paldea
  [
    "scarlet-violet",
    {
      versions: [
        {
          key: "scarlet",
          species: new Set([
            "koraidon",
            "armarouge",
            // Base game / DLC species
            "tauros-paldea-blaze", // Tauros (Fire)
            "stunky",
            "skuntank",
            "drifloon",
            "drifblim",
            "larvitar",
            "pupitar",
            "tyranitar",
            "deino",
            "zweilous",
            "hydreigon",
            "skrelp",
            "dragalge",
            "oranguru",
            "stonjourner",
            "gligar",
            "gliscor",
            "cramorant",
            "cranidos",
            "rampardos",
            "vulpix-alola",
            "ninetales-alola",
            "great-tusk",
            "scream-tail",
            "brute-bonnet",
            "flutter-mane",
            "slither-wing",
            "sandy-shocks",
            "roaring-moon",
            "raging-bolt",
            "gouging-fire",
            // Legendaries
            "suicune",
            "raikou",
            "entei",
            "ho-oh",
            "latios",
            "groudon",
            "glastrier",
            "reshiram",
            "solgaleo",
          ]),
        },
        {
          key: "violet",
          species: new Set([
            "miraidon",
            "ceruledge",
            // Base game / DLC species
            "tauros-paldea-aqua", // Tauros (Water)
            "misdreavus",
            "mismagius",
            "gulpin",
            "swalot",
            "bagon",
            "shelgon",
            "salamence",
            "passimian",
            "clauncher",
            "clawitzer",
            "eiscue",
            "dreepy",
            "drakloak",
            "dragapult",
            "aipom",
            "ambipom",
            "morpeko",
            "sandshrew-alola",
            "sandslash-alola",
            "shieldon",
            "bastiodon",
            "iron-treads",
            "iron-bundle",
            "iron-hands",
            "iron-jugulis",
            "iron-moth",
            "iron-thorns",
            "iron-valiant",
            // Legendaries
            "lugia",
            "latias",
            "kyogre",
            "cobalion",
            "terrakion",
            "virizion",
            "zekrom",
            "lunala",
            "spectrier",
            "iron-crown",
            "iron-boulder",
          ]),
        },
      ],
    },
  ],
]);

export function getExclusiveVersionForSpecies(gameKey, baseSpeciesName) {
  if (!gameKey || !baseSpeciesName) return null;
  const cfg = GAME_VERSION_EXCLUSIVES.get(String(gameKey));
  if (!cfg || !Array.isArray(cfg.versions)) return null;
  const name = String(baseSpeciesName).toLowerCase();
  let matchedKey = null;
  let matches = 0;
  for (const v of cfg.versions) {
    if (v?.species instanceof Set && v.species.has(name)) {
      matchedKey = v.key || null;
      matches += 1;
    }
  }
  if (matches !== 1) return null;
  return matchedKey;
}


