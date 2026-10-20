import React, { useEffect, useMemo, useRef, useState } from "react";
import { Cursor } from "./Icon.jsx";
import SpriteImage from "./SpriteImage.jsx";
import { formatPokemonName } from "../utils/pokemonNames.js";
import { SPECIAL_FILTERS, SPECIAL_TAG_META } from "../constants/tags.js";
import { GAME_LOGO_LOOKUP, VERSION_LOGO_FILES } from "../constants/games.js";
import { buildPokemonPath } from "../utils/url.js";
import { getExclusiveVersionForSpecies } from "../constants/exclusives.js";
import { ULTRA_BEASTS, PARADOX_NAMES, BABY_NAMES, LEGENDARY_NAMES, MYTHICAL_NAMES } from "../constants/species.js";

// Local cache fallback to preserve memoization and reduce fetches when detailsCache is not provided
const localDetailsCache = new Map();

function useInView(options) {
  const ref = useRef(null);
  const optionsRef = useRef(options);
  const [inView, setInView] = useState(false);
  
  // Update options ref when options change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);
  
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const opts = optionsRef.current || { root: null, rootMargin: "1000px 0px", threshold: 0.01 };
    const obs = new IntersectionObserver(
      (entries) => {
        // Latch once visible: unmounting the sprite again on scroll-away would make it
        // reload (and re-walk its fallback chain) every time the card comes back.
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          obs.disconnect();
        }
      },
      opts
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []); // Empty deps - observer is created once and uses ref for options
  return [ref, inView];
}

const humanizeName = (s) => String(s || "").replace(/-/g, " ");
const toTitleCase = (value) => {
  const base = humanizeName(value);
  return base.replace(/\b\w/g, (char) => char.toUpperCase()).trim();
};
const stripMegaGmaxTokens = (rawName) => {
  const lower = String(rawName || "").toLowerCase();
  if (!lower) return "";
  const tokens = lower.split("-");
  const filtered = tokens.filter((t) => t !== "mega" && t !== "gmax");
  return filtered.join("-");
};
const formatDisplayName = formatPokemonName;

const deriveSpecialTags = (name) => {
  const lower = String(name || "").toLowerCase();
  if (!lower) return [];
  const tags = [];
  if (LEGENDARY_NAMES.has(lower)) tags.push("Legendary");
  if (MYTHICAL_NAMES.has(lower)) tags.push("Mythical");
  if (lower.includes("-mega") || lower.startsWith("mega-")) tags.push("Mega");
  if (ULTRA_BEASTS.has(lower)) tags.push("Ultra Beast");
  if (PARADOX_NAMES.has(lower)) tags.push("Paradox");
  if (lower.includes("-gmax")) tags.push("Gigantamax");
  if (BABY_NAMES.has(lower)) tags.push("Baby");
  return tags;
};

// Mapping from game keys to their sprite API paths
const GAME_SPRITE_PATHS = new Map([
  ["red-blue-yellow", "generation-i/yellow/transparent/"],
  ["gold-silver-crystal", "generation-ii/gold/transparent/"],
  ["ruby-sapphire-emerald", "generation-iii/ruby-sapphire/"],
  ["firered-leafgreen", "generation-iii/firered-leafgreen/"],
  ["diamond-pearl", "generation-iv/diamond-pearl/"],
  ["platinum", "generation-iv/platinum/"],
  ["heartgold-soulsilver", "generation-iv/heartgold-soulsilver/"],
  ["black-white", "generation-v/black-white/"],
  ["black-2-white-2", "generation-v/black-white/"],
  ["x-y", "generation-vi/x-y/"],
  ["omega-ruby-alpha-sapphire", "generation-vi/omegaruby-alphasapphire/"],
  ["sun-moon", "generation-vii/ultra-sun-ultra-moon/"],
  ["ultra-sun-ultra-moon", "generation-vii/ultra-sun-ultra-moon/"],
]);

// Determine sprite variant and game-specific path based on selected game
// For games in GAME_SPRITE_PATHS, use game-specific sprite paths
// Never use "home" variant - fall back to local sprites instead
const getSpriteVariantForGame = (selectedGame) => {
  if (!selectedGame) return { variant: null, gameSpritePath: null };
  const gameSpritePath = GAME_SPRITE_PATHS.get(selectedGame) || null;
  
  // If game has a specific sprite path, use it
  if (gameSpritePath) {
    return { variant: null, gameSpritePath };
  }
  
  // Never use "home" variant - use null to fall back to local sprites
  return { variant: null, gameSpritePath: null };
};

const isPlainLeftClick = (event) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

// Exclusive-version stamp text: "Let's Go Pikachu" reads as "Pikachu" next to the logo
const shortVersionLabel = (versionKey) =>
  toTitleCase(String(versionKey).replace(/^lets-go-/, "").replace(/-/g, " "));

/**
 * One Pokédex entry. The same markup is a grid tile on wide screens and a numbered row
 * in the entry list and on phones; CSS decides (.dex-grid / .dex-rows).
 */
