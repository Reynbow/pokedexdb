import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./styles/pages/whos-that.css";
import Icon, { Cursor } from "./components/Icon.jsx";
import SpriteImage from "./components/SpriteImage.jsx";
import { TypeTag } from "./pokedex/EntryParts.jsx";
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
// Four guesses (steps 1-4); step 5 is the final reveal.
const GUESS_COUNT = STEP_COUNT - 1;
// Confetti bits take one of these palette tones (whos-that.css .wt-confetti__bit--N).
const CONFETTI_TONES = 4;

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

// History stamp per result: gold = solved with no clues (best), plain = solved after 1-3 clues,
// red = not solved.
const getOutcomeStamp = (record) => {
  if (record?.outcome !== OUTCOME_SOLVED) return { className: "stamp stamp--red", short: "Missed" };
  const cluesUsed = Math.max(0, (record.solvedAtStep ?? 1) - 1);
  if (cluesUsed === 0) return { className: "stamp stamp--gold", short: "No clues" };
  return { className: "stamp", short: formatCluesUsed(cluesUsed) };
};

// Days solved in a row, counting back from today. Today not being played yet doesn't break it.
const computeStreak = (days) => {
  let streak = 0;
  for (let index = 0; index < days.length; index += 1) {
    const day = days[index];
    if (day.isCompleted && day.outcome === OUTCOME_SOLVED) {
      streak += 1;
    } else if (index === 0 && !day.isCompleted) {
      continue;
    } else {
      break;
    }
  }
  return streak;
};

// Stamp shown at the start of the dialog message for each feedback type.
const FEEDBACK_STAMPS = {
  success: { className: "stamp stamp--gold", label: "Solved" },
  warning: { className: "stamp stamp--red", label: "Revealed" },
  error: { className: "stamp stamp--red", label: "Miss" },
};

// What the dialog says while a day is being played and no feedback message is set.
const STEP_PROMPTS = {
  1: "Who's that Pokémon? A wrong or empty guess reveals a clue.",
  2: "Clue 1 of 3: its type.",
  3: "Clue 2 of 3: its classification and generation.",
  4: "Clue 3 of 3: in colour, with height and weight. Last guess!",
};

