// Top-level pages of the site. Plain data so both the app (router, navigation, document
// titles) and the build scripts (static SEO pages, sitemap) can use it.

export const SITE_NAME = "Pokedex DB";
export const SITE_URL = "https://pokedexdb.com";

export const DEFAULT_TITLE = "Complete Pokemon Database and Tools Website";
export const DEFAULT_DESCRIPTION =
  "Your complete Pokemon database with detailed stats, evolutions, abilities, moves, and weakness charts for every game. Plus tools for EV training, move/ability/item databases, save file reading, and a Pokemon guessing minigame.";

/**
 * `path` is the canonical URL segment; `aliases` are older URLs that still resolve.
 * `nav` controls whether the page appears in the section tabs (and its label there).
 */
export const PAGE_ROUTES = [
  {
    key: "moves",
    path: "moves",
    aliases: [],
    nav: "Moves",
    title: `Pokemon Moves Database - Power, Accuracy, PP & Learners | ${SITE_NAME}`,
    description:
      "Search every Pokemon move by type and category. See power, accuracy, PP, priority, effects, changes between generations, and which Pokemon learn each move.",
  },
  {
    key: "abilities",
    path: "abilities",
    aliases: [],
    nav: "Abilities",
    title: `Pokemon Abilities Database - Effects & Pokemon | ${SITE_NAME}`,
    description:
      "Browse every Pokemon ability with its effect and the Pokemon that can have it, including Hidden Abilities.",
  },
  {
    key: "items",
    path: "items",
    aliases: [],
    nav: "Items",
    title: `Pokemon Items Database - Effects, Prices & Locations | ${SITE_NAME}`,
    description: "Look up Pokemon items by game: what they do, what they cost and where to find them.",
  },
  {
    key: "ev",
    path: "ev-training",
    aliases: ["ev"],
    nav: "EV Training",
    title: `Pokemon EV Training Guide for Every Game | ${SITE_NAME}`,
    description:
      "EV training guides for every Pokemon game: the best training spots and Pokemon, vitamins, Power Items, Pokerus and EV caps by generation.",
  },
  {
    key: "whosthat",
    path: "whosthat",
    aliases: [],
    nav: "Who's That?",
    title: `Who's That Pokemon? Daily Guessing Game | ${SITE_NAME}`,
    description: "Guess the daily mystery Pokemon from its silhouette and clues.",
  },
  {
    key: "save",
    path: "save",
    aliases: ["sav"],
    nav: "Save Reader",
    title: `Pokemon Save File Reader | ${SITE_NAME}`,
    description:
      "Open a Pokemon Yellow .sav or .srm save file in your browser to see your party, Pokedex progress and where to find the Pokemon you're missing.",
  },
];

export const PAGE_ROUTE_BY_KEY = new Map(PAGE_ROUTES.map((route) => [route.key, route]));
