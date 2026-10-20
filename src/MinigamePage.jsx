import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import CategoryToggle from "./CategoryToggle.jsx";
import SpriteImage from "./components/SpriteImage.jsx";
import { NATIONAL_ID_TO_SLUG } from "./data/pokemonSpeciesMap.js";
import { formatPokemonName, toTitleCase } from "./utils/pokemonNames.js";

// Daily answers are drawn from National Dex species #1-#MAX_POKEMON_ID. This is deliberately a
// fixed number rather than the size of the Pokémon index: changing it reshuffles the answer for
// every day, so only bump it when new species should join the rotation.
const MAX_POKEMON_ID = 1025;
const STEP_COUNT = 5;
const HISTORY_STORAGE_KEY = "minigame:daily-history:v1";
const MIN_HISTORY_DATE = "2025-11-01"; // History available starting from this date
const POKEAPI_BASE = "https://pokeapi.co/api/v2";
const DAY_MS = 24 * 60 * 60 * 1000;
const OUTCOME_SOLVED = "solved";
const OUTCOME_FAILED = "failed";
const CONFETTI_COLORS = ["#38bdf8", "#fbbf24", "#f472b6", "#34d399", "#a855f7", "#f97316"];

// Case, accents, punctuation, spaces and ♀/♂ are ignored when comparing names, so "mr mime",
// "flabebe" and "nidoran f" match "Mr. Mime", "Flabébé" and "Nidoran♀".
const normalizeName = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[♀]/g, "f")
    .replace(/[♂]/g, "m")
    .replace(/[^a-z0-9]/g, "");

const nameForPokemonId = (pokemonId) => {
  const slug = NATIONAL_ID_TO_SLUG[pokemonId];
  return slug ? formatPokemonName(slug) : null;
};

// Splits a display name into clue slots: characters that count toward the answer (letters,
// digits, ♀/♂) point at their position in the normalized name; separators (" ", "-", ".", ":",
// "’") have no index and are always shown.
const buildNameSlots = (displayName) => {
  const slots = [];
  let index = 0;
  for (const char of String(displayName || "")) {
    const normalized = normalizeName(char);
    if (normalized) {
      slots.push({ char, index });
      index += normalized.length;
    } else {
      slots.push({ char, index: null });
    }
  }
  return slots;
};

const formatGeneration = (gen) => {
  if (!gen?.name) return "Unknown";
  const match = /generation-(\w+)/i.exec(gen.name);
  if (!match) return toTitleCase(gen.name);
  return `Generation ${match[1].toUpperCase()}`;
};

const findEnglishText = (list, key) => {
  if (!Array.isArray(list)) return null;
  const value = list.find((item) => item?.language?.name === "en")?.[key];
  if (typeof value !== "string") return null;
  return value.replace(/[\f\n\r]/g, " ").replace(/\s+/g, " ").trim() || null;
};

const formatHeight = (decimeters) => {
  if (!Number.isFinite(decimeters)) return "Unknown";
  return `${(decimeters / 10).toFixed(1)} m`;
};

const formatWeight = (hectograms) => {
  if (!Number.isFinite(hectograms)) return "Unknown";
  return `${(hectograms / 10).toFixed(1)} kg`;
};

/* ------------------------------------------------------------------ Dates */
// The daily puzzle rolls over at midnight UTC so everyone gets the same Pokémon for the same
// date. Every date key on this page ("YYYY-MM-DD") is a UTC calendar date.

const toDateKey = (date) => date.toISOString().slice(0, 10);

const getUtcDateKey = () => toDateKey(new Date());