const formatDexNo = (pokemonId) => `No.${String(pokemonId).padStart(3, "0")}`;

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
      tone: Math.floor(Math.random() * CONFETTI_TONES),
      xOffset: Math.random() * 80 - 40,
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
      if (index == null) return { char, kind: char.trim() ? "mark" : "space" };
      if (isCompleted || revealedLetters[index]) return { char, kind: "shown" };
      return { char: "_", kind: "blank" };
    });
  }, [activePokemon, nameSlots, isCompleted, revealedLetters]);

  // The name clue as a screen reader hears it: "7 letters: P blank K blank ..."
  const nameClueSpoken = useMemo(() => {
    if (!nameClueChars) return "";
    const letters = nameClueChars.filter((slot) => slot.kind === "blank" || normalizeName(slot.char));
    const spoken = nameClueChars.map((slot) => (slot.kind === "blank" ? "blank" : slot.kind === "space" ? "space" : slot.char));
    return `${letters.length} letters: ${spoken.join(" ")}`;
  }, [nameClueChars]);

  const typeLabel = useMemo(() => {
    if (!activePokemon?.types?.length) return "Unknown";
    return activePokemon.types.map((type) => toTitleCase(type)).join(" / ");
  }, [activePokemon]);

  const generationLabel = useMemo(() => formatGeneration(activePokemon?.generation), [activePokemon]);

  // Every clue has a slot from the start; each unlocks at its step (after guess `after`).
  const clueItems = useMemo(() => {
    const types = activePokemon?.types || [];
    return [
      {
        id: "types",
        label: "Type",
        after: 1,
        unlocked: Boolean(activePokemon) && step >= 2,
        value:
          types.length > 0 ? (
            <span className="wt-clue__types">
              {types.map((type) => (
                <TypeTag key={type} typeName={type} />
              ))}
            </span>
          ) : (
            typeLabel
          ),
      },
      {
        id: "classification",
        label: "Classification",
        after: 2,
        unlocked: Boolean(activePokemon) && step >= 3,
        value: activePokemon?.classification || "Unknown",
      },
      { id: "generation", label: "Generation", after: 2, unlocked: Boolean(activePokemon) && step >= 3, value: generationLabel },
      {
        id: "height",
        label: "Height",
        after: 3,
        unlocked: Boolean(activePokemon) && step >= STEP_COUNT - 1,
        value: formatHeight(activePokemon?.height),
      },
      {
        id: "weight",
        label: "Weight",
        after: 3,
        unlocked: Boolean(activePokemon) && step >= STEP_COUNT - 1,
        value: formatWeight(activePokemon?.weight),
      },
    ];
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
  const streak = useMemo(() => computeStreak(fullHistory), [fullHistory]);
  const hasHistory = totalHistory > 0;

  const getHistoryPokemonName = (entry) => {
    // Unplayed days keep their Pokémon hidden.
    if (!entry.isCompleted) return "???";
    return entry.pokemonName || nameForPokemonId(entry.pokemonId) || `#${entry.pokemonId}`;
  };

  const guessDisabled = !activePokemon || isCompleted;
  const showFinalReveal = step >= STEP_COUNT;
  const headerTitle = "Who's That Pokémon?";
  // Steps 1-3 show a silhouette; step 4 (the last guess) and the final reveal show the Pokémon.
  const isHiddenSprite = step <= 3;
  const isToday = dailyKey === todayKey;

  let stepLabel = `Guess ${Math.min(step, GUESS_COUNT)} of ${GUESS_COUNT}`;
  if (isCompleted) stepLabel = isSolved ? "Solved" : "Revealed";
  else if (loading) stepLabel = "Loading";
  else if (error) stepLabel = "No signal";

  // One pip per guess: used, the current guess, the winning guess, or not reached.
  const solvedAtStep = isSolved ? currentRecord?.solvedAtStep ?? null : null;
  const pips = Array.from({ length: GUESS_COUNT }, (_, index) => {
    const guessNumber = index + 1;
    if (isCompleted) {
      if (solvedAtStep == null) return "used";
      return guessNumber < solvedAtStep ? "used" : guessNumber === solvedAtStep ? "hit" : "idle";
    }
    return guessNumber < step ? "used" : guessNumber === step ? "current" : "idle";
  });

  let dialogMessage = shownFeedback;
  if (!dialogMessage) {
    if (loading) dialogMessage = "Loading a mystery Pokémon…";
    else if (error) dialogMessage = "The mystery Pokémon didn't load.";
    else dialogMessage = STEP_PROMPTS[step] || STEP_PROMPTS[1];
  }
  const feedbackStamp = shownFeedback ? FEEDBACK_STAMPS[shownFeedbackType] || null : null;

  const statusText = isCompleted
    ? `${isSolved ? "Completed" : "Revealed"} ${formatHistoryTimestamp(currentRecord.completedAt)} · ${formatOutcomeSummary(currentRecord)}`
    : "Not completed yet";

  return (
    <main className="wt">
      <header className="wt-head">
        <div className="wt-head__text">
          <h1 className="wt-title">{headerTitle}</h1>
          <p className="wt-intro">Name the daily mystery Pokémon from its silhouette. A new one appears at midnight UTC.</p>
        </div>

        <div className="wt-days" role="group" aria-label="Choose a day">
          <button
            type="button"
            className="btn btn--icon wt-days__step"
            onClick={() => loadGameForDate(previousDateKey)}
            disabled={!previousDateKey}
            aria-label="Previous date"
            title="Previous date"
          >
            <Icon name="left" />
          </button>
          <p className="wt-days__date">
            <span className="wt-days__day">
              {isToday ? "Today" : "Daily"} · {formatHistoryDate(dailyKey)}
            </span>
          </p>
          <button
            type="button"
            className="btn btn--icon wt-days__step"
            onClick={() => loadGameForDate(nextDateKey)}
            disabled={!nextDateKey}
            aria-label="Next date"
            title="Next date"
          >
            <Icon name="right" />
          </button>
          {!isToday && (
            <button type="button" className="btn btn--sm wt-days__today" onClick={() => loadGameForDate(todayKey)}>
              Back to today
            </button>
          )}
        </div>
      </header>

      <div className="wt-game">
        <section className="win wt-screen" aria-label="Mystery Pokémon">
          <div className="wt-screen__head">
            <p className="wt-screen__step">{stepLabel}</p>
            <span className="wt-pips" aria-hidden="true">
              {pips.map((state, index) => (
                <span key={index} className={`wt-pip wt-pip--${state}`} />
              ))}
            </span>
          </div>

          <div className={`wt-stage${activePokemon ? " is-on" : ""}${isHiddenSprite ? " is-silhouette" : ""}`}>
            {confettiPieces.length > 0 && (
              <div className="wt-confetti" aria-hidden="true">
                {confettiPieces.map((piece, idx) => (
                  <span
                    key={idx}
                    className={`wt-confetti__bit wt-confetti__bit--${piece.tone}`}
                    style={{
                      left: `${piece.left}%`,
                      animationDelay: `${piece.delay}s`,
                      animationDuration: `${piece.duration}s`,
                      "--confetti-x": `${piece.xOffset}px`,
                    }}
                  />
                ))}
              </div>
            )}

            {loading ? (
              <span className="skeleton wt-stage__ghost" aria-hidden="true" />
            ) : error ? (
              <div className="empty wt-stage__error" role="alert">
                <p className="empty__title">Couldn&apos;t load the Pokémon</p>
                <p>{error}</p>
                <button type="button" onClick={handleRetry} className="btn">
                  Try again
                </button>
              </div>
            ) : (
              <span className="wt-art">
                <SpriteImage
                  id={activePokemon.id}
                  alt={showFinalReveal ? displayName : "Silhouette of a mystery Pokémon"}
                  className="wt-sprite"
                  variant="home"
                  width={256}
                  height={256}
                  loading="lazy"
                  draggable="false"
                  onContextMenu={(e) => e.preventDefault()}
                  onDragStart={(e) => e.preventDefault()}
                />
              </span>
            )}
          </div>

          {nameClueChars && nameClueChars.length > 0 ? (
            <p className="wt-name">
              <span className="sr-only">Name: {nameClueSpoken}</span>
              <span className="wt-name__slots" aria-hidden="true">
                {nameClueChars.map(({ char, kind }, index) => (
                  <span key={index} className={`wt-name__ch wt-name__ch--${kind}`}>
                    {kind === "blank" ? "" : char}
                  </span>
                ))}
              </span>
            </p>
          ) : (
            <p className="wt-name" aria-hidden="true">
              <span className="skeleton wt-name__ghost" />
            </p>
          )}

          <p className="wt-screen__status">{statusText}</p>
        </section>

        <div className="dialog wt-dialog">
          <p className="wt-dialog__text" aria-live="polite">
            {feedbackStamp ? <span className={`${feedbackStamp.className} wt-dialog__stamp`}>{feedbackStamp.label}</span> : null}
            {dialogMessage}
            {isCompleted ? <Icon name="down" className="dialog__caret wt-dialog__caret" /> : null}
          </p>
          <form className="wt-guess" onSubmit={handleGuessSubmit}>
            <label className="sr-only" htmlFor="wt-guess-input">
              Guess the Pokémon
            </label>
            <input
              id="wt-guess-input"
              className="field__input wt-guess__input"
              type="text"
              placeholder={isCompleted ? (isSolved ? "Solved for today" : "Answer revealed") : "Enter Pokémon name"}
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              disabled={guessDisabled}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="go"
            />
            <button type="submit" className="btn btn--primary wt-guess__btn" disabled={guessDisabled}>
              {isCompleted ? (isSolved ? "Solved" : "Revealed") : "Guess"}
            </button>
          </form>
        </div>

        <section className="win wt-clues" aria-labelledby="wt-clues-title">
          <div className="win__head">
            <h2 className="win__title" id="wt-clues-title">
              Clues
            </h2>
          </div>
          <dl className="win__body wt-clues__list" aria-live="polite">
            {clueItems.map((item) => (
              <div key={item.id} className={`wt-clue${item.unlocked ? "" : " is-locked"}`}>
                <dt className="wt-clue__label">{item.label}</dt>
                <dd className="wt-clue__value">
                  {item.unlocked ? (
                    item.value
                  ) : (
                    <>
                      <span aria-hidden="true">???</span>
                      <span className="sr-only">Revealed after guess {item.after}</span>
                    </>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="wt-score">
          <dl className="wt-score__list">
            <div className="wt-score__item">
              <dt>Solved</dt>
              <dd>
                <span className="wt-score__num">{solvedCount}</span>
                <span className="wt-score__of">/{totalHistory}</span>
              </dd>
            </div>
            <div className="wt-score__item">
              <dt>Missed</dt>
              <dd>
                <span className="wt-score__num">{failedCount}</span>
              </dd>
            </div>
            <div className="wt-score__item" title="Days solved in a row">
              <dt>Streak</dt>
              <dd>
                <span className="wt-score__num">{streak}</span>
              </dd>
            </div>
          </dl>
          <button
            type="button"
            className="btn btn--sm wt-score__history"
            onClick={handleHistoryToggle}
            aria-expanded={showHistory}
            aria-controls={showHistory ? "wt-history" : undefined}
          >
            {showHistory ? "Hide history" : "View history"}
            <Icon name={showHistory ? "up" : "down"} />
          </button>
        </div>
      </div>

      {showHistory && (
        <section id="wt-history" className="win wt-history" aria-labelledby="wt-history-title">
          <div className="win__head">
            <h2 className="win__title" id="wt-history-title">
              Game history
            </h2>
            <p className="wt-history__count">
              {solvedCount} of {totalHistory} solved
              {failedCount > 0 ? ` · ${failedCount} missed` : ""}
            </p>
          </div>
          <div className="win__body">
            {hasHistory ? (
              <ul className="wt-history__list">
                {fullHistory.map((entry) => {
                  const entryCompleted = entry.isCompleted;
                  const pokemonName = getHistoryPokemonName(entry);
                  const isCurrent = entry.date === dailyKey;
                  const outcomeStamp = entryCompleted ? getOutcomeStamp(entry) : null;
                  return (
                    <li
                      key={entry.date}
                      className={`wt-day${isCurrent ? " is-current" : ""}${entryCompleted ? "" : " is-unplayed"}`}
                      aria-current={isCurrent ? "date" : undefined}
                    >
                      <Cursor className="wt-day__cursor" />
                      <span className="wt-day__sprite" aria-hidden="true">
                        {entryCompleted && entry.pokemonId != null ? (
                          <SpriteImage
                            id={entry.pokemonId}
                            alt=""
                            className="wt-day__img"
                            variant="home"
                            width={64}
                            height={64}
                            loading="lazy"
                            draggable="false"
                            onContextMenu={(e) => e.preventDefault()}
                            onDragStart={(e) => e.preventDefault()}
                          />
                        ) : null}
                      </span>
                      <span className="wt-day__name">
                        {pokemonName}
                        {entryCompleted && entry.pokemonId != null ? (
                          <span className="wt-day__no">{formatDexNo(entry.pokemonId)}</span>
                        ) : null}
                      </span>
                      <span className="wt-day__date">{formatHistoryDate(entry.date)}</span>
                      <span className="wt-day__outcome">
                        {outcomeStamp ? (
                          <span className={outcomeStamp.className} title={formatOutcomeSummary(entry)}>
                            <span aria-hidden="true">{outcomeStamp.short}</span>
                            <span className="sr-only">{formatOutcomeSummary(entry)}</span>
                          </span>
                        ) : (
                          <>
                            <span className="wt-day__pending">Not completed</span>
                            <button
                              type="button"
                              className="btn btn--sm wt-day__play"
                              onClick={() => loadGameForDate(entry.date)}
                              aria-label={`Play game from ${formatHistoryDate(entry.date)}`}
                            >
                              <Icon name="play" />
                              Play
                            </button>
                          </>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="empty">
                <p className="empty__title">No game history available.</p>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
