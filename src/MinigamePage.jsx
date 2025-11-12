import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import CategoryToggle from "./CategoryToggle.jsx";
import SpriteImage from "./components/SpriteImage.jsx";

const MAX_POKEMON_ID = 1010;
const STEP_COUNT = 5;
const HISTORY_STORAGE_KEY = "minigame:daily-history:v1";
const COMPLETION_COOKIE_KEY = "minigame_daily_complete";
const CONFETTI_COLORS = ["#38bdf8", "#fbbf24", "#f472b6", "#34d399", "#a855f7", "#f97316"];

const toTitleCase = (value) =>
  String(value || "")
    .toLowerCase()
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

// Extract base name from Pokemon names with form-specific suffixes
// e.g., "lycanroc-midday" -> "lycanroc", "lycanroc-dusk" -> "lycanroc"
const getBasePokemonName = (name) => {
  if (!name) return "";
  const lowerName = String(name).toLowerCase();
  // Split by hyphen and take the first part as the base name
  // This handles form-specific names like "lycanroc-midday", "lycanroc-dusk", etc.
  const parts = lowerName.split("-");
  return parts[0] || lowerName;
};

const formatGeneration = (gen) => {
  if (!gen?.name) return "Unknown";
  const match = /generation-(\w+)/i.exec(gen.name);
  if (!match) return toTitleCase(gen.name);
  const value = match[1].toUpperCase();
  return `Generation ${value}`;
};

const selectEnglish = (list, key) => {
  if (!Array.isArray(list)) return null;
  const entry = list.find((item) => item?.language?.name === "en");
  if (!entry) return null;
  const value = key ? entry[key] : entry;
  if (typeof value === "string") {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\f|\n|\r/g, " ").replace(/\s+/g, " ").trim();
  }
  return value ?? null;
};

const formatHeight = (decimeters) => {
  if (!Number.isFinite(decimeters)) return "Unknown";
  return `${(decimeters / 10).toFixed(1)} m`;
};

const formatWeight = (hectograms) => {
  if (!Number.isFinite(hectograms)) return "Unknown";
  return `${(hectograms / 10).toFixed(1)} kg`;
};

const getUtcDateKey = () => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Improved seeded random number generator using xorshift for better distribution
const seededRandom = (seed) => {
  // Xorshift32 algorithm for better randomness
  // Ensure seed is a valid 32-bit unsigned integer
  let x = (seed >>> 0) || 1; // Use 1 as fallback to avoid 0
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  // Convert to unsigned 32-bit integer
  x = (x >>> 0);
  // Normalize to 0-1 range (exclusive of 1)
  return (x >>> 0) / 0x100000000;
};

// Improved hash function for better distribution
const hashStringToNumber = (value) => {
  // Use a better hash algorithm (djb2 variant with better mixing)
  let hash = 5381;
  const input = String(value || "");
  for (let idx = 0; idx < input.length; idx += 1) {
    hash = ((hash << 5) + hash) + input.charCodeAt(idx);
    hash = hash >>> 0; // Convert to unsigned 32-bit integer
  }
  // Additional mixing for better distribution
  hash = hash ^ (hash >>> 16);
  hash = hash * 0x85ebca6b;
  hash = hash ^ (hash >>> 13);
  hash = hash * 0xc2b2ae35;
  hash = hash ^ (hash >>> 16);
  return hash >>> 0;
};

const normalizeName = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[♀]/g, "f")
    .replace(/[♂]/g, "m")
    .replace(/[^a-z0-9]/g, "");

const MIN_HISTORY_DATE = "2025-11-01"; // History available starting from this date

