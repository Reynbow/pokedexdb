import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  findRecommendedNature,
  fetchSmogonSets,
  fetchSmogonAnalyses,
  fetchSmogonStats,
  fetchSmogonTeams,
  normalizeSpeciesName,
} from "./smogonApi";
import "./TestPage.css";

const DEFAULT_SPECIES = "gengar";
const POKEMON_LIST_URL = "https://pokeapi.co/api/v2/pokemon?limit=2000";
const POKEAPI_ITEM_URL = "https://pokeapi.co/api/v2/item?limit=30";
const POKEAPI_ABILITY_URL = "https://pokeapi.co/api/v2/ability?limit=30";
const POKEAPI_MOVE_URL = "https://pokeapi.co/api/v2/move?limit=30";
const POKEAPI_TYPE_URL = "https://pokeapi.co/api/v2/type";

const formatNature = (value) => {
  if (!value) return "-";
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(", ") || "-";
  }
  if (typeof value === "string") {
    return value;
  }
  return "-";
};

const flattenMoves = (moves) => {
  if (!Array.isArray(moves)) return [];
  const list = [];
  moves.forEach((entry) => {
    if (!entry) return;
    if (Array.isArray(entry)) {
      list.push(entry.join(" | "));
    } else if (typeof entry === "string") {
      list.push(entry);
    }
  });
  return list;
};

const baseUrl = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");

const API_OPTIONS = [
  { key: "smogon", label: "Smogon API" },
  { key: "pokeapi", label: "PokeAPI" },
];

const SMOGON_API_BASE = "https://data.pkmn.cc";

const POKEAPI_BASE = "https://pokeapi.co/api/v2/";
const SHOWDOWN_BASE = "https://play.pokemonshowdown.com/sprites";

const humanizeResourceName = (value) =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatGenerationLabel = (value) => {
  const match = /^gen(\d+)$/i.exec(String(value || ""));
  if (match) {
    return `Gen ${match[1]}`;
  }
  return humanizeResourceName(value);
};

const formatStatsFormatLabel = (value) => {
  const raw = String(value || "");
  const match = /^gen(\d+)(.*)$/i.exec(raw);
  if (!match) {
    return humanizeResourceName(raw);
  }
  const [, gen, remainder] = match;
  const cleaned = remainder
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ");
  const formatted = humanizeResourceName(cleaned);
  return `Gen ${gen} ${formatted}`.trim();
};

const SHOWDOWN_VARIANTS = [
  { key: "dex", label: "Dex (Static)", path: "dex", ext: "png" },
  { key: "dex-shiny", label: "Dex (Shiny)", path: "dex-shiny", ext: "png" },
  { key: "ani", label: "Animated Front", path: "ani", ext: "gif" },
  { key: "ani-shiny", label: "Animated Front (Shiny)", path: "ani-shiny", ext: "gif" },
  { key: "ani-back", label: "Animated Back", path: "ani-back", ext: "gif" },
  { key: "ani-back-shiny", label: "Animated Back (Shiny)", path: "ani-back-shiny", ext: "gif" },
  { key: "gen5", label: "Gen 5 Static Front", path: "gen5", ext: "png" },
  { key: "gen5-shiny", label: "Gen 5 Static Front (Shiny)", path: "gen5-shiny", ext: "png" },
  { key: "gen5-back", label: "Gen 5 Back", path: "gen5-back", ext: "png" },
  { key: "gen5-back-shiny", label: "Gen 5 Back (Shiny)", path: "gen5-back-shiny", ext: "png" },
  { key: "home", label: "HOME Render", path: "home", ext: "png" },
  { key: "home-shiny", label: "HOME Render (Shiny)", path: "home-shiny", ext: "png" },
  { key: "home-trimmed", label: "HOME Trimmed", path: "home-trimmed", ext: "png" },
  { key: "icons", label: "Menu Icons", path: "icons", ext: "png" },
  { key: "mini", label: "Mini Icons", path: "mini", ext: "png" },
  { key: "overworld", label: "Overworld Sprites", path: "overworld", ext: "png" },
];

const SHOWDOWN_RESOURCE_NOTES = [
  { key: "footprints", label: "Footprints", description: "Silhouettes used in battle UI.", path: "footprints" },
  { key: "dexback", label: "Dex Back Sprites", description: "Legacy back-facing sprites.", path: "dex-back" },
  { key: "models", label: "3D Models (GIF)", description: "Animated 3D renders for many Pokemon.", path: "models" },
  { key: "trainer", label: "Trainer Sprites", description: "Trainer and NPC sprites.", path: "trainer" },
  { key: "itemicons", label: "Item Icons", description: "In-battle held item icons.", path: "itemicons" },
];

const flattenSprites = (sprites, prefix = "") => {
  if (!sprites || typeof sprites !== "object") return [];
  const entries = [];
  Object.entries(sprites).forEach(([key, value]) => {
    if (!value) return;
    const label = prefix ? `${prefix} > ${humanizeResourceName(key)}` : humanizeResourceName(key);
    if (typeof value === "string") {
      entries.push({ key: `${prefix || "root"}.${key}`, label, url: value });
      return;
    }
    if (typeof value === "object" && !Array.isArray(value)) {
      entries.push(...flattenSprites(value, label));
    }
  });
  return entries;
};

const deriveShowdownOptions = (forms = []) => {
  const base = [{ key: "default", label: "Default", slug: null }];
  const extra = forms
    .filter((form) => form?.name)
    // Exclude Totem forms in test page selections as well
    .filter((form) => !String(form.name).toLowerCase().includes("totem"))
    .map((form) => ({
      key: form.name,
      label: humanizeResourceName(form.name),
      slug: form.name,
    }));
  const seen = new Set(base.map((entry) => entry.key));
  const merged = [...base];
  extra.forEach((entry) => {
    if (!seen.has(entry.key)) {
      seen.add(entry.key);
      merged.push(entry);
    }
  });
  return merged;
};