function PokemonCard({
  name,
  id,
  url,
  types: typesProp = null,
  onSelect,
  selected,
  dexNumber,
  detailsCache,
  shiny = false,
  selectedGame = null,
  eagerLoad = false,
  displayNameOverride = null,
}) {
  const cache = detailsCache || localDetailsCache;
  const hasTypesProp = Array.isArray(typesProp) && typesProp.length > 0;
  const [fetchedTypes, setFetchedTypes] = useState(() => cache.get(String(id))?.types || []);
  // Types normally come from the static Pokémon index; only fetch for entries missing from it.
  const types = hasTypesProp ? typesProp : fetchedTypes;
  const intersectionOptions = useMemo(() => ({ root: null, rootMargin: "600px 0px", threshold: 0.01 }), []);
  const [cardRef, inView] = useInView(intersectionOptions);
  const baseSpeciesId = useMemo(() => {
    if (!dexNumber) return null;
    const match = String(dexNumber).match(/\d+/);
    if (!match) return null;
    const value = Number(match[0]);
    if (!Number.isFinite(value) || value <= 0) return null;
    return value;
  }, [dexNumber]);
  const specialTags = useMemo(() => {
    const tags = deriveSpecialTags(name) || [];
    return tags
      .map((tag) => {
        const meta = SPECIAL_TAG_META.get(tag);
        if (!meta) return null;
        const order = SPECIAL_FILTERS.indexOf(tag);
        return { key: tag, tag, short: meta.short, order: order >= 0 ? order : 99 };
      })
      .filter(Boolean)
      .sort((a, b) => a.order - b.order || a.tag.localeCompare(b.tag));
  }, [name]);

  const { formAwareName, baseSpeciesName } = useMemo(() => {
    const stripped = stripMegaGmaxTokens(name || "").toLowerCase();
    // Preserve Indeedee gender forms and Paldean Tauros breed forms
    if (/^indeedee-(male|female)$/.test(stripped)) {
      return { formAwareName: stripped, baseSpeciesName: stripped };
    }
    if (/^tauros-paldea-(combat|blaze|aqua)-breed$/.test(stripped)) {
      return { formAwareName: stripped, baseSpeciesName: stripped };
    }
    // Remove common regional/form tokens so exclusives can fall back to base species
    const baseName = stripped
      .replace(/-(alola|galar|hisui|paldea|original|totem|starter|male|female|f|m)$/g, "")
      .replace(/-(mega|gmax)$/g, "");
    return { formAwareName: stripped, baseSpeciesName: baseName };
  }, [name]);

  const exclusive = useMemo(() => {
    if (!selectedGame) return null;
    // Try form-aware name first, then fall back to base species name
    const versionKey =
      getExclusiveVersionForSpecies(selectedGame, formAwareName) ||
      getExclusiveVersionForSpecies(selectedGame, baseSpeciesName);
    if (!versionKey) return null;
    const logoFile = VERSION_LOGO_FILES.get(versionKey);
    return {
      logoUrl: logoFile ? GAME_LOGO_LOOKUP.get(logoFile) : null,
      label: toTitleCase(String(versionKey).replace(/-/g, " ")),
      short: shortVersionLabel(versionKey),
    };
  }, [selectedGame, formAwareName, baseSpeciesName]);

  const { variant: spriteVariant, gameSpritePath } = useMemo(() => getSpriteVariantForGame(selectedGame), [selectedGame]);

  useEffect(() => {
    let ignore = false;
    if (!inView || hasTypesProp) return;
    const key = String(id);
    if (cache.has(key)) {
      setFetchedTypes(cache.get(key).types);
      return;
    }
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (ignore) return;
        const t = (data.types || [])
          .sort((a, b) => a.slot - b.slot)
          .map((x) => x.type.name);
        cache.set(key, { types: t });
        setFetchedTypes(t);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [id, url, inView, cache, hasTypesProp]);

  const dexNo = dexNumber && dexNumber !== "-" ? String(dexNumber).replace(/^#/, "No.") : "No.—";
  const displayName = formatDisplayName(displayNameOverride || name);

  return (
    <li className="mon-cell">
      <a
        ref={cardRef}
        href={buildPokemonPath(name)}
        className={`mon${selected ? " is-selected" : ""}`}
        aria-current={selected ? "page" : undefined}
        data-id={id}
        onClick={(event) => {
          if (!isPlainLeftClick(event)) return;
          event.preventDefault();
          onSelect?.(id, name, url);
        }}
      >
        <Cursor className="mon__cursor" />
        <span className="mon__no">{dexNo}</span>
        <span className="mon__sprite" aria-hidden="true">
          {inView ? (
            <SpriteImage
              className="mon__img"
              id={id}
              alt=""
              width={96}
              height={96}
              loading={eagerLoad ? "eager" : "lazy"}
              fetchPriority={eagerLoad ? "high" : undefined}
              formName={name}
              speciesId={baseSpeciesId}
              pokemonUrl={url}
              dexNumber={dexNumber}
              shiny={shiny}
              variant={spriteVariant}
              gameSpritePath={gameSpritePath}
            />
          ) : null}
        </span>
        <span className="mon__name">{displayName}</span>
        <span className="mon__types">
          {types.length === 0 ? (
            <span className="tag skeleton mon__tag-skeleton" />
          ) : (
            types.map((t) => (
              <span key={t} className={`tag t-${t}`}>
                {t}
              </span>
            ))
          )}
        </span>
        {exclusive || specialTags.length > 0 ? (
          <span className="mon__stamps">
            {exclusive ? (
              <span className="stamp stamp--red mon__excl" title={`Only in Pokémon ${exclusive.label}`}>
                {exclusive.logoUrl ? <img src={exclusive.logoUrl} alt="" width="12" height="12" /> : null}
                <span className="sr-only">Only in </span>
                {exclusive.short}
              </span>
            ) : null}
            {specialTags.map((tag) => (
              <span
                key={tag.key}
                className={`stamp${tag.tag === "Legendary" || tag.tag === "Mythical" ? " stamp--gold" : ""}`}
              >
                <abbr title={tag.tag}>{tag.short}</abbr>
              </span>
            ))}
          </span>
        ) : null}
      </a>
    </li>
  );
}

export default React.memo(PokemonCard);
