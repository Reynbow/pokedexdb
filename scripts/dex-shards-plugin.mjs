// Splits public/data/pokemon_all.json (2.6 MB: every Pokémon's Pokédex entries and locations)
// into one small file per first letter, served at /data/dex/<letter>.json. Opening a Pokémon then
// downloads ~100 KB instead of the whole file. Generated on the fly in dev and emitted at build
// time, so pokemon_all.json stays the single source of truth.
import { readFileSync } from "node:fs";
import path from "node:path";

const SOURCE = path.join("public", "data", "pokemon_all.json");
const URL_PATH = "data/dex/";

/** Must match dexShardKey() in src/App.jsx. */
export const dexShardKey = (name) => {
  const first = String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .charAt(0);
  return first || "_";
};

const buildShards = (root) => {
  const records = JSON.parse(readFileSync(path.join(root, SOURCE), "utf8"));
  const shards = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const key = dexShardKey(record?.name);
    if (!shards.has(key)) shards.set(key, []);
    shards.get(key).push(record);
  }
  return shards;
};

export default function dexShards() {
  let root = process.cwd();
  let urlPrefix = `/${URL_PATH}`;
  return {
    name: "pokedexdb-dex-shards",
    configResolved(config) {
      root = config.root;
      urlPrefix = `${config.base.endsWith("/") ? config.base : `${config.base}/`}${URL_PATH}`;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || "").split("?")[0];
        if (!url.startsWith(urlPrefix) || !url.endsWith(".json")) return next();
        const key = url.slice(urlPrefix.length, -".json".length);
        const shard = buildShards(root).get(key) || [];
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(shard));
      });
    },
    generateBundle() {
      for (const [key, shard] of buildShards(root)) {
        this.emitFile({ type: "asset", fileName: `${URL_PATH}${key}.json`, source: JSON.stringify(shard) });
      }
    },
  };
}