const parseDateKey = (value) => {
  if (!value || typeof value !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const shiftDateKey = (dateKey, days) => {
  const date = parseDateKey(dateKey);
  return date ? toDateKey(new Date(date.getTime() + days * DAY_MS)) : null;
};

const isDateOnOrAfter = (value, minimum) => {
  const target = parseDateKey(value);
  const min = parseDateKey(minimum);
  if (!target || !min) return false;
  return target.getTime() >= min.getTime();
};

const getDaysSinceStart = (dateKey) => {
  const startDate = parseDateKey(MIN_HISTORY_DATE);
  const targetDate = parseDateKey(dateKey);
  if (!startDate || !targetDate) return 0;
  return Math.max(0, Math.floor((targetDate.getTime() - startDate.getTime()) / DAY_MS));
};

/* ------------------------------------------------------------------ Daily Pokémon */

// One round of xorshift32, normalized to [0, 1).
const seededRandom = (seed) => {
  let x = seed >>> 0 || 1; // 0 is a fixed point of xorshift
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 0x100000000;
};

// djb2 followed by a murmur-style finalizer.
const hashStringToNumber = (value) => {
  let hash = 5381;
  const input = String(value || "");
  for (let idx = 0; idx < input.length; idx += 1) {
    hash = ((hash << 5) + hash) + input.charCodeAt(idx);
    hash = hash >>> 0;
  }
  hash = hash ^ (hash >>> 16);
  hash = hash * 0x85ebca6b;
  hash = hash ^ (hash >>> 13);
  hash = hash * 0xc2b2ae35;
  hash = hash ^ (hash >>> 16);
  return hash >>> 0;
};

// Deterministic Pokémon for a date. Any change to this math (or to MAX_POKEMON_ID) changes the
// answer for past and future days. seed+1 and seed+2 produce almost the same xorshift output as
// seed, so the weighted blend is effectively seededRandom(seed); it is kept because simplifying
// it would still change the answer on roughly one day in eight.
const computeDailyPokemonId = (dateKey) => {
  const dateHash = hashStringToNumber(dateKey);
  let seed = dateHash;
  seed = seed ^ (getDaysSinceStart(dateKey) * 0x9e3779b9);
  seed = seed ^ (dateHash >>> 16);
  const combined = seededRandom(seed) * 0.5 + seededRandom(seed + 1) * 0.3 + seededRandom(seed + 2) * 0.2;
  const randomId = Math.floor(combined * MAX_POKEMON_ID) + 1;
  return Math.max(1, Math.min(MAX_POKEMON_ID, randomId));
};

// Puzzle data per Pokémon id, kept for the whole session so revisiting a day never refetches.
const puzzlePokemonCache = new Map();

const fetchPuzzlePokemon = async (pokemonId, signal) => {
  const cached = puzzlePokemonCache.get(pokemonId);
  if (cached) return cached;

  const [pokemonResponse, speciesResponse] = await Promise.all([
    fetch(`${POKEAPI_BASE}/pokemon/${pokemonId}`, { signal }),
    fetch(`${POKEAPI_BASE}/pokemon-species/${pokemonId}`, { signal }),
  ]);
  if (!pokemonResponse.ok || !speciesResponse.ok) {
    throw new Error(`Failed to load Pokémon (status ${pokemonResponse.status}/${speciesResponse.status})`);
  }
  const [pokemonData, speciesData] = await Promise.all([pokemonResponse.json(), speciesResponse.json()]);

  const types = Array.isArray(pokemonData?.types)
    ? pokemonData.types
        .slice()
        .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))
        .map((entry) => entry?.type?.name)
        .filter(Boolean)
    : [];

  // Species names never carry form suffixes ("lycanroc", not "lycanroc-midday").
  const speciesName = speciesData?.name || NATIONAL_ID_TO_SLUG[pokemonId] || "";
  const displayName =
    findEnglishText(speciesData?.names, "name") || formatPokemonName(speciesName) || `Pokémon #${pokemonId}`;
  const normalizedName = normalizeName(displayName);
  const answers = [...new Set([normalizedName, normalizeName(speciesName)].filter(Boolean))];

  const payload = {
    id: pokemonId,
    speciesName,
    displayName,
    normalizedName,
    answers,
    types,
    generation: speciesData?.generation ?? null,
    classification: findEnglishText(speciesData?.genera, "genus"),
    height: Number.isFinite(pokemonData?.height) ? pokemonData.height : null,
    weight: Number.isFinite(pokemonData?.weight) ? pokemonData.weight : null,
  };
  puzzlePokemonCache.set(pokemonId, payload);
  return payload;
};

/* ------------------------------------------------------------------ History */

const isValidPokemonId = (value) => Number.isInteger(value) && value >= 1 && value <= MAX_POKEMON_ID;

