import { useEffect, useState } from "react";
import { DEX_LOOKUP } from "../constants/dex.js";
import { GAME_GENERATION_LOOKUP, GAME_LOGO_LOOKUP, GAME_LOOKUP, NATIONAL_GAME_ORDER } from "../constants/games.js";
import { loadPokedexMaps, loadPokemonList } from "../data/staticData.js";

export const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"];

// Games for the cartridge picker, newest generation first, newest release first within one
export const GAME_GROUPS = (() => {
  const byGen = new Map();
  [...NATIONAL_GAME_ORDER].reverse().forEach((key) => {
    const game = GAME_LOOKUP.get(key);
    const gen = GAME_GENERATION_LOOKUP.get(key);
    if (!game || gen == null) return;
    if (!byGen.has(gen)) byGen.set(gen, []);
    byGen.get(gen).push(game);
  });
  return [...byGen.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([gen, games]) => ({ gen, label: `Generation ${ROMAN[gen]}`, games }));
})();

export const regionLabel = (game) => DEX_LOOKUP.get(game?.dexKey)?.label || "";

export const gameLogos = (game) => (game?.logos || []).map((file) => GAME_LOGO_LOOKUP.get(file)).filter(Boolean);

let countsPromise = null;

/** Species count per game's Pokédex (and the National Dex), from the static dex snapshot. */
export function useDexCounts() {
  const [counts, setCounts] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (!countsPromise) {
      countsPromise = Promise.all([loadPokedexMaps(), loadPokemonList()]).then(([maps, list]) => {
        const out = new Map();
        out.set("national", list.filter((entry) => entry.id < 10000).length || null);
        for (const game of GAME_LOOKUP.values()) {
          const ids = new Set();
          for (const apiName of game.apiNames || []) maps[apiName]?.forEach((_, speciesId) => ids.add(speciesId));
          out.set(game.key, ids.size || null);
        }
        return out;
      });
      countsPromise.catch(() => {
        countsPromise = null;
      });
    }
    countsPromise.then((out) => !cancelled && setCounts(out)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return counts;
}

const GAME_PREF_KEY = "pref:game";

export const readGamePreference = () => {
  try {
    const key = localStorage.getItem(GAME_PREF_KEY);
    return key && GAME_LOOKUP.has(key) ? key : null;
  } catch {
    return null;
  }
};

export const writeGamePreference = (key) => {
  try {
    localStorage.setItem(GAME_PREF_KEY, key || "national");
  } catch {}
};
