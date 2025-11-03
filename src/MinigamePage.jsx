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

// Seeded random number generator for deterministic but random-looking Pokemon selection
const seededRandom = (seed) => {
  // Simple linear congruential generator
  const a = 1664525;
  const c = 1013904223;
  const m = Math.pow(2, 32);
  return ((a * seed + c) % m) / m;
};

const hashStringToNumber = (value) => {
  let hash = 0;
  const input = String(value || "");
  for (let idx = 0; idx < input.length; idx += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(idx);
    hash |= 0;
  }
  return Math.abs(hash);
};

const computeDailyPokemonId = (dateKey) => {
  // Use date as seed for random generation
  const seed = hashStringToNumber(dateKey);
  const random = seededRandom(seed);
  // Generate random ID between 1 and MAX_POKEMON_ID
  const randomId = Math.floor(random * MAX_POKEMON_ID) + 1;
  return randomId;
};

const normalizeName = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[♀]/g, "f")
    .replace(/[♂]/g, "m")
    .replace(/[^a-z0-9]/g, "");

const MIN_HISTORY_DATE = "2025-11-27"; // History available starting from this date

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

const generatePastDateKeys = (daysBack = 90) => {
  const dates = [];
  const minDate = parseDateKey(MIN_HISTORY_DATE);
  if (!minDate) return dates;

  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startDate = todayUtc.getTime() < minDate.getTime() ? minDate : todayUtc;

  for (let i = 0; i < daysBack; i += 1) {
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

const buildFullHistory = (completedHistory, daysBack = 90) => {
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
  const dailyKeyRef = useRef(getUtcDateKey());
  const dailyKey = dailyKeyRef.current;

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
    const todaysRecord = history.find((entry) => entry.date === dailyKey) || null;
    initialDataRef.current = { history, todaysRecord };
  }

  const [history, setHistory] = useState(initialDataRef.current.history);
  const [fullHistory, setFullHistory] = useState(() => buildFullHistory(initialDataRef.current.history));
  const [pokemonNamesCache, setPokemonNamesCache] = useState(() => new Map());
  const [pokemon, setPokemon] = useState(null);
  const [step, setStep] = useState(() => (initialDataRef.current.todaysRecord ? STEP_COUNT : 1));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [completion, setCompletion] = useState(() => ({
    isCompleted: Boolean(initialDataRef.current.todaysRecord),
    completedAt: initialDataRef.current.todaysRecord?.completedAt ?? null,
  }));
  const [showHistory, setShowHistory] = useState(false);
  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [feedbackType, setFeedbackType] = useState("info");
  const [confettiPieces, setConfettiPieces] = useState([]);
  const confettiTimeoutRef = useRef(null);
  const pokemonCacheRef = useRef(new Map());
  const [solvedAtStep, setSolvedAtStep] = useState(initialDataRef.current.todaysRecord?.solvedAtStep ?? null);

  const dailyPokemonId = useMemo(() => computeDailyPokemonId(dailyKey), [dailyKey]);

  const todaysRecord = useMemo(
    () => history.find((entry) => entry.date === dailyKey) || null,
    [history, dailyKey]
  );

  const normalizedTargetName = useMemo(() => normalizeName(pokemon?.name), [pokemon?.name]);

  useEffect(() => {
    if (todaysRecord && !completion.isCompleted) {
      setCompletion({ isCompleted: true, completedAt: todaysRecord.completedAt });
      setSolvedAtStep(todaysRecord.solvedAtStep ?? STEP_COUNT);
    }
  }, [todaysRecord, completion.isCompleted]);

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

  // Load Pokemon names for uncompleted games when history is shown
  useEffect(() => {
    if (!showHistory || fullHistory.length === 0) return;

    const uncompletedEntries = fullHistory.filter((entry) => !entry.isCompleted && !entry.pokemonName);
    if (uncompletedEntries.length === 0) return;

    // Batch load Pokemon names (limit to first 30 to avoid too many requests)
    const toLoad = uncompletedEntries
      .slice(0, 30)
      .filter((entry) => {
        const cache = pokemonNamesCacheRef.current;
        return !cache.has(entry.pokemonId) && !requestedIdsRef.current.has(entry.pokemonId);
      });

    if (toLoad.length === 0) return;

    // Mark IDs as requested
    toLoad.forEach((entry) => requestedIdsRef.current.add(entry.pokemonId));

    let cancelled = false;
    const loadPokemonNames = async () => {
      const updates = new Map();
      for (const entry of toLoad) {
        if (cancelled) break;
        try {
          const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${entry.pokemonId}`);
          if (response.ok) {
            const data = await response.json();
            const name = data?.name ? toTitleCase(data.name) : null;
            if (name) {
              updates.set(entry.pokemonId, name);
            }
          }
        } catch {
          // Ignore errors, will just show ID
        }
      }
      if (!cancelled && updates.size > 0) {
        setPokemonNamesCache((prev) => {
          const merged = new Map(prev);
          updates.forEach((name, id) => merged.set(id, name));
          return merged;
        });
      }
    };

    loadPokemonNames();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHistory, fullHistory.length]);

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
    if (completion.isCompleted && todaysRecord && !feedback) {
      const summary = formatPerformanceSummary(todaysRecord.solvedAtStep);
      setFeedback(`Daily complete: ${summary}`);
      setFeedbackType("success");
    }
  }, [completion.isCompleted, todaysRecord, feedback]);

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

  const loadDailyPokemon = useCallback(async () => {
    setLoading(true);
    setError(null);

    const cached = pokemonCacheRef.current.get(dailyPokemonId);
    if (cached) {
      setPokemon(cached);
      setLoading(false);
      setStep(completion.isCompleted ? STEP_COUNT : 1);
      return;
    }

    try {
      const [pokemonResponse, speciesResponse] = await Promise.all([
        fetch(`https://pokeapi.co/api/v2/pokemon/${dailyPokemonId}`),
        fetch(`https://pokeapi.co/api/v2/pokemon-species/${dailyPokemonId}`),
      ]);

      if (!pokemonResponse.ok || !speciesResponse.ok) {
        throw new Error(
          `Failed to load today\'s Pokémon (status ${pokemonResponse.status}/${speciesResponse.status})`
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
        id: pokemonData?.id ?? dailyPokemonId,
        name: pokemonData?.name ?? speciesData?.name ?? `Pokemon ${dailyPokemonId}`,
        types,
        generation: speciesData?.generation ?? null,
        classification: genera,
        height: Number.isFinite(pokemonData?.height) ? pokemonData.height : null,
        weight: Number.isFinite(pokemonData?.weight) ? pokemonData.weight : null,
      };

      pokemonCacheRef.current.set(payload.id, payload);
      setPokemon(payload);
      setLoading(false);
      setStep(completion.isCompleted ? STEP_COUNT : 1);
      if (!completion.isCompleted) {
        setSolvedAtStep(null);
      }
    } catch (fetchError) {
      setPokemon(null);
      setLoading(false);
      setError(fetchError?.message || "Unable to load today\'s Pokémon. Please try again later.");
    }
  }, [dailyPokemonId, completion.isCompleted]);

  useEffect(() => {
    loadDailyPokemon();
  }, [loadDailyPokemon]);

  const friendlyName = useMemo(() => toTitleCase(pokemon?.name), [pokemon?.name]);

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
      if (completion.isCompleted && todaysRecord) return;

      const record = {
        date: dailyKey,
        pokemonId: pokemon.id,
        pokemonName: toTitleCase(pokemon.name),
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
    [pokemon, completion.isCompleted, todaysRecord, dailyKey]
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
    if (entry.pokemonName) return entry.pokemonName;
    if (entry.isCompleted) return `#${entry.pokemonId}`;
    return pokemonNamesCache.get(entry.pokemonId) || `#${entry.pokemonId}`;
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
            <span className="minigame-status-date">Daily Challenge • {formatHistoryDate(dailyKey)}</span>
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
                        return (
                          <li 
                            key={entry.date} 
                            className={`minigame-history-entry${!isCompleted ? " is-uncompleted" : ""}`}
                          >
                            <div className="minigame-history-entry-primary">
                              <span className="minigame-history-name">{pokemonName}</span>
                              <span className="minigame-history-date">{formatHistoryDate(entry.date)}</span>
                            </div>
                            <div className="minigame-history-entry-meta">
                              <span className="minigame-history-id">ID #{entry.pokemonId}</span>
                              {isCompleted ? (
                                <span className="minigame-history-time">{formatPerformanceSummary(entry.solvedAtStep)}</span>
                              ) : (
                                <span className="minigame-history-time">Not completed</span>
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


