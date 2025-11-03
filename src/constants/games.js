import { DEX_FILTERS } from "./dex.js";

export const GAME_LOGO_IMPORTS = import.meta.glob("../assets/game-logos/*", {
  eager: true,
  import: "default",
  query: "?url",
});

export const GAME_LOGO_LOOKUP = new Map(
  Object.entries(GAME_LOGO_IMPORTS).map(([path, url]) => {
    const parts = path.split("/");
    return [parts[parts.length - 1], url];
  })
);

// Representative brand colors for version logos
export const VERSION_COLORS = new Map([
  ["red", "#ef4444"],
  ["blue", "#3b82f6"],
  ["yellow", "#f59e0b"],
  ["firered", "#dc2626"],
  ["leafgreen", "#22c55e"],
  ["lets-go-pikachu", "#fff7bf"],
  ["lets-go-eevee", "#8b5e34"],
  ["gold", "#f59e0b"],
  ["silver", "#60a5fa"],
  ["crystal", "#22d3ee"],
  ["heartgold", "#f59e0b"],
  ["soulsilver", "#60a5fa"],
  ["ruby", "#dc2626"],
  ["sapphire", "#2563eb"],
  ["emerald", "#10b981"],
  ["omega-ruby", "#ef4444"],
  ["alpha-sapphire", "#3b82f6"],
  ["diamond", "#60a5fa"],
  ["pearl", "#f472b6"],
  ["brilliant-diamond", "#38bdf8"],
  ["shining-pearl", "#f9a8d4"],
  ["black", "#111827"],
  ["white", "#e5e7eb"],
  ["black-2", "#0f172a"],
  ["white-2", "#f3f4f6"],
  ["x", "#2563eb"],
  ["y", "#ef4444"],
  ["sun", "#f59e0b"],
  ["moon", "#6366f1"],
  ["ultra-sun", "#f59e0b"],
  ["ultra-moon", "#6366f1"],
  ["sword", "#0ea5e9"],
  ["shield", "#ec4899"],
  ["legends-arceus", "#60a5fa"],
  ["scarlet", "#ef4444"],
  ["violet", "#8b5cf6"],
  ["legends-za", "#14b8a6"],
]);

export const VERSION_LOGO_FILES = new Map([
  ["red", "red.png"],
  ["blue", "blue.png"],
  ["yellow", "yellow.png"],
  ["gold", "gold.png"],
  ["silver", "silver.png"],
  ["crystal", "crystal.png"],
  ["ruby", "ruby.png"],
  ["sapphire", "sapphire.png"],
  ["firered", "firered.png"],
  ["leafgreen", "leafgreen.png"],
  ["emerald", "emerald.png"],
  ["diamond", "diamond.png"],
  ["pearl", "pearl.png"],
  ["platinum", "platinum.png"],
  ["heartgold", "heartgold.png"],
  ["soulsilver", "soulsilver.png"],
  ["black", "black.png"],
  ["white", "white.png"],
  ["black-2", "black2.png"],
  ["white-2", "white2.png"],
  ["x", "x.png"],
  ["y", "y.png"],
  ["omega-ruby", "omegaruby.png"],
  ["alpha-sapphire", "alphasapphire.png"],
  ["sun", "sun.png"],
  ["moon", "moon.png"],
  ["ultra-sun", "ultrasun.png"],
  ["ultra-moon", "ultramoon.png"],
  ["sword", "sword.png"],
  ["shield", "shield.png"],
  ["brilliant-diamond", "brilliantdiamond.png"],
  ["shining-pearl", "shiningpearl.png"],
  ["legends-arceus", "arceus.png"],
  ["scarlet", "scarlet.png"],
  ["violet", "violet.png"],
  ["lets-go-pikachu", "letsgopikachu.png"],
  ["lets-go-eevee", "letsgoeevee.png"],
  ["legends-za", "za.png"],
]);

export const VERSION_RELEASE_SEQUENCE = [
  "red",
  "blue",
  "yellow",
  "gold",
  "silver",
  "crystal",
  "ruby",
  "sapphire",
  "firered",
  "leafgreen",
  "emerald",
  "diamond",
  "pearl",
  "platinum",
  "heartgold",
  "soulsilver",
  "black",
  "white",
  "black-2",
  "white-2",
  "x",
  "y",
  "omega-ruby",
  "alpha-sapphire",
  "sun",
  "moon",
  "ultra-sun",
  "ultra-moon",
  "lets-go-pikachu",
  "lets-go-eevee",
  "sword",
  "shield",
  "brilliant-diamond",
  "shining-pearl",
  "legends-arceus",
  "scarlet",
  "violet",
  "legends-za",
];

export const VERSION_ORDER_LOOKUP = new Map(
  VERSION_RELEASE_SEQUENCE.map((name, index) => [name, index])
);