const parseDateKey = (value) => {
  if (!value || typeof value !== "string") return null;
  const match = /^\d{4}-\d{2}-\d{2}$/.exec(value.trim());
  if (!match) return null;
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

// Calculate days since November 1st, 2025 for better randomization
const getDaysSinceStart = (dateKey) => {
  const startDate = parseDateKey(MIN_HISTORY_DATE);
  const targetDate = parseDateKey(dateKey);
  if (!startDate || !targetDate) return 0;
  const diffTime = targetDate.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

const computeDailyPokemonId = (dateKey) => {
  // Combine date hash with days since start for better randomization
  const dateHash = hashStringToNumber(dateKey);
  const daysSinceStart = getDaysSinceStart(dateKey);
  
  // Use multiple rounds of randomization for better distribution
  let seed = dateHash;
  seed = seed ^ (daysSinceStart * 0x9e3779b9);
  seed = seed ^ (dateHash >>> 16);
  
  // Generate multiple random values and combine them
  let random1 = seededRandom(seed);
  let random2 = seededRandom(seed + 1);
  let random3 = seededRandom(seed + 2);
  
  // Combine random values using XOR and addition for better distribution
  const combined = (random1 * 0.5 + random2 * 0.3 + random3 * 0.2);
  
  // Generate random ID between 1 and MAX_POKEMON_ID
  const randomId = Math.floor(combined * MAX_POKEMON_ID) + 1;
  
  // Ensure it's within valid range
  return Math.max(1, Math.min(MAX_POKEMON_ID, randomId));
};

const isDateOnOrAfter = (value, minimum) => {
  const target = parseDateKey(value);
  const min = parseDateKey(minimum);
  if (!target || !min) return false;
  return target.getTime() >= min.getTime();
};

const loadStoredHistory = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => entry && typeof entry.date === "string")
      .filter((entry) => isDateOnOrAfter(entry.date, MIN_HISTORY_DATE))
      .map((entry) => ({
        date: entry.date,
        pokemonId: entry.pokemonId ?? null,
        pokemonName: entry.pokemonName ?? null,
        completedAt: entry.completedAt ?? null,
        solvedAtStep: entry.solvedAtStep ?? null,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch (error) {
    console.warn("[Minigame] Failed to load history", error);
    return [];
  }
};

const saveHistoryRecords = (records) => {
  if (typeof window === "undefined") return;
  try {
    const filtered = records.filter((entry) => entry && isDateOnOrAfter(entry.date, MIN_HISTORY_DATE));
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.warn("[Minigame] Failed to persist history", error);
  }
};

const setCompletionCookie = (dateKey) => {
  if (typeof document === "undefined") return;
  try {
    const maxAge = 60 * 60 * 24 * 90; // 90 days
    document.cookie = `${COMPLETION_COOKIE_KEY}=${encodeURIComponent(dateKey)}; max-age=${maxAge}; path=/; SameSite=Lax`;
  } catch {}
};

const formatHistoryDate = (dateKey) => {
  if (!dateKey) return "Unknown";
  const baseDate = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(baseDate.getTime())) return dateKey;
  return baseDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatHistoryTimestamp = (isoValue) => {
  if (!isoValue) return "Unknown time";
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatPerformanceSummary = (solvedAtStep) => {
  if (solvedAtStep == null) {
    return "Solved after all clues";
  }
  if (solvedAtStep <= 1) {
    return "Solved with no clues";
  }
  const cluesUsed = Math.max(0, solvedAtStep - 1);
  const label = cluesUsed === 1 ? "clue" : "clues";
  return `Solved after ${cluesUsed} ${label}`;
};

// Get color for completed history entry based on clues used
// Green = solved with 1 clue (best), Red = solved with 4 clues (worst)
const getCompletionColor = (solvedAtStep) => {
  if (solvedAtStep == null) {
    // Solved after all clues (worst - red)
    return "rgba(239, 68, 68, 0.2)"; // red-500 with opacity
  }
  
  const cluesUsed = Math.max(0, solvedAtStep - 1);
  
  // Map clues used (0-4) to colors from green to red
  // 0 clues = bright green (even better than 1 clue), 1 clue = green, 2 clues = yellow, 3 clues = orange, 4 clues = red
  const colorMap = {
    0: "rgba(34, 197, 94, 0.2)",     // green-500 - solved with no clues (best)
    1: "rgba(74, 222, 128, 0.2)",    // green-400 - solved with 1 clue (green as requested)
    2: "rgba(234, 179, 8, 0.2)",     // yellow-500 - solved with 2 clues
    3: "rgba(249, 115, 22, 0.2)",   // orange-500 - solved with 3 clues
    4: "rgba(239, 68, 68, 0.2)",    // red-500 - solved with 4 clues (red as requested)
  };
  
  return colorMap[Math.min(4, cluesUsed)] || colorMap[4];
};

const generatePastDateKeys = (daysBack = null) => {
  const dates = [];
  const minDate = parseDateKey(MIN_HISTORY_DATE);
  if (!minDate) return dates;

  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startDate = todayUtc.getTime() < minDate.getTime() ? minDate : todayUtc;

  // Calculate days from minDate to today if daysBack is not provided
  const actualDaysBack = daysBack ?? Math.ceil((todayUtc.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  for (let i = 0; i < actualDaysBack; i += 1) {
    const date = new Date(startDate);
    date.setUTCDate(date.getUTCDate() - i);

    if (date.getTime() < minDate.getTime()) {
      break;
    }

    if (date.getTime() > todayUtc.getTime()) {
      continue;
    }

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
  }
  return dates;
};

const buildFullHistory = (completedHistory, daysBack = null) => {
  const completedMap = new Map();
  completedHistory.forEach((entry) => {
    if (entry && isDateOnOrAfter(entry.date, MIN_HISTORY_DATE)) {
      completedMap.set(entry.date, { ...entry, isCompleted: true });
    }
  });

  const allDateKeys = generatePastDateKeys(daysBack);
  const fullHistory = allDateKeys.map((dateKey) => {
    const completed = completedMap.get(dateKey);
    if (completed) {
      return completed;
    }
    const pokemonId = computeDailyPokemonId(dateKey);
    return {
      date: dateKey,
      pokemonId,
      pokemonName: null,
      completedAt: null,
      solvedAtStep: null,
      isCompleted: false,
    };
  });

  return fullHistory.sort((a, b) => b.date.localeCompare(a.date));
};

export default function MinigamePage() {
  const todayKey = getUtcDateKey();
  const [dailyKey, setDailyKey] = useState(todayKey);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const basePath = (import.meta.env.BASE_URL || "/").replace(/\/+$|^$/, "/");
      if (url.pathname !== basePath) {
        url.pathname = basePath;
      }
      if (url.hash !== "#/whosthat") {
        url.hash = "#/whosthat";
      }
      ["p", "i", "m", "a"].forEach((param) => url.searchParams.delete(param));
      window.history.replaceState({}, "", url);
    } catch {}
  }, []);

  const initialDataRef = useRef(null);
  if (!initialDataRef.current) {
    const history = loadStoredHistory();
    const todaysRecord = history.find((entry) => entry.date === todayKey) || null;
    initialDataRef.current = { history, todaysRecord };
  }

  const [history, setHistory] = useState(initialDataRef.current.history);
  const [fullHistory, setFullHistory] = useState(() => buildFullHistory(initialDataRef.current.history));
  const [pokemonNamesCache, setPokemonNamesCache] = useState(() => new Map());
  const [pokemon, setPokemon] = useState(null);
  const [step, setStep] = useState(() => {
    const record = initialDataRef.current.history.find((entry) => entry.date === todayKey);
    return record ? STEP_COUNT : 1;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [completion, setCompletion] = useState(() => {
    const record = initialDataRef.current.history.find((entry) => entry.date === todayKey);
    return {
      isCompleted: Boolean(record),
      completedAt: record?.completedAt ?? null,
    };
  });
  const [showHistory, setShowHistory] = useState(false);
  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [feedbackType, setFeedbackType] = useState("info");
  const [confettiPieces, setConfettiPieces] = useState([]);
  const confettiTimeoutRef = useRef(null);
  const pokemonCacheRef = useRef(new Map());
  const [solvedAtStep, setSolvedAtStep] = useState(() => {
    const record = initialDataRef.current.history.find((entry) => entry.date === todayKey);
    return record?.solvedAtStep ?? null;
  });

  const dailyPokemonId = useMemo(() => computeDailyPokemonId(dailyKey), [dailyKey]);

  const currentRecord = useMemo(
    () => history.find((entry) => entry.date === dailyKey) || null,
    [history, dailyKey]
  );

  const normalizedTargetName = useMemo(() => {
    if (!pokemon?.name) return "";
    const baseName = getBasePokemonName(pokemon.name);
    return normalizeName(baseName);
  }, [pokemon?.name]);

  useEffect(() => {
    if (currentRecord && !completion.isCompleted) {
      setCompletion({ isCompleted: true, completedAt: currentRecord.completedAt });
      setSolvedAtStep(currentRecord.solvedAtStep ?? STEP_COUNT);
    }
  }, [currentRecord, completion.isCompleted]);

  // Update full history when completed history changes
  useEffect(() => {
    setFullHistory(buildFullHistory(history));
  }, [history]);

  // Track which Pokemon IDs we've requested to avoid duplicate requests
  const requestedIdsRef = useRef(new Set());
  const pokemonNamesCacheRef = useRef(new Map());
  
  // Sync cache ref with state
  useEffect(() => {
    pokemonNamesCacheRef.current = pokemonNamesCache;
  }, [pokemonNamesCache]);

  // Note: We no longer load Pokemon names for uncompleted games since they should be hidden
  // This effect is kept for potential future use but currently does nothing

  useEffect(() => () => {
    if (confettiTimeoutRef.current) {
      clearTimeout(confettiTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    setGuess("");
    if (!completion.isCompleted) {
      setFeedback(null);
      setFeedbackType("info");
    }
    setConfettiPieces([]);
  }, [pokemon?.id, completion.isCompleted]);

  useEffect(() => {
    if (completion.isCompleted && currentRecord && !feedback) {
      const summary = formatPerformanceSummary(currentRecord.solvedAtStep);
      setFeedback(`Daily complete: ${summary}`);
      setFeedbackType("success");
    }
  }, [completion.isCompleted, currentRecord, feedback]);

  const generateConfetti = useCallback(() => {
    const pieces = Array.from({ length: 28 }, () => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.25,
      duration: 1.6 + Math.random() * 0.8,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      xOffset: Math.random() * 40 - 20,
    }));
    setConfettiPieces(pieces);
    if (confettiTimeoutRef.current) {
      clearTimeout(confettiTimeoutRef.current);
    }
    confettiTimeoutRef.current = setTimeout(() => setConfettiPieces([]), 1800);
  }, []);

  const loadDailyPokemon = useCallback(async (targetDateKey = dailyKey) => {
    setLoading(true);
    setError(null);

    const targetPokemonId = computeDailyPokemonId(targetDateKey);
    const targetRecord = history.find((entry) => entry.date === targetDateKey);
    const isCompleted = Boolean(targetRecord);

    const cached = pokemonCacheRef.current.get(targetPokemonId);
    if (cached) {
      setPokemon(cached);
      setLoading(false);
      setStep(isCompleted ? STEP_COUNT : 1);
      setCompletion({
        isCompleted,
        completedAt: targetRecord?.completedAt ?? null,
      });
      setSolvedAtStep(targetRecord?.solvedAtStep ?? null);
      return;
    }

    try {
      const [pokemonResponse, speciesResponse] = await Promise.all([
        fetch(`https://pokeapi.co/api/v2/pokemon/${targetPokemonId}`),
        fetch(`https://pokeapi.co/api/v2/pokemon-species/${targetPokemonId}`),
      ]);

      if (!pokemonResponse.ok || !speciesResponse.ok) {
        throw new Error(
          `Failed to load Pokémon (status ${pokemonResponse.status}/${speciesResponse.status})`
        );
      }

      const [pokemonData, speciesData] = await Promise.all([
        pokemonResponse.json(),
        speciesResponse.json(),
      ]);

      const types = Array.isArray(pokemonData?.types)
        ? pokemonData.types
            .slice()
            .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))
            .map((entry) => entry?.type?.name)
            .filter(Boolean)
        : [];

      const genera = selectEnglish(speciesData?.genera, "genus");

      const payload = {
        id: pokemonData?.id ?? targetPokemonId,
        name: pokemonData?.name ?? speciesData?.name ?? `Pokemon ${targetPokemonId}`,
        types,
        generation: speciesData?.generation ?? null,
        classification: genera,
        height: Number.isFinite(pokemonData?.height) ? pokemonData.height : null,
        weight: Number.isFinite(pokemonData?.weight) ? pokemonData.weight : null,
      };

      pokemonCacheRef.current.set(payload.id, payload);
      setPokemon(payload);
      setLoading(false);
      setStep(isCompleted ? STEP_COUNT : 1);
      setCompletion({
        isCompleted,
        completedAt: targetRecord?.completedAt ?? null,
      });
      setSolvedAtStep(targetRecord?.solvedAtStep ?? null);
      if (!isCompleted) {
        setSolvedAtStep(null);
      }
    } catch (fetchError) {
      setPokemon(null);
      setLoading(false);
      setError(fetchError?.message || "Unable to load Pokémon. Please try again later.");
    }
  }, [dailyKey, history]);

  useEffect(() => {
    loadDailyPokemon(dailyKey);
  }, [dailyKey, loadDailyPokemon]);

  const loadGameForDate = useCallback((dateKey) => {
    if (!dateKey || typeof dateKey !== "string") return;
    setDailyKey(dateKey);
    setShowHistory(false);
    setGuess("");
    setFeedback(null);
    setFeedbackType("info");
  }, []);

  // Get previous date (one day earlier)
  const getPreviousDate = useCallback((currentDateKey) => {
    const currentDate = parseDateKey(currentDateKey);
    if (!currentDate) return null;
    const prevDate = new Date(currentDate);
    prevDate.setUTCDate(prevDate.getUTCDate() - 1);
    const year = prevDate.getUTCFullYear();
    const month = String(prevDate.getUTCMonth() + 1).padStart(2, "0");
    const day = String(prevDate.getUTCDate()).padStart(2, "0");
    const prevDateKey = `${year}-${month}-${day}`;
    // Check if previous date is on or after MIN_HISTORY_DATE
    if (isDateOnOrAfter(prevDateKey, MIN_HISTORY_DATE)) {
      return prevDateKey;
    }
    return null;
  }, []);

  // Get next date (one day later)
  const getNextDate = useCallback((currentDateKey) => {
    const currentDate = parseDateKey(currentDateKey);
    if (!currentDate) return null;
    const nextDate = new Date(currentDate);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    const year = nextDate.getUTCFullYear();
    const month = String(nextDate.getUTCMonth() + 1).padStart(2, "0");
    const day = String(nextDate.getUTCDate()).padStart(2, "0");
    const nextDateKey = `${year}-${month}-${day}`;
    // Check if next date is on or before today
    if (nextDateKey <= todayKey) {
      return nextDateKey;
    }
    return null;
  }, [todayKey]);

  const handlePreviousDate = useCallback(() => {
    const prevDate = getPreviousDate(dailyKey);
    if (prevDate) {
      loadGameForDate(prevDate);
    }
  }, [dailyKey, getPreviousDate, loadGameForDate]);

  const handleNextDate = useCallback(() => {
    const nextDate = getNextDate(dailyKey);
    if (nextDate) {
      loadGameForDate(nextDate);
    }
  }, [dailyKey, getNextDate, loadGameForDate]);

  const canGoPrevious = getPreviousDate(dailyKey) !== null;
  const canGoNext = getNextDate(dailyKey) !== null;

  const friendlyName = useMemo(() => {
    if (!pokemon?.name) return "";
    const baseName = getBasePokemonName(pokemon.name);
    return toTitleCase(baseName);
  }, [pokemon?.name]);

  const typeLabel = useMemo(() => {
    if (!pokemon?.types || pokemon.types.length === 0) return "Unknown";
    return pokemon.types.map((t) => toTitleCase(t)).join(" / ");
  }, [pokemon?.types]);

  const generationLabel = useMemo(() => formatGeneration(pokemon?.generation), [pokemon?.generation]);

  const hintList = useMemo(() => {
    if (!pokemon) return [];
    const hints = [];
    if (step >= 2) hints.push({ id: "types", label: "Type", value: typeLabel });
    if (step >= 3) {
      const classification = pokemon.classification || "Unknown";
      hints.push({ id: "classification", label: "Classification", value: classification });
      hints.push({ id: "generation", label: "Generation", value: generationLabel });
    }
    return hints;
  }, [pokemon, step, typeLabel, generationLabel]);

  const markCompletion = useCallback(
    (resolvedStep) => {
      if (!pokemon) return;
      if (completion.isCompleted && currentRecord) return;

      const baseName = getBasePokemonName(pokemon.name);
      const record = {
        date: dailyKey,
        pokemonId: pokemon.id,
        pokemonName: toTitleCase(baseName),
        completedAt: new Date().toISOString(),
        solvedAtStep: resolvedStep ?? STEP_COUNT,
      };

      setHistory((prevHistory) => {
        const existingIndex = prevHistory.findIndex((entry) => entry.date === record.date);
        let updated;
        if (existingIndex >= 0) {
          updated = [...prevHistory];
          updated[existingIndex] = record;
        } else {
          updated = [record, ...prevHistory];
        }
        updated.sort((a, b) => b.date.localeCompare(a.date));
        saveHistoryRecords(updated);
        return updated;
      });

      setCompletion({ isCompleted: true, completedAt: record.completedAt });
      setSolvedAtStep(record.solvedAtStep);
      setShowHistory(true);
      setCompletionCookie(record.date);
    },
    [pokemon, completion.isCompleted, currentRecord, dailyKey]
  );

  const handleHistoryToggle = useCallback(() => {
    setShowHistory((prev) => !prev);
  }, []);

  const handleGuessSubmit = useCallback(
     (event) => {
       event.preventDefault();
       if (!pokemon || completion.isCompleted || loading) return;
 
       const rawGuess = guess.trim();
       const normalizedGuess = normalizeName(rawGuess);
 
       const currentStep = step;
       setGuess("");
 
       if (!normalizedGuess) {
        if (currentStep < STEP_COUNT) {
          const nextStep = Math.min(STEP_COUNT, currentStep + 1);
          setStep(nextStep);
          if (nextStep >= STEP_COUNT) {
            markCompletion();
          }
        }
        setFeedback(null);
        setFeedbackType("info");
        return;
       }
 
       if (normalizedGuess === normalizedTargetName) {
         const resolvedStep = currentStep;
         setStep(STEP_COUNT);
         const cluesUsed = Math.max(0, resolvedStep - 1);
         const cluesLabel = cluesUsed === 1 ? "clue" : "clues";
         const successMessage =
           resolvedStep <= 1
             ? "Incredible! You solved it without any clues!"
             : `Correct! You solved it after ${cluesUsed} ${cluesLabel}.`;
         setFeedback(successMessage);
         setFeedbackType("success");
         generateConfetti();
         markCompletion(resolvedStep);
       } else {
         if (currentStep < STEP_COUNT) {
           const nextStep = Math.min(STEP_COUNT, currentStep + 1);
           setStep(nextStep);
           if (nextStep >= STEP_COUNT) {
            setFeedback("So close! All clues are revealed—final reveal unlocked.");
            setFeedbackType("warning");
            markCompletion();
           } else {
             setFeedback("Not quite! Another clue has been revealed.");
             setFeedbackType("error");
           }
         } else {
           setFeedback("All clues are revealed—final reveal unlocked.");
           setFeedbackType("warning");
         }
       }
     },
   [pokemon, completion.isCompleted, loading, guess, step, normalizedTargetName, generateConfetti, markCompletion]
   );

  const totalHistory = fullHistory.length;
  const completedCount = fullHistory.filter((entry) => entry.isCompleted).length;
  const hasHistory = totalHistory > 0;

  // Get Pokemon name for history entry (from cache or entry)
  const getHistoryPokemonName = useCallback((entry) => {
    // For completed entries, show the pokemon name
    if (entry.isCompleted) {
      return entry.pokemonName || pokemonNamesCache.get(entry.pokemonId) || `#${entry.pokemonId}`;
    }
    // For uncompleted entries, hide the pokemon name
    return "???";
  }, [pokemonNamesCache]);
  const guessDisabled = loading || !!error || completion.isCompleted || !pokemon;
  const revealDetailsStep = STEP_COUNT - 1;
  const showRevealDetails = step >= revealDetailsStep;
  const showFinalReveal = step >= STEP_COUNT;
  const headerTitle = showFinalReveal && friendlyName ? friendlyName : "Who's That Pokémon?";
  const isPixelatedSprite = step <= 1;
  const isHiddenSprite = step <= 3;
  const spriteClassName = [
    "minigame-sprite",
    isPixelatedSprite ? "is-pixelated" : "",
    isHiddenSprite ? "is-hidden" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const spriteWrapperClassName = [
    "minigame-sprite-wrapper",
    isPixelatedSprite ? "is-pixelated" : "",
    isHiddenSprite ? "is-hidden" : "",
  ]
    .filter(Boolean)
    .join(" ");
 
  return (
    <div className="minigame-page">
      <div className="container">
        <CategoryToggle />
        <div className="minigame-card" role="main">
          <header className="minigame-header">
            <h1>{headerTitle}</h1>
          </header>

          <div className="minigame-status-row">
            <span className="minigame-status-date">
              {dailyKey === todayKey ? "Daily Challenge" : "Challenge"} • {formatHistoryDate(dailyKey)}
              {dailyKey !== todayKey && (
                <button
                  type="button"
                  className="minigame-status-button"
                  onClick={() => loadGameForDate(todayKey)}
                  style={{ marginLeft: "8px", fontSize: "0.875rem" }}
                >
                  Back to Today
                </button>
              )}
            </span>
            <div className="minigame-status-controls">
              <span className={`minigame-status-indicator${completion.isCompleted ? " is-complete" : ""}`}>
                <span className="minigame-status-dot" aria-hidden="true"></span>
                {completion.isCompleted
                  ? `Completed ${formatHistoryTimestamp(completion.completedAt)}`
                  : "Not completed yet"}
              </span>
              <button type="button" className="minigame-status-button" onClick={handleHistoryToggle}>
                {showHistory ? "Hide History" : "View History"}
              </button>
            </div>
          </div>

          <div className={`minigame-stage step-${step}`}>
            {confettiPieces.length > 0 && (
              <div className="minigame-confetti" aria-hidden="true">
                {confettiPieces.map((piece, idx) => (
                  <span
                    key={idx}
                    className="minigame-confetti-piece"
                    style={{
                      left: `${piece.left}%`,
                      animationDelay: `${piece.delay}s`,
                      animationDuration: `${piece.duration}s`,
                      backgroundColor: piece.color,
                      transform: `translate3d(0, 0, 0)`,
                      "--confetti-x": `${piece.xOffset}vw`,
                    }}
                  ></span>
                ))}
              </div>
            )}

            {loading ? (
              <div className="minigame-loader" aria-live="polite">
                Loading a mystery Pokémon...
              </div>
            ) : error ? (
              <div className="minigame-error" role="alert">
                <p>{error}</p>
                <button type="button" onClick={loadDailyPokemon} className="minigame-button">
                  Try Again
                </button>
              </div>
            ) : pokemon ? (
              <div className="minigame-stage-content" aria-live="polite">
                {hintList.length > 0 && (
                  <div className="minigame-stage-hints is-floating">
                    <span className="minigame-stage-hints-title">Clues</span>
                    <div className="minigame-stage-hints-list">
                      {hintList.map((hint) => (
                        <div key={hint.id} className="minigame-stage-pill">
                          <span className="minigame-stage-pill-label">{hint.label}</span>
                          <span className="minigame-stage-pill-value">{hint.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="minigame-stage-center">
                  <div className={spriteWrapperClassName}>
                    <SpriteImage
                      id={pokemon.id}
                      alt={showFinalReveal ? friendlyName : "Silhouette of a mystery Pokémon"}
                      className={spriteClassName}
                      variant="home"
                      width={256}
                      height={256}
                      loading="lazy"
                      draggable="false"
                      onContextMenu={(e) => e.preventDefault()}
                      onDragStart={(e) => e.preventDefault()}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="minigame-placeholder">No Pokémon available.</div>
            )}
          </div>

          <div className="minigame-progress" aria-hidden="true">
            {Array.from({ length: STEP_COUNT }, (_, index) => {
              const current = index + 1;
              const status = current === step ? "current" : current < step ? "complete" : "upcoming";
              return <span key={current} className={`minigame-progress-dot ${status}`} />;
            })}
          </div>

          <form className="minigame-guess-form" onSubmit={handleGuessSubmit}>
            <div className="minigame-nav-container">
              <button
                type="button"
                className="minigame-nav-button"
                onClick={handlePreviousDate}
                disabled={!canGoPrevious}
                aria-label="Previous date"
                title="Previous date"
              >
                ←
              </button>
              <button
                type="button"
                className="minigame-nav-button"
                onClick={handleNextDate}
                disabled={!canGoNext}
                aria-label="Next date"
                title="Next date"
              >
                →
              </button>
            </div>
            <input
              className="minigame-guess-input"
              type="text"
              placeholder={completion.isCompleted ? "Solved for today" : "Enter Pokémon name"}
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              disabled={guessDisabled}
              aria-label="Guess the Pokémon"
            />
            <button type="submit" className="minigame-guess-button" disabled={guessDisabled}>
              {completion.isCompleted ? "Solved" : "Submit Guess"}
            </button>
          </form>

          {feedback && <div className={`minigame-feedback ${feedbackType}`}>{feedback}</div>}

          {!loading && !error && pokemon ? (
             <>
              {completion.isCompleted && (
                <div className="minigame-success-summary">
                  <span>{formatPerformanceSummary(solvedAtStep)}</span>
                </div>
              )}

              {showRevealDetails && (
                <section className="minigame-reveal" aria-live="polite">
                  <div className="minigame-reveal-grid">
                    <div>
                      <span className="minigame-reveal-label">Height</span>
                      <span className="minigame-reveal-value">{formatHeight(pokemon.height)}</span>
                    </div>
                    <div>
                      <span className="minigame-reveal-label">Weight</span>
                      <span className="minigame-reveal-value">{formatWeight(pokemon.weight)}</span>
                    </div>
                    <div>
                      <span className="minigame-reveal-label">Type</span>
                      <span className="minigame-reveal-value">{typeLabel}</span>
                    </div>
                    <div>
                      <span className="minigame-reveal-label">Generation</span>
                      <span className="minigame-reveal-value">{generationLabel}</span>
                    </div>
                  </div>
                </section>
              )}

              {showHistory && (
                <section className="minigame-history" aria-live="polite">
                  <div className="minigame-history-header">
                    <h3>Game History</h3>
                    <span className="minigame-history-count">{completedCount} of {totalHistory} completed</span>
                  </div>
                  {hasHistory ? (
                    <ul className="minigame-history-list">
                      {fullHistory.map((entry) => {
                        const isCompleted = entry.isCompleted;
                        const pokemonName = getHistoryPokemonName(entry);
                        const completionColor = isCompleted ? getCompletionColor(entry.solvedAtStep) : null;
                        return (
                          <li 
                            key={entry.date} 
                            className={`minigame-history-entry${!isCompleted ? " is-uncompleted" : ""}`}
                            style={completionColor ? { backgroundColor: completionColor } : undefined}
                          >
                            <div className="minigame-history-entry-primary">
                              <span className="minigame-history-name">{pokemonName}</span>
                              <span className="minigame-history-date">{formatHistoryDate(entry.date)}</span>
                            </div>
                            {isCompleted && (
                              <div className="minigame-history-entry-sprite">
                                <SpriteImage
                                  id={entry.pokemonId}
                                  alt={pokemonName}
                                  variant="home"
                                  width={64}
                                  height={64}
                                  loading="lazy"
                                  draggable="false"
                                  onContextMenu={(e) => e.preventDefault()}
                                  onDragStart={(e) => e.preventDefault()}
                                />
                              </div>
                            )}
                            <div className="minigame-history-entry-meta">
                              {isCompleted && (
                                <span className="minigame-history-id">ID #{entry.pokemonId}</span>
                              )}
                              {isCompleted ? (
                                <span className="minigame-history-time">{formatPerformanceSummary(entry.solvedAtStep)}</span>
                              ) : (
                                <>
                                  <span className="minigame-history-time">Not completed</span>
                                  <button
                                    type="button"
                                    className="minigame-history-play-button"
                                    onClick={() => loadGameForDate(entry.date)}
                                    aria-label={`Play game from ${formatHistoryDate(entry.date)}`}
                                  >
                                    Play
                                  </button>
                                </>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="minigame-history-empty">No game history available.</div>
                  )}
                </section>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}