// A record is `{ date, pokemonId, pokemonName, completedAt, outcome, solvedAtStep }` where outcome is
// "solved" (solvedAtStep = 1-4) or "failed" (gave up / wrong final guess, solvedAtStep = null).
// Records saved before outcomes existed stored failures as solvedAtStep 5 (a correct guess always
// lands on steps 1-4) and a name cut at the first hyphen ("Ho" for Ho-Oh), so both are rebuilt here.
const normalizeHistoryRecord = (entry) => {
  const pokemonId = isValidPokemonId(entry.pokemonId) ? entry.pokemonId : null;
  const step = Number.isInteger(entry.solvedAtStep) ? entry.solvedAtStep : null;
  const isLegacy = entry.outcome !== OUTCOME_SOLVED && entry.outcome !== OUTCOME_FAILED;
  const outcome = isLegacy
    ? step != null && step >= 1 && step < STEP_COUNT
      ? OUTCOME_SOLVED
      : OUTCOME_FAILED
    : entry.outcome;
  const storedName = typeof entry.pokemonName === "string" ? entry.pokemonName : null;
  return {
    date: entry.date,
    pokemonId,
    pokemonName: (isLegacy ? nameForPokemonId(pokemonId) : storedName) || storedName || nameForPokemonId(pokemonId),
    completedAt: typeof entry.completedAt === "string" ? entry.completedAt : null,
    outcome,
    solvedAtStep: outcome === OUTCOME_SOLVED ? step : null,
  };
};

const loadStoredHistory = () => {
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => entry && typeof entry.date === "string" && isDateOnOrAfter(entry.date, MIN_HISTORY_DATE))
      .map(normalizeHistoryRecord)
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch (error) {
    console.warn("[Minigame] Failed to load history", error);
    return [];
  }
};

const saveHistoryRecords = (records) => {
  try {
    const filtered = records.filter((entry) => entry && isDateOnOrAfter(entry.date, MIN_HISTORY_DATE));
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.warn("[Minigame] Failed to persist history", error);
  }
};