export const NATIONAL_GAME_ORDER = [
  "red-blue-yellow",
  "gold-silver-crystal",
  "ruby-sapphire-emerald",
  "firered-leafgreen",
  "diamond-pearl",
  "platinum",
  "heartgold-soulsilver",
  "black-white",
  "black-2-white-2",
  "x-y",
  "omega-ruby-alpha-sapphire",
  "sun-moon",
  "ultra-sun-ultra-moon",
  "lets-go",
  "sword-shield",
  "brilliant-diamond-shining-pearl",
  "legends-arceus",
  "scarlet-violet",
  "legends-za",
];

const GAME_METADATA = new Map();
for (const cfg of DEX_FILTERS) {
  for (const game of cfg.games || []) {
    if (!GAME_METADATA.has(game.key)) {
      GAME_METADATA.set(game.key, {
        ...game,
        dexKey: cfg.key,
        pad: cfg.pad ?? 3,
      });
    }
  }
}

export const ALL_GAME_OPTIONS = Array.from(GAME_METADATA.values());

export const NATIONAL_GAME_OPTIONS = [
  ...NATIONAL_GAME_ORDER.map((key) => GAME_METADATA.get(key)).filter(Boolean),
  ...ALL_GAME_OPTIONS.filter((game) => !NATIONAL_GAME_ORDER.includes(game.key)),
];

export const GAME_LOOKUP = new Map(GAME_METADATA);

export const GENERATION_NAME_LOOKUP = new Map([
  ["generation-i", 1],
  ["generation-ii", 2],
  ["generation-iii", 3],
  ["generation-iv", 4],
  ["generation-v", 5],
  ["generation-vi", 6],
  ["generation-vii", 7],
  ["generation-viii", 8],
  ["generation-ix", 9],
]);

export const REGION_GENERATION_LOOKUP = new Map([
  ["kanto", 1],
  ["johto", 2],
  ["hoenn", 3],
  ["sinnoh", 4],
  ["unova", 5],
  ["kalos", 6],
  ["alola", 7],
  ["galar", 8],
  ["hisui", 8],
  ["paldea", 9],
  ["kitakami", 9],
  ["blueberry-academy", 9],
]);

export const DEX_GENERATION_LOOKUP = new Map([
  ["national", null],
  ["kanto", 1],
  ["johto", 2],
  ["hoenn", 3],
  ["sinnoh", 4],
  ["unova", 5],
  ["kalos", 6],
  ["alola", 7],
  ["galar", 8],
  ["hisui", 8],
  ["paldea", 9],
]);

export const GAME_GENERATION_LOOKUP = new Map([
  ["red-blue-yellow", 1],
  ["firered-leafgreen", 3],
  ["lets-go", 7],
  ["gold-silver-crystal", 2],
  ["heartgold-soulsilver", 4],
  ["ruby-sapphire-emerald", 3],
  ["omega-ruby-alpha-sapphire", 6],
  ["diamond-pearl", 4],
  ["platinum", 4],
  ["brilliant-diamond-shining-pearl", 8],
  ["black-white", 5],
  ["black-2-white-2", 5],
  ["x-y", 6],
  ["sun-moon", 7],
  ["ultra-sun-ultra-moon", 7],
  ["sword-shield", 8],
  ["legends-arceus", 8],
  ["scarlet-violet", 9],
  ["legends-za", 9],
]);

export const GAME_FEATURES = new Map([
  ["red-blue-yellow", { mega: false, gmax: false }],
  ["firered-leafgreen", { mega: false, gmax: false }],
  ["lets-go", { mega: true, gmax: false }],
  ["gold-silver-crystal", { mega: false, gmax: false }],
  ["heartgold-soulsilver", { mega: false, gmax: false }],
  ["ruby-sapphire-emerald", { mega: false, gmax: false }],
  ["omega-ruby-alpha-sapphire", { mega: true, gmax: false }],
  ["diamond-pearl", { mega: false, gmax: false }],
  ["platinum", { mega: false, gmax: false }],
  ["brilliant-diamond-shining-pearl", { mega: false, gmax: false }],
  ["black-white", { mega: false, gmax: false }],
  ["black-2-white-2", { mega: false, gmax: false }],
  ["x-y", { mega: true, gmax: false }],
  ["sun-moon", { mega: true, gmax: false }],
  ["ultra-sun-ultra-moon", { mega: true, gmax: false }],
  ["sword-shield", { mega: false, gmax: true }],
  ["legends-arceus", { mega: false, gmax: false }],
  ["scarlet-violet", { mega: false, gmax: false }],
  ["legends-za", { mega: false, gmax: false }],
]);

export const REGION_FEATURES = new Map([
  ["kalos", { mega: true, gmax: false }],
  ["alola", { mega: true, gmax: false }],
  ["galar", { mega: false, gmax: true }],
  ["paldea", { mega: false, gmax: false }],
  ["hisui", { mega: false, gmax: false }],
  ["kanto", { mega: false, gmax: false }],
  ["johto", { mega: false, gmax: false }],
  ["hoenn", { mega: false, gmax: false }],
  ["sinnoh", { mega: false, gmax: false }],
  ["unova", { mega: false, gmax: false }],
]);