function TestPage() {
  const [activeApi, setActiveApi] = useState("smogon");
  const [selectedPokemon, setSelectedPokemon] = useState(DEFAULT_SPECIES);
  const [searchTerm, setSearchTerm] = useState(DEFAULT_SPECIES);
  const [pokemonOptions, setPokemonOptions] = useState({
    loading: false,
    error: null,
    list: [],
  });
  const [state, setState] = useState({
    loading: true,
    error: null,
    summary: null,
    datasets: null,
  });
  const [pokeRoot, setPokeRoot] = useState({
    loading: false,
    error: null,
    endpoints: null,
    lastUpdated: null,
  });
  const [pokeDetails, setPokeDetails] = useState({
    loading: false,
    error: null,
    data: null,
    species: null,
  });
  const [pokeCatalog, setPokeCatalog] = useState({
    loading: false,
    error: null,
    items: null,
    abilities: null,
    moves: null,
    types: null,
    lastUpdated: null,
  });
  const [catchData, setCatchData] = useState({
    loading: false,
    error: null,
    data: null,
  });
  const [selectedSpriteKey, setSelectedSpriteKey] = useState(null);
  const [selectedShowdownVariant, setSelectedShowdownVariant] = useState(
    SHOWDOWN_VARIANTS[0].key
  );
  const [selectedShowdownSlug, setSelectedShowdownSlug] = useState(null);

  useEffect(() => {
    console.log('[TestPage] Initializing...');
    setSearchTerm(selectedPokemon ? humanizeResourceName(selectedPokemon) : "");
  }, [selectedPokemon]);

  useEffect(() => {
    let cancelled = false;
    console.log('[TestPage] Pokemon list loader triggered', { hasList: pokemonOptions.list.length > 0, loading: pokemonOptions.loading });
    if (pokemonOptions.list.length > 0 || pokemonOptions.loading) {
      return;
    }
    setPokemonOptions((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));
    const load = async () => {
      try {
        console.log('[TestPage] Fetching Pokemon list from:', POKEMON_LIST_URL);
        const response = await fetch(POKEMON_LIST_URL);
        if (!response.ok) {
          throw new Error(`Unable to load Pokemon list (status ${response.status})`);
        }
        const payload = await response.json();
        if (cancelled) return;
        console.log('[TestPage] Pokemon list loaded, processing results');
        const list = Array.isArray(payload?.results)
          ? payload.results.map((entry) => ({
              name: entry?.name || "",
              url: entry?.url || "",
              normalized: normalizeSpeciesName(entry?.name || ""),
            }))
          : [];
        console.log('[TestPage] Processed', list.length, 'Pokemon');
        setPokemonOptions({
          loading: false,
          error: null,
          list,
        });
      } catch (error) {
        console.error('[TestPage] Failed to load Pokemon list:', error);
        if (cancelled) return;
        setPokemonOptions({
          loading: false,
          error: error.message || String(error),
          list: [],
        });
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [pokemonOptions.list.length, pokemonOptions.loading]);

  useEffect(() => {
    let cancelled = false;
    const alias = selectedPokemon || DEFAULT_SPECIES;
    setState({
      loading: true,
      error: null,
      summary: null,
      datasets: null,
    });
    const load = async () => {
      try {
        const natureResult = await findRecommendedNature(alias);
        if (cancelled) return;
        const generation = natureResult.generation || "gen9";
        const defaultSpeciesKey = humanizeResourceName(alias || DEFAULT_SPECIES);
        const speciesKey = natureResult.speciesKey || defaultSpeciesKey;

        const setsData = await fetchSmogonSets(generation);
        if (cancelled) return;
        const speciesSets = setsData?.[speciesKey] || null;
        const availableFormats = speciesSets ? Object.keys(speciesSets) : [];
        const primaryFormat = natureResult.format || availableFormats[0] || null;

        let analysisEntry = null;
        try {
          const analysisData = await fetchSmogonAnalyses(generation);
          if (cancelled) return;
          const speciesAnalyses = analysisData?.[speciesKey] || null;
          if (speciesAnalyses) {
            if (primaryFormat && speciesAnalyses[primaryFormat]) {
              analysisEntry = speciesAnalyses[primaryFormat];
            } else {
              const firstKey = Object.keys(speciesAnalyses)[0];
              analysisEntry = firstKey ? speciesAnalyses[firstKey] : null;
            }
          }
        } catch (analysisError) {
          if (cancelled) return;
          analysisEntry = { error: analysisError.message || String(analysisError) };
        }

        const statsFormat = primaryFormat ? `${generation}${primaryFormat}` : null;
        let statsEntry = null;
        let statsMeta = null;
        if (statsFormat) {
          try {
            const statsData = await fetchSmogonStats(statsFormat);
            if (cancelled) return;
            statsMeta = {
              battles: statsData?.battles ?? null,
              cutoff: statsData?.cutoff ?? null,
              format: statsFormat,
            };
            const pokemonStats = statsData?.pokemon || {};
            const normalizedTarget = normalizeSpeciesName(speciesKey);
            statsEntry =
              Object.entries(pokemonStats).find(
                ([name]) => normalizeSpeciesName(name) === normalizedTarget
              )?.[1] || null;
          } catch (statsError) {
            if (cancelled) return;
            statsEntry = { error: statsError.message || String(statsError) };
          }
        }

        let teamList = null;
        if (statsFormat) {
          try {
            const teamsData = await fetchSmogonTeams(statsFormat);
            if (cancelled) return;
            if (Array.isArray(teamsData)) {
              const target = normalizeSpeciesName(speciesKey);
              teamList = teamsData
                .filter(
                  (team) =>
                    Array.isArray(team?.data) &&
                    team.data.some((member) => normalizeSpeciesName(member?.species) === target)
                )
                .slice(0, 5);
            } else {
              teamList = [];
            }
          } catch (teamsError) {
            if (cancelled) return;
            teamList = [{ error: teamsError.message || String(teamsError) }];
          }
        }

        if (cancelled) return;
        setState({
          loading: false,
          error: null,
          summary: {
            alias,
            generation,
            speciesKey,
            primaryFormat,
            nature: natureResult.nature || null,
            setName: natureResult.setName || null,
            searched: natureResult.searched,
            statsFormat,
          },
          datasets: {
            sets: speciesSets,
            formats: availableFormats,
            analysis: analysisEntry,
            stats: statsEntry,
            statsMeta,
            teams: teamList,
          },
        });
      } catch (error) {
        if (cancelled) return;
        setState({
          loading: false,
          error: error.message || String(error),
          summary: null,
          datasets: null,
        });
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedPokemon]);

  useEffect(() => {
    if (!selectedPokemon) {
      return;
    }
    let cancelled = false;
    const applyReset = () => {
      setPokeDetails({
        loading: true,
        error: null,
        data: null,
        species: null,
      });
      setSelectedSpriteKey(null);
      setSelectedShowdownSlug(null);
    };
    applyReset();
    const load = async () => {
      try {
        const normalized = selectedPokemon.trim().toLowerCase();
        const response = await fetch(`${POKEAPI_BASE}pokemon/${encodeURIComponent(normalized)}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Pokemon "${selectedPokemon}" was not found in PokeAPI.`);
          }
          throw new Error(`PokeAPI Pokemon lookup failed (status ${response.status}).`);
        }
        const pokemonData = await response.json();
        if (cancelled) return;
        let speciesData = null;
        try {
          const speciesUrl = pokemonData?.species?.url;
          if (speciesUrl) {
            const speciesResponse = await fetch(speciesUrl);
            if (speciesResponse.ok) {
              speciesData = await speciesResponse.json();
            }
          }
        } catch {
          speciesData = null;
        }
        setPokeDetails({
          loading: false,
          error: null,
          data: pokemonData,
          species: speciesData,
        });
      } catch (error) {
        if (cancelled) return;
        setPokeDetails({
          loading: false,
          error: error.message || String(error),
          data: null,
          species: null,
        });
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedPokemon]);

  // Fetch catch location data
  useEffect(() => {
    console.log('[TestPage] Catch data loader triggered', { 
      speciesId: pokeDetails.species?.id, 
      pokemonId: pokeDetails.data?.id 
    });
    if (!pokeDetails.species?.id) {
      setCatchData({ loading: false, error: null, data: null });
      return;
    }
    let cancelled = false;
    setCatchData({ loading: true, error: null, data: null });
    const load = async () => {
      try {
        const url = `${POKEAPI_BASE}pokemon/${pokeDetails.data?.id}/encounters`;
        console.log('[TestPage] Fetching encounter data from:', url);
        const response = await fetch(url);
        if (cancelled) return;
        if (!response.ok) {
          throw new Error(`Failed to load encounter data (status ${response.status})`);
        }
        const data = await response.json();
        if (cancelled) return;
        console.log('[TestPage] Encounter data loaded, locations:', data.length);
        setCatchData({ loading: false, error: null, data });
      } catch (error) {
        console.error('[TestPage] Failed to load encounter data:', error);
        if (cancelled) return;
        setCatchData({ loading: false, error: error.message || String(error), data: null });
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [pokeDetails.species?.id, pokeDetails.data?.id]);

  const spriteOptions = useMemo(() => {
    if (!pokeDetails.data?.sprites) return [];
    const flattened = flattenSprites(pokeDetails.data.sprites);
    const unique = [];
    const seen = new Set();
    flattened.forEach((entry) => {
      if (!entry?.url) return;
      const key = entry.url;
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(entry);
    });
    return unique;
  }, [pokeDetails.data]);

  useEffect(() => {
    if (!selectedSpriteKey && spriteOptions.length > 0) {
      setSelectedSpriteKey(spriteOptions[0].key);
    }
  }, [selectedSpriteKey, spriteOptions]);

  const activeSprite = useMemo(() => {
    if (!selectedSpriteKey) return null;
    return spriteOptions.find((entry) => entry.key === selectedSpriteKey) || null;
  }, [selectedSpriteKey, spriteOptions]);

  const showdownFormOptions = useMemo(() => {
    const primaryForms = Array.isArray(pokeDetails.data?.forms)
      ? pokeDetails.data.forms
      : [];
    const varieties = Array.isArray(pokeDetails.species?.varieties)
      ? pokeDetails.species.varieties.map((entry) => entry?.pokemon).filter(Boolean)
      : [];
    const merged = [...primaryForms, ...varieties];
    return deriveShowdownOptions(merged);
  }, [pokeDetails.data, pokeDetails.species]);

  useEffect(() => {
    if (
      selectedShowdownSlug &&
      !showdownFormOptions.some((option) => option.slug === selectedShowdownSlug)
    ) {
      setSelectedShowdownSlug(null);
    }
  }, [selectedShowdownSlug, showdownFormOptions]);

  const filteredPokemonSuggestions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const source = [...pokemonOptions.list].sort((a, b) => a.name.localeCompare(b.name));
    if (!term) {
      return source.slice(0, 25);
    }
    return source
      .filter(
        (option) =>
          option.name.includes(term) ||
          option.normalized.includes(term) ||
          humanizeResourceName(option.name).toLowerCase().includes(term)
      )
      .slice(0, 25);
  }, [pokemonOptions.list, searchTerm]);

  const englishFlavorText = useMemo(() => {
    const entries = pokeDetails.species?.flavor_text_entries;
    if (!Array.isArray(entries)) return null;
    const englishEntries = entries.filter((entry) => entry?.language?.name === "en");
    if (englishEntries.length === 0) return null;
    return englishEntries[englishEntries.length - 1]?.flavor_text?.replace(/\s+/g, " ") || null;
  }, [pokeDetails.species]);

  const showdownVariantData = useMemo(() => {
    return (
      SHOWDOWN_VARIANTS.find((variant) => variant.key === selectedShowdownVariant) ||
      SHOWDOWN_VARIANTS[0]
    );
  }, [selectedShowdownVariant]);

  const showdownSlug = useMemo(() => {
    const target = selectedShowdownSlug || selectedPokemon;
    return String(target || "").trim().toLowerCase();
  }, [selectedShowdownSlug, selectedPokemon]);

  const showdownSpriteUrl = useMemo(() => {
    if (!showdownVariantData || !showdownSlug) return null;
    const encodedSlug = encodeURIComponent(showdownSlug);
    const extension = showdownVariantData.ext || "png";
    return `${SHOWDOWN_BASE}/${showdownVariantData.path}/${encodedSlug}.${extension}`;
  }, [showdownSlug, showdownVariantData]);

  useEffect(() => {
    if (activeApi !== "pokeapi") return;
    if (pokeRoot.endpoints || pokeRoot.loading) return;
    let cancelled = false;
    setPokeRoot((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));
    const load = async () => {
      try {
        const response = await fetch(POKEAPI_BASE);
        if (!response.ok) {
          throw new Error(`PokeAPI responded with status ${response.status}`);
        }
        const data = await response.json();
        if (cancelled) return;
        const endpoints = Object.entries(data || {})
          .filter(([, value]) => typeof value === "string")
          .map(([name, url]) => ({
            name,
            url: typeof url === "string" ? url : null,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setPokeRoot({
          loading: false,
          error: null,
          endpoints,
          lastUpdated: new Date().toISOString(),
        });
      } catch (error) {
        if (cancelled) return;
        setPokeRoot({
          loading: false,
          error: error.message || String(error),
          endpoints: null,
          lastUpdated: null,
        });
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [activeApi, pokeRoot.endpoints, pokeRoot.loading]);

  useEffect(() => {
    if (activeApi !== "pokeapi") return;
    // Skip if already loaded or currently loading
    if (pokeCatalog.loading || (pokeCatalog.items && pokeCatalog.abilities && pokeCatalog.moves && pokeCatalog.types)) {
      return;
    }
    let cancelled = false;
    setPokeCatalog((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));
    const load = async () => {
      try {
        const [itemsRes, abilitiesRes, movesRes, typesRes] = await Promise.all([
          fetch(POKEAPI_ITEM_URL),
          fetch(POKEAPI_ABILITY_URL),
          fetch(POKEAPI_MOVE_URL),
          fetch(POKEAPI_TYPE_URL),
        ]);
        if (cancelled) return;
        if (!itemsRes.ok || !abilitiesRes.ok || !movesRes.ok || !typesRes.ok) {
          throw new Error("Failed to load extended PokeAPI catalogs.");
        }
        const [itemsData, abilitiesData, movesData, typesData] = await Promise.all([
          itemsRes.json(),
          abilitiesRes.json(),
          movesRes.json(),
          typesRes.json(),
        ]);
        if (cancelled) return;
        const mapResults = (payload) =>
          Array.isArray(payload?.results)
            ? payload.results
                .map((entry) => ({
                  name: entry?.name || "",
                  url: entry?.url || "",
                }))
                .filter((entry) => entry.name)
            : [];
        setPokeCatalog({
          loading: false,
          error: null,
          items: mapResults(itemsData),
          abilities: mapResults(abilitiesData),
          moves: mapResults(movesData),
          types: mapResults(typesData),
          lastUpdated: new Date().toISOString(),
        });
      } catch (error) {
        if (cancelled) return;
        setPokeCatalog({
          loading: false,
          error: error.message || String(error),
          items: null,
          abilities: null,
          moves: null,
          types: null,
          lastUpdated: null,
        });
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [activeApi]);

  const handlePokeRetry = useCallback(() => {
    setPokeRoot({
      loading: false,
      error: null,
      endpoints: null,
      lastUpdated: null,
    });
  }, []);

  const handleApiSelect = useCallback((value) => {
    setActiveApi(value);
  }, []);

  const applyPokemonSelection = useCallback(
    (rawValue) => {
      const value = String(rawValue || "").trim();
      if (!value) return;
      const normalized = normalizeSpeciesName(value);
      const directMatch =
        pokemonOptions.list.find((option) => option.name === value.toLowerCase()) ||
        pokemonOptions.list.find((option) => option.name === normalized) ||
        pokemonOptions.list.find((option) => option.normalized === normalized);
      const nextValue = directMatch?.name || normalized;
      const nextLabel = humanizeResourceName(nextValue);
      if (!nextValue || nextValue === selectedPokemon) {
        setSearchTerm(nextValue ? nextLabel : value);
        return;
      }
      setSelectedPokemon(nextValue);
      setSearchTerm(nextLabel);
    },
    [pokemonOptions.list, selectedPokemon]
  );

  const handleSearchSubmit = useCallback(
    (event) => {
      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }
      applyPokemonSelection(searchTerm);
    },
    [applyPokemonSelection, searchTerm]
  );

  const handleSearchInputChange = useCallback((event) => {
    setSearchTerm(event.target.value);
  }, []);

  const handleSearchInputBlur = useCallback(() => {
    applyPokemonSelection(searchTerm);
  }, [applyPokemonSelection, searchTerm]);

  const handleSpriteSelect = useCallback((event) => {
    setSelectedSpriteKey(event.target.value || null);
  }, []);

  const handleShowdownVariantChange = useCallback((event) => {
    setSelectedShowdownVariant(event.target.value || SHOWDOWN_VARIANTS[0].key);
  }, []);

  const handleShowdownFormChange = useCallback((event) => {
    const value = event.target.value;
    if (!value || value === "__default__") {
      setSelectedShowdownSlug(null);
    } else {
      setSelectedShowdownSlug(value);
    }
  }, []);

  const smogonContent = useMemo(() => {
    if (state.loading) {
      return (
        <div className="test-section">
          <p className="test-status">Loading Smogon data…</p>
        </div>
      );
    }
    if (state.error) {
      return (
        <div className="test-section">
          <p className="test-status error">Unable to load Smogon data: {state.error}</p>
        </div>
      );
    }
    const { summary, datasets } = state;
    if (!summary || !datasets) {
      return null;
    }
    const selectionLabel = humanizeResourceName(selectedPokemon);
    const usagePct =
      typeof datasets.stats?.usage?.weighted === "number"
        ? (datasets.stats.usage.weighted * 100).toFixed(2)
        : null;
    const leadPct =
      typeof datasets.stats?.lead?.weighted === "number"
        ? (datasets.stats.lead.weighted * 100).toFixed(2)
        : null;
    const totalBattles =
      typeof datasets.statsMeta?.battles === "number" ? datasets.statsMeta.battles : null;
    const topMoves =
      datasets.stats?.moves && typeof datasets.stats.moves === "object"
        ? Object.entries(datasets.stats.moves).slice(0, 5)
        : [];
    const smogonEndpoints = [];
    if (summary.generation) {
      smogonEndpoints.push({
        key: "sets",
        label: `${formatGenerationLabel(summary.generation)} Sets`,
        url: `${SMOGON_API_BASE}/sets/${summary.generation}.json`,
        description: "Movesets and spreads grouped by competitive format.",
      });
      smogonEndpoints.push({
        key: "analyses",
        label: `${formatGenerationLabel(summary.generation)} Analyses`,
        url: `${SMOGON_API_BASE}/analyses/${summary.generation}.json`,
        description: "Smogon strategy writeups for each supported format.",
      });
    }
    if (summary.statsFormat) {
      smogonEndpoints.push({
        key: "stats",
        label: `${formatStatsFormatLabel(summary.statsFormat)} Usage Stats`,
        url: `${SMOGON_API_BASE}/stats/${summary.statsFormat}.json`,
        description: "Usage, lead rates, teammates, and move statistics.",
      });
      smogonEndpoints.push({
        key: "teams",
        label: `${formatStatsFormatLabel(summary.statsFormat)} Sample Teams`,
        url: `${SMOGON_API_BASE}/teams/${summary.statsFormat}.json`,
        description: "Curated teams submitted for the selected ladder format.",
      });
    }
    return (
      <>
        <section className="test-section">
          <div className="section-heading">
            <h2>Summary</h2>
            <span className="section-meta">
              {summary.generation ? formatGenerationLabel(summary.generation) : "-"}
            </span>
          </div>
          <div className="summary-grid">
            <div>
              <span className="label">Requested Alias</span>
              <span className="value text-capitalize">{summary.alias || "-"}</span>
            </div>
            <div>
              <span className="label">Matched Species</span>
              <span className="value">{summary.speciesKey || "-"}</span>
            </div>
            <div>
              <span className="label">Recommended Nature</span>
              <span className="value text-capitalize">{formatNature(summary.nature)}</span>
            </div>
            <div>
              <span className="label">Primary Format</span>
              <span className="value">{summary.primaryFormat || "-"}</span>
            </div>
            <div>
              <span className="label">Detected Generation</span>
              <span className="value">{summary.generation || "-"}</span>
            </div>
            <div>
              <span className="label">Set Name</span>
              <span className="value">{summary.setName || "-"}</span>
            </div>
            <div>
              <span className="label">Stats Dataset</span>
              <span className="value">{summary.statsFormat || "-"}</span>
            </div>
          </div>
          {Array.isArray(summary.searched) && summary.searched.length > 0 && (
            <p className="search-trail">
              Generations searched: {summary.searched.join(" | ")}
            </p>
          )}
        </section>

        {smogonEndpoints.length > 0 && (
          <section className="test-section">
            <div className="section-heading">
              <h2>Smogon API Endpoints</h2>
              <span className="section-meta">{smogonEndpoints.length}</span>
            </div>
            <ul className="endpoint-list">
              {smogonEndpoints.map((endpoint) => (
                <li key={endpoint.url} className="endpoint-row">
                  <div className="endpoint-main">
                    <a href={endpoint.url} target="_blank" rel="noreferrer">
                      {endpoint.label}
                    </a>
                    <code className="endpoint-url">{endpoint.url}</code>
                  </div>
                  {endpoint.description && (
                    <p className="endpoint-description">{endpoint.description}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="test-section">
          <div className="section-heading">
            <h2>Movesets</h2>
            <span className="section-meta">
              Formats available: {datasets.formats.length || 0}
            </span>
          </div>
          {datasets.sets ? (
            <div className="card-grid">
              {Object.entries(datasets.sets).map(([formatKey, formatSets]) => (
                <article key={formatKey} className="data-card">
                  <header className="card-header">
                    <h3>{formatKey}</h3>
                  </header>
                  <div className="card-body">
                    {Object.entries(formatSets).map(([setName, setData]) => (
                      <div key={setName} className="set-block">
                        <div className="set-title">
                          <h4>{setName}</h4>
                          <span className="set-nature">{formatNature(setData?.nature)}</span>
                        </div>
                        {setData?.item && (
                          <p className="set-line">
                            <span className="tag">Item</span>
                            <span>{Array.isArray(setData.item) ? setData.item.join(" | ") : setData.item}</span>
                          </p>
                        )}
                        {setData?.ability && (
                          <p className="set-line">
                            <span className="tag">Ability</span>
                            <span>
                              {Array.isArray(setData.ability)
                                ? setData.ability.join(" | ")
                                : setData.ability}
                            </span>
                          </p>
                        )}
                        {setData?.moves && (
                          <ul className="move-list">
                            {flattenMoves(setData.moves).map((move) => (
                              <li key={move}>{move}</li>
                            ))}
                          </ul>
                        )}
                        {setData?.evs && (
                          <p className="set-line">
                            <span className="tag">EVs</span>
                            <span>
                              {Object.entries(setData.evs)
                                .map(([stat, value]) => `${stat.toUpperCase()}: ${value}`)
                                .join(" | ")}
                            </span>
                          </p>
                        )}
                        {setData?.teratypes && (
                          <p className="set-line">
                            <span className="tag">Tera</span>
                            <span>
                              {Array.isArray(setData.teratypes)
                                ? setData.teratypes.join(" | ")
                                : setData.teratypes}
                            </span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="test-status muted">No moveset data available.</p>
          )}
        </section>

        <section className="test-section">
          <div className="section-heading">
            <h2>Analysis</h2>
            <span className="section-meta">
              {datasets.analysis?.error ? "Unavailable" : summary.primaryFormat || "-"}
            </span>
          </div>
          {datasets.analysis?.error ? (
            <p className="test-status error">{datasets.analysis.error}</p>
          ) : datasets.analysis ? (
            <div className="analysis-content">
              {datasets.analysis.overview && (
                <div
                  className="analysis-block"
                  dangerouslySetInnerHTML={{ __html: datasets.analysis.overview }}
                />
              )}
              {datasets.analysis.sets && (
                <div className="analysis-block">
                  <h3>Sets</h3>
                  {Object.entries(datasets.analysis.sets).map(([setName, setData]) => (
                    <article key={setName} className="analysis-set">
                      <h4>{setName}</h4>
                      {setData?.description && (
                        <div
                          className="analysis-text"
                          dangerouslySetInnerHTML={{ __html: setData.description }}
                        />
                      )}
                      {setData?.usage && (
                        <div
                          className="analysis-text"
                          dangerouslySetInnerHTML={{ __html: setData.usage }}
                        />
                      )}
                    </article>
                  ))}
                </div>
              )}
              {datasets.analysis.comments && (
                <div
                  className="analysis-block"
                  dangerouslySetInnerHTML={{ __html: datasets.analysis.comments }}
                />
              )}
            </div>
          ) : (
            <p className="test-status muted">No analysis data available.</p>
          )}
        </section>

        <section className="test-section">
          <div className="section-heading">
            <h2>Usage Statistics</h2>
            <span className="section-meta">
              {datasets.statsMeta?.format || summary.statsFormat || "-"}
            </span>
          </div>
          {datasets.stats?.error ? (
            <p className="test-status error">{datasets.stats.error}</p>
          ) : datasets.stats ? (
            <div className="stats-grid">
              {totalBattles != null && (
                <div>
                  <span className="label">Total Battles</span>
                  <span className="value">{totalBattles.toLocaleString()}</span>
                </div>
              )}
              {usagePct && (
                <div>
                  <span className="label">Usage Rate</span>
                  <span className="value">{usagePct}%</span>
                </div>
              )}
              {leadPct && (
                <div>
                  <span className="label">Lead Rate</span>
                  <span className="value">{leadPct}%</span>
                </div>
              )}
              {topMoves.length > 0 && (
                <div className="wide">
                  <span className="label">Top Moves</span>
                  <span className="value">
                    {topMoves
                      .map(([move, pct]) =>
                        `${move} (${typeof pct === "number" ? (pct * 100).toFixed(1) : "0.0"}%)`
                      )
                      .join(" | ")}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="test-status muted">No usage statistics available.</p>
          )}
        </section>

        <section className="test-section">
          <div className="section-heading">
            <h2>Sample Teams Featuring {selectionLabel}</h2>
            <span className="section-meta">
              {Array.isArray(datasets.teams) ? datasets.teams.length : 0}
            </span>
          </div>
          {Array.isArray(datasets.teams) && datasets.teams.length > 0 ? (
            <div className="card-grid">
              {datasets.teams.map((team, idx) => (
                <article key={team?.name || idx} className="data-card">
                  {team?.error ? (
                    <p className="test-status error">{team.error}</p>
                  ) : (
                    <>
                      <header className="card-header">
                        <h3>{team?.name || `Team ${idx + 1}`}</h3>
                        {team?.author && <span className="card-subtitle">by {team.author}</span>}
                      </header>
                      <div className="card-body">
                        <ul className="team-list">
                          {(team?.data || []).map((member, memberIdx) => (
                            <li key={`${member?.species || "member"}-${memberIdx}`}>
                              <span className="text-capitalize">{member?.species || "Unknown"}</span>
                              {member?.item && <span className="item-chip">{member.item}</span>}
                              {member?.nature && <span className="item-chip">{member.nature}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="test-status muted">
              No sample teams include {selectionLabel} in this format.
            </p>
          )}
        </section>
      </>
    );
  }, [selectedPokemon, state]);

  const pokeContent = useMemo(() => {
    const endpoints = Array.isArray(pokeRoot.endpoints) ? pokeRoot.endpoints : [];
    const detailLoading = pokeDetails.loading && !pokeDetails.data;
    const detailError = pokeDetails.error;
    const rootError = pokeRoot.error;
    const catalogError = pokeCatalog.error;
    const catalogReady =
      Array.isArray(pokeCatalog.items) &&
      Array.isArray(pokeCatalog.abilities) &&
      Array.isArray(pokeCatalog.moves) &&
      Array.isArray(pokeCatalog.types);
    const pokemonData = pokeDetails.data;
    const selectedLabel = humanizeResourceName(selectedPokemon);
    const pokemonId =
      typeof pokemonData?.id === "number" ? `#${String(pokemonData.id).padStart(4, "0")}` : "-";
    const heightMeters =
      typeof pokemonData?.height === "number" ? (pokemonData.height / 10).toFixed(1) : null;
    const weightKilograms =
      typeof pokemonData?.weight === "number" ? (pokemonData.weight / 10).toFixed(1) : null;
    const baseExperience =
      typeof pokemonData?.base_experience === "number" ? pokemonData.base_experience : null;
    const typeList = Array.isArray(pokemonData?.types)
      ? pokemonData.types.map((entry) => entry?.type?.name).filter(Boolean)
      : [];
    const allAbilities = Array.isArray(pokemonData?.abilities)
      ? pokemonData.abilities
          .map((entry) => ({
            name: entry?.ability?.name,
            hidden: Boolean(entry?.is_hidden),
          }))
          .filter((entry) => entry.name)
      : [];
    
    // Separate regular abilities from hidden abilities
    const regularAbilities = allAbilities.filter((ability) => !ability.hidden);
    const hiddenAbilities = allAbilities.filter((ability) => ability.hidden);
    const statsList = Array.isArray(pokemonData?.stats)
      ? pokemonData.stats
          .map((entry) => ({
            name: entry?.stat?.name,
            value: entry?.base_stat,
          }))
          .filter((entry) => entry.name && entry.value != null)
      : [];
    const heldItems = Array.isArray(pokemonData?.held_items)
      ? pokemonData.held_items
          .map((entry) => entry?.item?.name)
          .filter(Boolean)
      : [];
    const movePreview = Array.isArray(pokemonData?.moves)
      ? pokemonData.moves
          .map((entry) => {
            const detail = Array.isArray(entry?.version_group_details)
              ? entry.version_group_details[0]
              : null;
            return {
              name: entry?.move?.name,
              method: detail?.move_learn_method?.name || null,
              level:
                typeof detail?.level_learned_at === "number" ? detail.level_learned_at : null,
            };
          })
          .filter((entry) => entry.name)
          .sort((a, b) => {
            if (a.level != null && b.level != null) return a.level - b.level;
            if (a.level != null) return -1;
            if (b.level != null) return 1;
            return a.name.localeCompare(b.name);
          })
          .slice(0, 12)
      : [];
    const generationName = humanizeResourceName(
      pokeDetails.species?.generation?.name || ""
    );
    const captureRate =
      typeof pokeDetails.species?.capture_rate === "number"
        ? pokeDetails.species.capture_rate
        : null;
    const growthRate = humanizeResourceName(pokeDetails.species?.growth_rate?.name || "");

    return (
      <>
        <section className="test-section">
          <div className="section-heading">
            <h2>{selectedLabel} Overview</h2>
            <span className="section-meta">{pokemonId}</span>
          </div>
          {detailLoading ? (
            <p className="test-status">Loading Pokemon data for {selectedLabel}.</p>
          ) : detailError ? (
            <p className="test-status error">{detailError}</p>
          ) : pokemonData ? (
            <>
              <div className="profile-overview">
                <div className="profile-sprite">
                  {activeSprite ? (
                    <img
                      src={activeSprite.url}
                      alt={`${selectedLabel} sprite`}
                      loading="lazy"
                      className="sprite-image"
                    />
                  ) : (
                    <div className="sprite-placeholder">Sprite unavailable</div>
                  )}
                </div>
                <div className="profile-summary">
                  <div className="summary-grid">
                    <div>
                      <span className="label">Typing</span>
                      <span className="value text-capitalize">
                        {typeList.length ? typeList.join(" | ") : "-"}
                      </span>
                    </div>
                    <div>
                      <span className="label">Height</span>
                      <span className="value">{heightMeters ? `${heightMeters} m` : "-"}</span>
                    </div>
                    <div>
                      <span className="label">Weight</span>
                      <span className="value">
                        {weightKilograms ? `${weightKilograms} kg` : "-"}
                      </span>
                    </div>
                    <div>
                      <span className="label">Base Experience</span>
                      <span className="value">{baseExperience ?? "-"}</span>
                    </div>
                    <div>
                      <span className="label">Generation</span>
                      <span className="value">{generationName || "-"}</span>
                    </div>
                    <div>
                      <span className="label">Capture Rate</span>
                      <span className="value">{captureRate != null ? captureRate : "-"}</span>
                    </div>
                    <div>
                      <span className="label">Growth Rate</span>
                      <span className="value">{growthRate || "-"}</span>
                    </div>
                    <div>
                      <span className="label">Ability Count</span>
                      <span className="value">{allAbilities.length}</span>
                    </div>
                  </div>
                  {englishFlavorText && (
                    <p className="flavor-text">“{englishFlavorText}”</p>
                  )}
                </div>
              </div>
              <div className="profile-details-grid">
                {regularAbilities.length > 0 && (
                  <article className="profile-card">
                    <h3>Abilities</h3>
                    <ul className="ability-list">
                      {regularAbilities.map((ability) => (
                        <li key={ability.name}>
                          <span className="text-capitalize">{humanizeResourceName(ability.name)}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                )}
                {statsList.length > 0 && (
                  <article className="profile-card">
                    <h3>Base Stats</h3>
                    <ul className="stat-list">
                      {statsList.map((stat) => (
                        <li key={stat.name}>
                          <span className="text-capitalize">{stat.name}</span>
                          <span className="stat-value">{stat.value}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                )}
                {heldItems.length > 0 && (
                  <article className="profile-card">
                    <h3>Held Items</h3>
                    <ul className="pill-list">
                      {heldItems.map((item) => (
                        <li key={item} className="pill">
                          {humanizeResourceName(item)}
                        </li>
                      ))}
                    </ul>
                  </article>
                )}
                {movePreview.length > 0 && (
                  <article className="profile-card">
                    <h3>Move Highlights</h3>
                    <ul className="move-preview">
                      {movePreview.map((move) => (
                        <li key={move.name}>
                          <span className="text-capitalize">{move.name}</span>
                          <span className="move-meta">
                            {move.level != null ? `Lv ${move.level}` : "-"} |{" "}
                            {move.method ? humanizeResourceName(move.method) : "Unknown"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </article>
                )}
              </div>
              {hiddenAbilities.length > 0 && (
                <article className="profile-card" style={{ marginTop: '1.5rem' }}>
                  <h3>Hidden Ability</h3>
                  <ul className="ability-list">
                    {hiddenAbilities.map((ability) => (
                      <li key={ability.name}>
                        <span className="text-capitalize">{humanizeResourceName(ability.name)}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              )}
            </>
          ) : (
            <p className="test-status muted">
              Select a Pokemon above to populate this section.
            </p>
          )}
        </section>

        <section className="test-section">
          <div className="section-heading">
            <h2>Sprite Gallery</h2>
            <span className="section-meta">
              {spriteOptions.length + (showdownSpriteUrl ? 1 : 0)}
            </span>
          </div>
          <div className="sprite-gallery">
            <div className="sprite-column">
              <h3>PokeAPI Sprites</h3>
              {spriteOptions.length > 0 ? (
                <>
                  <label className="control-label" htmlFor="pokeapi-sprite-select">
                    Sprite Variant
                  </label>
                  <select
                    id="pokeapi-sprite-select"
                    value={selectedSpriteKey || ""}
                    onChange={handleSpriteSelect}
                    className="sprite-select"
                  >
                    {spriteOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {activeSprite ? (
                    <>
                      <img
                        src={activeSprite.url}
                        alt={`${selectedLabel} sprite variant`}
                        loading="lazy"
                        className="sprite-image"
                      />
                      <code className="endpoint-url">{activeSprite.url}</code>
                    </>
                  ) : (
                    <p className="test-status muted">Sprite unavailable.</p>
                  )}
                </>
              ) : (
                <p className="test-status muted">
                  PokeAPI did not return sprite data for this Pokemon.
                </p>
              )}
            </div>
            <div className="sprite-column">
              <h3>Pokemon Showdown CDN</h3>
              <label className="control-label" htmlFor="showdown-variant-select">
                Sprite Set
              </label>
              <select
                id="showdown-variant-select"
                value={selectedShowdownVariant}
                onChange={handleShowdownVariantChange}
                className="sprite-select"
              >
                {SHOWDOWN_VARIANTS.map((variant) => (
                  <option key={variant.key} value={variant.key}>
                    {variant.label}
                  </option>
                ))}
              </select>
              <label className="control-label" htmlFor="showdown-form-select">
                Form
              </label>
              <select
                id="showdown-form-select"
                value={selectedShowdownSlug || "__default__"}
                onChange={handleShowdownFormChange}
                className="sprite-select"
              >
                {showdownFormOptions.map((option) => (
                  <option key={option.key} value={option.slug || "__default__"}>
                    {option.label}
                  </option>
                ))}
              </select>
              {showdownSpriteUrl ? (
                <>
                  <img
                    src={showdownSpriteUrl}
                    alt={`${selectedLabel} showdown sprite`}
                    loading="lazy"
                    className="sprite-image"
                  />
                  <code className="endpoint-url">{showdownSpriteUrl}</code>
                </>
              ) : (
                <p className="test-status muted">
                  No matching sprite found on the Pokemon Showdown CDN.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="test-section">
          <div className="section-heading">
            <h2>Catch Locations by Game</h2>
            <span className="section-meta">
              {catchData.loading ? "Loading" : catchData.data?.length || 0} locations
            </span>
          </div>
          {catchData.loading && <p className="test-status">Loading encounter data…</p>}
          {catchData.error && <p className="test-status error">{catchData.error}</p>}
          {catchData.data && Array.isArray(catchData.data) && catchData.data.length > 0 ? (
            <div className="catch-locations">
              {catchData.data.map((location, idx) => {
                const locationArea = location?.location_area?.name;
                const versionDetails = Array.isArray(location?.version_details) ? location.version_details : [];
                return (
                  <article key={idx} className="catch-location-card">
                    <h3>{locationArea ? humanizeResourceName(locationArea) : `Location ${idx + 1}`}</h3>
                    <div className="version-list">
                      {versionDetails.map((detail, detailIdx) => {
                        const version = detail?.version?.name;
                        const encounters = Array.isArray(detail?.encounter_details) ? detail.encounter_details : [];
                        if (!version || encounters.length === 0) return null;
                        return (
                          <div key={detailIdx} className="version-entry">
                            <h4>{humanizeResourceName(version)}</h4>
                            <ul className="encounter-list">
                              {encounters.map((encounter, encIdx) => {
                                const method = encounter?.method?.name;
                                const minLevel = encounter?.min_level;
                                const maxLevel = encounter?.max_level;
                                const chance = encounter?.chance;
                                const timeOfDay = encounter?.time_of_day;
                                return (
                                  <li key={encIdx} className="encounter-item">
                                    <span className="text-capitalize">{method || "Unknown"}</span>
                                    {minLevel && maxLevel && (
                                      <span className="level-range">Lv {minLevel}-{maxLevel}</span>
                                    )}
                                    {minLevel && !maxLevel && (
                                      <span className="level-range">Lv {minLevel}</span>
                                    )}
                                    {chance && <span className="chance">({chance}%)</span>}
                                    {timeOfDay && <span className="text-capitalize">{timeOfDay}</span>}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : catchData.data && Array.isArray(catchData.data) && catchData.data.length === 0 ? (
            <p className="test-status muted">No wild encounter data available for this Pokemon.</p>
          ) : null}
        </section>

        <section className="test-section">
          <div className="section-heading">
            <h2>PokeAPI Root Directory</h2>
            <span className="section-meta">{endpoints.length}</span>
          </div>
          {pokeRoot.loading && endpoints.length === 0 && (
            <p className="test-status">Fetching root endpoint directory…</p>
          )}
          {rootError && (
            <div className="test-status error">
              <span>Unable to load the PokeAPI root: {rootError}</span>
              <button type="button" className="api-retry-btn" onClick={handlePokeRetry}>
                Try again
              </button>
            </div>
          )}
          <div className="summary-grid">
            <div>
              <span className="label">Root Endpoint</span>
              <span className="value">
                <a href={POKEAPI_BASE} target="_blank" rel="noreferrer">
                  {POKEAPI_BASE}
                </a>
              </span>
            </div>
            <div>
              <span className="label">Resources</span>
              <span className="value">{endpoints.length}</span>
            </div>
            {pokeRoot.lastUpdated && (
              <div>
                <span className="label">Last Fetched</span>
                <span className="value">
                  {new Date(pokeRoot.lastUpdated).toLocaleString()}
                </span>
              </div>
            )}
          </div>
          {endpoints.length > 0 && (
            <ul className="endpoint-list">
              {endpoints.map((endpoint) => {
                const absoluteUrl =
                  endpoint.url && typeof endpoint.url === "string"
                    ? endpoint.url
                    : `${POKEAPI_BASE}${endpoint.name}/`;
                return (
                  <li key={endpoint.name} className="endpoint-row">
                    <div className="endpoint-main">
                      <a href={absoluteUrl} target="_blank" rel="noreferrer">
                        {humanizeResourceName(endpoint.name)}
                      </a>
                      <code className="endpoint-url">{absoluteUrl}</code>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="test-section">
          <div className="section-heading">
            <h2>Resource Catalog Explorer</h2>
            <span className="section-meta">
              {catalogReady ? "Ready" : pokeCatalog.loading ? "Loading" : "Offline"}
            </span>
          </div>
          {pokeCatalog.loading && <p className="test-status">Loading catalog data…</p>}
          {catalogError && <p className="test-status error">{catalogError}</p>}
          {catalogReady && (
            <div className="catalog-grid">
              <article className="catalog-card">
                <h3>Items</h3>
                <ul className="catalog-list">
                  {pokeCatalog.items.slice(0, 12).map((item) => (
                    <li key={item.name}>
                      <a href={item.url} target="_blank" rel="noreferrer">
                        {humanizeResourceName(item.name)}
                      </a>
                    </li>
                  ))}
                </ul>
              </article>
              <article className="catalog-card">
                <h3>Abilities</h3>
                <ul className="catalog-list">
                  {pokeCatalog.abilities.slice(0, 12).map((ability) => (
                    <li key={ability.name}>
                      <a href={ability.url} target="_blank" rel="noreferrer">
                        {humanizeResourceName(ability.name)}
                      </a>
                    </li>
                  ))}
                </ul>
              </article>
              <article className="catalog-card">
                <h3>Moves</h3>
                <ul className="catalog-list">
                  {pokeCatalog.moves.slice(0, 12).map((move) => (
                    <li key={move.name}>
                      <a href={move.url} target="_blank" rel="noreferrer">
                        {humanizeResourceName(move.name)}
                      </a>
                    </li>
                  ))}
                </ul>
              </article>
              <article className="catalog-card">
                <h3>Types</h3>
                <ul className="pill-list">
                  {pokeCatalog.types.map((type) => (
                    <li key={type.name} className="pill">
                      {humanizeResourceName(type.name)}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          )}
        </section>

        <section className="test-section">
          <div className="section-heading">
            <h2>Showdown CDN Extras</h2>
            <span className="section-meta">{SHOWDOWN_RESOURCE_NOTES.length}</span>
          </div>
          <ul className="endpoint-list">
            {SHOWDOWN_RESOURCE_NOTES.map((resource) => {
              const resourceUrl = `${SHOWDOWN_BASE}/${resource.path}/`;
              return (
                <li key={resource.key} className="endpoint-row">
                  <div className="endpoint-main">
                    <span>{resource.label}</span>
                    <code className="endpoint-url">{resourceUrl}</code>
                  </div>
                  <p className="endpoint-description">{resource.description}</p>
                </li>
              );
            })}
          </ul>
        </section>
      </>
    );
  }, [
    activeSprite,
    catchData.data,
    catchData.error,
    catchData.loading,
    englishFlavorText,
    handlePokeRetry,
    pokeCatalog.abilities,
    pokeCatalog.error,
    pokeCatalog.items,
    pokeCatalog.loading,
    pokeCatalog.moves,
    pokeCatalog.types,
    pokeDetails.data,
    pokeDetails.error,
    pokeDetails.loading,
    pokeDetails.species,
    pokeRoot.endpoints,
    pokeRoot.error,
    pokeRoot.lastUpdated,
    pokeRoot.loading,
    selectedPokemon,
    selectedShowdownSlug,
    selectedShowdownVariant,
    selectedSpriteKey,
    showdownFormOptions,
    showdownSpriteUrl,
    spriteOptions,
  ]);

  return (
    <div className="test-page">
      <header className="test-header">
        <div className="header-top">
          <span className="test-badge">Experimental</span>
          <a className="back-link" href={baseUrl || "/"}>
            Back to Pokedex
          </a>
        </div>
        <div className="api-toggle" role="group" aria-label="Select API source">
          {API_OPTIONS.map((option) => {
            const isActive = activeApi === option.key;
            return (
              <button
                key={option.key}
                type="button"
                className={`toggle-btn ${isActive ? "is-active" : ""}`}
                onClick={() => handleApiSelect(option.key)}
                aria-pressed={isActive}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <h1>
          {activeApi === "smogon" ? "Smogon API Integration" : "PokeAPI Endpoint Explorer"}
        </h1>
        {activeApi === "smogon" ? (
          <p>
            Live data pulled from{" "}
            <a href="https://pkmn.github.io/smogon/" target="_blank" rel="noreferrer">
              pkmn.github.io/smogon
            </a>{" "}
            using{" "}
            <strong className="text-capitalize">{humanizeResourceName(selectedPokemon)}</strong> as
            the reference species.
          </p>
        ) : (
          <p>
            Listing every resource returned by the{" "}
            <a href="https://pokeapi.co/" target="_blank" rel="noreferrer">
              PokeAPI
            </a>{" "}
            root endpoint for quick exploration.
          </p>
        )}
        <form className="pokemon-selector" onSubmit={handleSearchSubmit}>
          <div className="selector-row">
            <label className="control-label" htmlFor="pokemon-search">
              Search Pokemon
            </label>
            <input
              id="pokemon-search"
              type="search"
              list="pokemon-suggestions"
              value={searchTerm}
              onChange={handleSearchInputChange}
              onBlur={handleSearchInputBlur}
              placeholder="Start typing a Pokemon name"
              className="pokemon-search-input"
              autoComplete="off"
            />
            <button type="submit" className="selector-apply-btn">
              Load
            </button>
          </div>
        </form>
        <datalist id="pokemon-suggestions">
          {filteredPokemonSuggestions.map((option) => (
            <option key={option.name} value={option.name}>
              {humanizeResourceName(option.name)}
            </option>
          ))}
        </datalist>
      </header>
      {activeApi === "smogon" ? smogonContent : pokeContent}
      <footer className="test-footer">
        {activeApi === "smogon" ? (
          <p>
            Data provided by the unofficial{" "}
            <a href="https://github.com/pkmn/smogon" target="_blank" rel="noreferrer">
              @pkmn/smogon
            </a>{" "}
            API. Updated automatically every 24 hours.
          </p>
        ) : (
          <p>
            Data courtesy of the community-driven{" "}
            <a href="https://pokeapi.co/" target="_blank" rel="noreferrer">
              PokeAPI
            </a>. Find the full documentation at{" "}
            <a href="https://pokeapi.co/docs/v2" target="_blank" rel="noreferrer">
              pokeapi.co/docs/v2
            </a>.
          </p>
        )}
      </footer>
    </div>
  );
}

class TestPageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[TestPage] Component Error:', error);
    console.error('[TestPage] Error Info:', errorInfo);
    console.error('[TestPage] Component Stack:', errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="test-page" style={{ padding: '2rem', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ color: '#e00' }}>Error Loading Test Page</h1>
          <div style={{ 
            margin: '1rem 0', 
            padding: '1rem', 
            backgroundColor: '#fee', 
            border: '1px solid #c00',
            borderRadius: '4px',
            textAlign: 'left',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            whiteSpace: 'pre-wrap',
            overflow: 'auto'
          }}>
            <div style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>Error Details:</div>
            <div style={{ color: '#c00', marginBottom: '1rem' }}>{this.state.error?.toString() || 'Unknown error'}</div>
            {this.state.errorInfo && (
              <>
                <div style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>Stack Trace:</div>
                <div style={{ fontSize: '0.75rem', color: '#666' }}>
                  {this.state.errorInfo.componentStack}
                </div>
              </>
            )}
          </div>
          <div style={{ marginTop: '1.5rem' }}>
            <button 
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
                window.location.reload();
              }}
              style={{ 
                padding: '0.75rem 1.5rem', 
                fontSize: '1rem',
                backgroundColor: '#06f',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Reload Page
            </button>
          </div>
          <details style={{ marginTop: '1rem', textAlign: 'left' }}>
            <summary style={{ cursor: 'pointer', color: '#06f' }}>Additional Information</summary>
            <pre style={{ 
              marginTop: '0.5rem',
              padding: '0.5rem',
              backgroundColor: '#f0f0f0',
              borderRadius: '4px',
              fontSize: '0.75rem',
              overflow: 'auto'
            }}>
              {JSON.stringify(this.state, null, 2)}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function WrappedTestPage() {
  return (
    <TestPageErrorBoundary>
      <TestPage />
    </TestPageErrorBoundary>
  );
}