const formatHistoryDate = (dateKey) => {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey || "Unknown";
  // Date keys are UTC dates; format them in UTC so e.g. "2026-10-20" never shows as Oct 19.
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
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

const formatCluesUsed = (cluesUsed) => `${cluesUsed} ${cluesUsed === 1 ? "clue" : "clues"}`;

const formatOutcomeSummary = (record) => {
  if (!record) return "";
  if (record.outcome !== OUTCOME_SOLVED) return "Not solved";
  const cluesUsed = Math.max(0, (record.solvedAtStep ?? 1) - 1);
  return cluesUsed === 0 ? "Solved with no clues" : `Solved after ${formatCluesUsed(cluesUsed)}`;
};

// Green = solved with no clues (best) ... orange = solved after 3 clues, red = not solved.
const SOLVED_COLORS = [
  "rgba(34, 197, 94, 0.2)", // green-500 - no clues
  "rgba(74, 222, 128, 0.2)", // green-400 - 1 clue
  "rgba(234, 179, 8, 0.2)", // yellow-500 - 2 clues
  "rgba(249, 115, 22, 0.2)", // orange-500 - 3 clues
];
const FAILED_COLOR = "rgba(239, 68, 68, 0.2)"; // red-500

const getCompletionColor = (record) => {
  if (record?.outcome !== OUTCOME_SOLVED) return FAILED_COLOR;
  const cluesUsed = Math.max(0, (record.solvedAtStep ?? 1) - 1);
  return SOLVED_COLORS[Math.min(SOLVED_COLORS.length - 1, cluesUsed)];
};

// Every date from today back to MIN_HISTORY_DATE (newest first), with that day's record if played.
const buildFullHistory = (records, todayKey) => {
  const recordsByDate = new Map(records.map((entry) => [entry.date, entry]));
  const days = [];
  for (let dateKey = todayKey; dateKey && dateKey >= MIN_HISTORY_DATE; dateKey = shiftDateKey(dateKey, -1)) {
    const record = recordsByDate.get(dateKey);
    days.push(record ? { ...record, isCompleted: true } : { date: dateKey, isCompleted: false });
  }
  return days;
};

export default function MinigamePage() {
  const todayKey = getUtcDateKey();
  const [dailyKey, setDailyKey] = useState(todayKey);

  // Legacy #/whosthat URLs are redirected by the router (router.js) before the app renders.

  const [history, setHistory] = useState(loadStoredHistory);
  const [pokemon, setPokemon] = useState(null);
  const [loadError, setLoadError] = useState(null); // { pokemonId, message }
  const [retryCount, setRetryCount] = useState(0);
  const [progressStep, setProgressStep] = useState(1);
  const [revealedLetters, setRevealedLetters] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [feedbackType, setFeedbackType] = useState("info");
  const [confettiPieces, setConfettiPieces] = useState([]);
  const confettiTimeoutRef = useRef(null);

  const currentRecord = useMemo(
    () => history.find((entry) => entry.date === dailyKey) || null,
    [history, dailyKey]
  );
  const isCompleted = Boolean(currentRecord);
  const isSolved = currentRecord?.outcome === OUTCOME_SOLVED;
  // A finished day keeps the Pokémon it was played with, even if the daily formula changes later.
  const targetPokemonId = currentRecord?.pokemonId ?? computeDailyPokemonId(dailyKey);
  const step = isCompleted ? STEP_COUNT : progressStep;

  // Only data for the day being shown counts, so a late response for another day is never displayed.
  const activePokemon = pokemon?.id === targetPokemonId ? pokemon : null;
  const error = !activePokemon && loadError?.pokemonId === targetPokemonId ? loadError.message : null;
  const loading = !activePokemon && !error;

  const fullHistory = useMemo(() => buildFullHistory(history, todayKey), [history, todayKey]);

  useEffect(() => {
    const cached = puzzlePokemonCache.get(targetPokemonId);
    if (cached) {
      setPokemon(cached);
      return undefined;
    }
    setLoadError(null);
    // Aborted when the date changes, so flipping quickly through days can't let an older
    // request land after a newer one.
    const controller = new AbortController();
    fetchPuzzlePokemon(targetPokemonId, controller.signal)
      .then((payload) => {
        if (!controller.signal.aborted) setPokemon(payload);
      })
      .catch((fetchError) => {
        if (controller.signal.aborted) return;
        setLoadError({
          pokemonId: targetPokemonId,
          message: fetchError?.message || "Unable to load Pokémon. Please try again later.",
        });
      });
    return () => controller.abort();
  }, [targetPokemonId, retryCount]);

  const handleRetry = useCallback(() => {
    setLoadError(null);
    setRetryCount((count) => count + 1);
  }, []);

  useEffect(
    () => () => {
      if (confettiTimeoutRef.current) {
        clearTimeout(confettiTimeoutRef.current);
      }
    },
    []
  );

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

  const loadGameForDate = useCallback(
    (dateKey) => {
      if (!parseDateKey(dateKey)) return;
      setShowHistory(false);
      if (dateKey === dailyKey) return;
      setDailyKey(dateKey);
      setProgressStep(1);
      setRevealedLetters([]);
      setGuess("");
      setFeedback(null);
      setFeedbackType("info");
      setConfettiPieces([]);
    },
    [dailyKey]
  );

  const previousDateKey = useMemo(() => {
    const key = shiftDateKey(dailyKey, -1);
    return key && key >= MIN_HISTORY_DATE ? key : null;
  }, [dailyKey]);

  const nextDateKey = useMemo(() => {
    const key = shiftDateKey(dailyKey, 1);
    return key && key <= todayKey ? key : null;
  }, [dailyKey, todayKey]);

  const displayName = activePokemon?.displayName || "";

  const nameSlots = useMemo(() => buildNameSlots(activePokemon?.displayName), [activePokemon?.displayName]);

  // Name clue: answer letters are blanks until guessed in the right position; separators always show.
  const nameClueChars = useMemo(() => {
    if (!activePokemon) return null;
    return nameSlots.map(({ char, index }) => {
      if (index == null) return { char, kind: char.trim() ? "is-letter" : "is-space" };
      if (isCompleted || revealedLetters[index]) return { char, kind: "is-letter" };
      return { char: "_", kind: "is-underscore" };
    });
  }, [activePokemon, nameSlots, isCompleted, revealedLetters]);

  const typeLabel = useMemo(() => {
    if (!activePokemon?.types?.length) return "Unknown";
    return activePokemon.types.map((type) => toTitleCase(type)).join(" / ");
  }, [activePokemon]);

  const generationLabel = useMemo(() => formatGeneration(activePokemon?.generation), [activePokemon]);

  const hintList = useMemo(() => {
    if (!activePokemon) return [];
    const hints = [];
    if (step >= 2) hints.push({ id: "types", label: "Type", value: typeLabel });
    if (step >= 3) {
      hints.push({ id: "classification", label: "Classification", value: activePokemon.classification || "Unknown" });
      hints.push({ id: "generation", label: "Generation", value: generationLabel });
    }
    return hints;
  }, [activePokemon, step, typeLabel, generationLabel]);

  const markCompletion = useCallback(
    (outcome, resolvedStep = null) => {
      if (!activePokemon || currentRecord) return;
      const record = {
        date: dailyKey,
        pokemonId: activePokemon.id,
        pokemonName: activePokemon.displayName,
        completedAt: new Date().toISOString(),
        outcome,
        solvedAtStep: outcome === OUTCOME_SOLVED ? resolvedStep : null,
      };
      const updated = [record, ...history.filter((entry) => entry.date !== record.date)].sort((a, b) =>
        b.date.localeCompare(a.date)
      );
      setHistory(updated);
      saveHistoryRecords(updated);
      setShowHistory(true);
    },
    [activePokemon, currentRecord, dailyKey, history]
  );

  const handleHistoryToggle = useCallback(() => {
    setShowHistory((prev) => !prev);
  }, []);

  // Reveal letters of the answer that the guess has in the same position (ignoring punctuation).
  const revealMatchingLetters = useCallback(
    (normalizedGuess) => {
      const target = activePokemon?.normalizedName || "";
      if (!target || !normalizedGuess) return;
      setRevealedLetters((prev) => {
        let next = null;
        const limit = Math.min(target.length, normalizedGuess.length);
        for (let i = 0; i < limit; i += 1) {
          if (target[i] === normalizedGuess[i] && !prev[i]) {
            next = next || [...prev];
            next[i] = true;
          }
        }
        return next || prev;
      });
    },
    [activePokemon]
  );

  const handleGuessSubmit = useCallback(
    (event) => {
      event.preventDefault();
      if (!activePokemon || isCompleted) return;

      const normalizedGuess = normalizeName(guess.trim());
      setGuess("");

      if (normalizedGuess && activePokemon.answers.includes(normalizedGuess)) {
        const cluesUsed = Math.max(0, step - 1);
        setFeedback(
          cluesUsed === 0
            ? "Incredible! You solved it without any clues!"
            : `Correct! You solved it after ${formatCluesUsed(cluesUsed)}.`
        );
        setFeedbackType("success");
        generateConfetti();
        markCompletion(OUTCOME_SOLVED, step);
        return;
      }

      // A wrong guess reveals matching letters and the next clue; an empty one just skips ahead.
      revealMatchingLetters(normalizedGuess);
      const nextStep = Math.min(STEP_COUNT, step + 1);
      setProgressStep(nextStep);
      if (nextStep >= STEP_COUNT) {
        setFeedback(`Out of clues! It was ${activePokemon.displayName}.`);
        setFeedbackType("warning");
        markCompletion(OUTCOME_FAILED);
      } else if (normalizedGuess) {
        setFeedback("Not quite! Another clue has been revealed.");
        setFeedbackType("error");
      } else {
        setFeedback(null);
        setFeedbackType("info");
      }
    },
    [activePokemon, isCompleted, guess, step, generateConfetti, markCompletion, revealMatchingLetters]
  );

  // Revisiting a finished day shows its result unless this session just set a message.
  let shownFeedback = feedback;
  let shownFeedbackType = feedbackType;
  if (!shownFeedback && currentRecord) {
    shownFeedback = isSolved
      ? `Daily complete: ${formatOutcomeSummary(currentRecord)}`
      : `Not solved. It was ${currentRecord.pokemonName || displayName}.`;
    shownFeedbackType = isSolved ? "success" : "warning";
  }

  const totalHistory = fullHistory.length;
  const solvedCount = fullHistory.filter((entry) => entry.isCompleted && entry.outcome === OUTCOME_SOLVED).length;
  const failedCount = fullHistory.filter((entry) => entry.isCompleted && entry.outcome !== OUTCOME_SOLVED).length;
  const hasHistory = totalHistory > 0;

  const getHistoryPokemonName = (entry) => {
    // Unplayed days keep their Pokémon hidden.
    if (!entry.isCompleted) return "???";
    return entry.pokemonName || nameForPokemonId(entry.pokemonId) || `#${entry.pokemonId}`;
  };

  const guessDisabled = !activePokemon || isCompleted;
  const revealDetailsStep = STEP_COUNT - 1;
  const showRevealDetails = step >= revealDetailsStep;
  const showFinalReveal = step >= STEP_COUNT;
  const headerTitle = "Who's That Pokémon?";
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
              <span className={`minigame-status-indicator${isSolved ? " is-complete" : ""}`}>
                <span className="minigame-status-dot" aria-hidden="true"></span>
                {isCompleted
                  ? `${isSolved ? "Completed" : "Revealed"} ${formatHistoryTimestamp(currentRecord.completedAt)}`
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
                <button type="button" onClick={handleRetry} className="minigame-button">
                  Try Again
                </button>
              </div>
            ) : (
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
                {nameClueChars && nameClueChars.length > 0 && (
                  <div className="minigame-name-clue">
                    <span className="minigame-name-clue-title">Name</span>
                    <div className="minigame-name-clue-content">
                      {nameClueChars.map(({ char, kind }, index) => (
                        <span key={index} className={`minigame-name-clue-char ${kind}`}>
                          {char}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="minigame-stage-center">
                  <div className={spriteWrapperClassName}>
                    <SpriteImage
                      id={activePokemon.id}
                      alt={showFinalReveal ? displayName : "Silhouette of a mystery Pokémon"}
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
                onClick={() => loadGameForDate(previousDateKey)}
                disabled={!previousDateKey}
                aria-label="Previous date"
                title="Previous date"
              >
                ←
              </button>
              <button
                type="button"
                className="minigame-nav-button"
                onClick={() => loadGameForDate(nextDateKey)}
                disabled={!nextDateKey}
                aria-label="Next date"
                title="Next date"
              >
                →
              </button>
            </div>
            <input
              className="minigame-guess-input"
              type="text"
              placeholder={isCompleted ? (isSolved ? "Solved for today" : "Answer revealed") : "Enter Pokémon name"}
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              disabled={guessDisabled}
              aria-label="Guess the Pokémon"
            />
            <button type="submit" className="minigame-guess-button" disabled={guessDisabled}>
              {isCompleted ? (isSolved ? "Solved" : "Revealed") : "Submit Guess"}
            </button>
          </form>

          {shownFeedback && <div className={`minigame-feedback ${shownFeedbackType}`}>{shownFeedback}</div>}

          {activePokemon ? (
            <>
              {isCompleted && (
                <div className="minigame-success-summary">
                  <span>{formatOutcomeSummary(currentRecord)}</span>
                </div>
              )}

              {showRevealDetails && (
                <section className="minigame-reveal" aria-live="polite">
                  <div className="minigame-reveal-grid">
                    <div>
                      <span className="minigame-reveal-label">Height</span>
                      <span className="minigame-reveal-value">{formatHeight(activePokemon.height)}</span>
                    </div>
                    <div>
                      <span className="minigame-reveal-label">Weight</span>
                      <span className="minigame-reveal-value">{formatWeight(activePokemon.weight)}</span>
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
                    <span className="minigame-history-count">
                      {solvedCount} of {totalHistory} solved
                      {failedCount > 0 ? ` · ${failedCount} missed` : ""}
                    </span>
                  </div>
                  {hasHistory ? (
                    <ul className="minigame-history-list">
                      {fullHistory.map((entry) => {
                        const entryCompleted = entry.isCompleted;
                        const pokemonName = getHistoryPokemonName(entry);
                        const completionColor = entryCompleted ? getCompletionColor(entry) : null;
                        return (
                          <li
                            key={entry.date}
                            className={`minigame-history-entry${!entryCompleted ? " is-uncompleted" : ""}`}
                            style={completionColor ? { backgroundColor: completionColor } : undefined}
                          >
                            <div className="minigame-history-entry-primary">
                              <span className="minigame-history-name">{pokemonName}</span>
                              <span className="minigame-history-date">{formatHistoryDate(entry.date)}</span>
                            </div>
                            {entryCompleted && entry.pokemonId != null && (
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
                              {entryCompleted && entry.pokemonId != null && (
                                <span className="minigame-history-id">ID #{entry.pokemonId}</span>
                              )}
                              {entryCompleted ? (
                                <span className="minigame-history-time">{formatOutcomeSummary(entry)}</span>
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
