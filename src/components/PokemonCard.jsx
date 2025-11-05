import React, { useEffect, useMemo, useRef, useState } from "react";
import SpriteImage from "./SpriteImage.jsx";
import { SPECIAL_FILTERS, SPECIAL_TAG_META } from "../constants/tags.js";
import { GAME_LOGO_LOOKUP, VERSION_LOGO_FILES, VERSION_COLORS } from "../constants/games.js";
import { getExclusiveVersionForSpecies } from "../constants/exclusives.js";
import { ULTRA_BEASTS, PARADOX_NAMES, BABY_NAMES, LEGENDARY_NAMES, MYTHICAL_NAMES } from "../constants/species.js";

// Local cache fallback to preserve memoization and reduce fetches when detailsCache is not provided
const localDetailsCache = new Map();

function useInView(options) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      options || { root: null, rootMargin: "1000px 0px", threshold: 0.01 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [options]);
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
function hexToRgba(hex, alpha) {
  try {
    const m = String(hex || "").trim().toLowerCase();
    if (!m.startsWith("#")) return hex;
    let r, g, b;
    if (m.length === 4) {
      r = parseInt(m[1] + m[1], 16);
      g = parseInt(m[2] + m[2], 16);
      b = parseInt(m[3] + m[3], 16);
    } else if (m.length === 7) {
      r = parseInt(m.slice(1, 3), 16);
      g = parseInt(m.slice(3, 5), 16);
      b = parseInt(m.slice(5, 7), 16);
    } else {
      return hex;
    }
    const a = Number(alpha);
    const clamped = Number.isFinite(a) ? Math.max(0, Math.min(1, a)) : 1;
    return `rgba(${r}, ${g}, ${b}, ${clamped})`;
  } catch {
    return hex;
  }
}

function getLuminance(hex) {
  try {
    const m = String(hex || "").trim().toLowerCase();
    if (!m.startsWith("#")) return 1;
    let r, g, b;
    if (m.length === 4) {
      r = parseInt(m[1] + m[1], 16);
      g = parseInt(m[2] + m[2], 16);
      b = parseInt(m[3] + m[3], 16);
    } else if (m.length === 7) {
      r = parseInt(m.slice(1, 3), 16);
      g = parseInt(m.slice(3, 5), 16);
      b = parseInt(m.slice(5, 7), 16);
    } else {
      return 1;
    }
    return (r + g + b) / (255 * 3);
  } catch {
    return 1;
  }
}
const formatDisplayName = (rawName) => {
  const stripped = stripMegaGmaxTokens(rawName);
  return toTitleCase(stripped);
};

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

function PokemonCard({ name, id, url, onSelect, selected, dexNumber, detailsCache, shiny = false, selectedGame = null, eagerLoad = false }) {
  const cache = detailsCache || localDetailsCache;
  const [types, setTypes] = useState(cache.get(String(id))?.types || []);
  const [cardRef, inView] = useInView({ root: null, rootMargin: "300px 0px", threshold: 0.01 });
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
        return {
          key: tag,
          tag,
          short: meta.short,
          className: meta.className,
          order: order >= 0 ? order : 99,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return a.tag.localeCompare(b.tag);
      });
  }, [name]);

  const { formAwareName, baseSpeciesName } = useMemo(() => {
    const stripped = stripMegaGmaxTokens(name || "").toLowerCase();
    const formName = stripped; // keep regional forms for form-aware checks
    // Preserve Indeedee gender forms and Paldean Tauros breed forms
    if (/^indeedee-(male|female)$/.test(stripped)) {
      return { formAwareName: stripped, baseSpeciesName: stripped };
    }
    if (/^tauros-paldea-(combat|blaze|aqua)$/.test(stripped)) {
      return { formAwareName: stripped, baseSpeciesName: stripped };
    }
    // Remove common regional/form tokens so exclusives can fall back to base species
    const baseName = formName
      .replace(/-(alola|galar|hisui|paldea|original|totem|starter|male|female|f|m)$/g, "")
      .replace(/-(mega|gmax)$/g, "");
    return { formAwareName: formName, baseSpeciesName: baseName };
  }, [name]);

  const exclusiveBadge = useMemo(() => {
    if (!selectedGame) return null;
    // Try form-aware name first, then fall back to base species name
    const versionKey =
      getExclusiveVersionForSpecies(selectedGame, formAwareName) ||
      getExclusiveVersionForSpecies(selectedGame, baseSpeciesName);
    if (!versionKey) return null;
    const logoFile = VERSION_LOGO_FILES.get(versionKey);
    const logoUrl = logoFile ? GAME_LOGO_LOOKUP.get(logoFile) : null;
    if (!logoUrl) return null;
    const label = toTitleCase(String(versionKey).replace(/-/g, " "));
    const color = VERSION_COLORS.get(versionKey) || null;
    return { logoUrl, label, color, versionKey };
  }, [selectedGame, baseSpeciesName]);

  useEffect(() => {
    let ignore = false;
    if (!inView) return;
    const key = String(id);
    if (cache.has(key)) {
      setTypes(cache.get(key).types);
      return;
    }
    try {
      const cached = localStorage.getItem(`types:${key}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        cache.set(key, { types: parsed });
        setTypes(parsed);
        return;
      }
    } catch {}

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (ignore) return;
        const t = (data.types || [])
          .sort((a, b) => a.slot - b.slot)
          .map((x) => x.type.name);
        cache.set(key, { types: t });
        try {
          localStorage.setItem(`types:${key}`, JSON.stringify(t));
        } catch {}
        setTypes(t);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [id, url, inView, cache]);

  // Removed auto-scrolling on selection to avoid distracting scroll animations.

  // Mouse-driven parallax for the sprite
  const hoverRafIdRef = useRef(0);
  const mousePositionRef = useRef({ x: 0, y: 0 });
  const isHoveringRef = useRef(false);
  const lastBoundsRef = useRef(null);

  useEffect(() => {
    return () => {
      if (hoverRafIdRef.current) {
        cancelAnimationFrame(hoverRafIdRef.current);
        hoverRafIdRef.current = 0;
      }
    };
  }, []);

  const resetParallax = () => {
    const el = cardRef.current;
    if (!el) return;
    el.style.setProperty("--parallax-x", "0px");
    el.style.setProperty("--parallax-y", "0px");
  };

  const scheduleParallaxUpdate = () => {
    if (hoverRafIdRef.current) return;
    hoverRafIdRef.current = requestAnimationFrame(() => {
      hoverRafIdRef.current = 0;
      const el = cardRef.current;
      if (!el || !isHoveringRef.current) return;
      const bounds = lastBoundsRef.current || el.getBoundingClientRect();
      lastBoundsRef.current = bounds;
      const { x, y } = mousePositionRef.current;
      const centerX = bounds.left + bounds.width / 2;
      const centerY = bounds.top + bounds.height / 2;
      const relX = (x - centerX) / (bounds.width / 2);
      const relY = (y - centerY) / (bounds.height / 2);
      const clamp = (v) => Math.max(-1, Math.min(1, v));
      const maxOffset = 4; // px
      const offsetX = (clamp(relX) * maxOffset).toFixed(2);
      const offsetY = (clamp(relY) * maxOffset).toFixed(2);
      el.style.setProperty("--parallax-x", `${offsetX}px`);
      el.style.setProperty("--parallax-y", `${offsetY}px`);
    });
  };

  const handleMouseEnter = () => {
    isHoveringRef.current = true;
    lastBoundsRef.current = cardRef.current?.getBoundingClientRect() || null;
  };

  const handleMouseMove = (e) => {
    if (!isHoveringRef.current) return;
    mousePositionRef.current = { x: e.clientX, y: e.clientY };
    scheduleParallaxUpdate();
  };

  const handleMouseLeave = () => {
    isHoveringRef.current = false;
    resetParallax();
  };

  const dexNo = dexNumber || `#${id}`;

  return (
    <div
      className={`card${selected ? " is-selected" : ""}${exclusiveBadge ? " has-exclusive" : ""}`}
      title={name}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect?.()}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      ref={cardRef}
      aria-current={selected ? "true" : undefined}
      data-id={id}
      data-type={types && types.length > 0 ? types[0] : undefined}
    >
      {exclusiveBadge ? (
        <>
          <div
            className="card-exclusive-glow"
            aria-hidden="true"
            style={exclusiveBadge.color ? (() => {
              const vk = exclusiveBadge.versionKey;
              // For Black / Black 2, use a deep blue glow for visibility
              const baseColor = (vk === "black" || vk === "black-2") ? "#1e3a8a" : exclusiveBadge.color;
              const a1 = 0.42;
              const a2 = 0.22;
              return {
                background: `radial-gradient(circle at 100% 0%, ${hexToRgba(baseColor, a1)} 0%, ${hexToRgba(baseColor, a2)} 26%, ${hexToRgba(baseColor, 0.0)} 56%)`
              };
            })() : undefined}
          />
          <div
            className="card-exclusive"
            title={`Exclusive to ${exclusiveBadge.label}`}
            aria-label={`Exclusive to ${exclusiveBadge.label}`}
          >
            <img src={exclusiveBadge.logoUrl} alt={exclusiveBadge.label} />
          </div>
        </>
      ) : null}
      {specialTags.length > 0 && (
        <div className="card-tags">
          {specialTags.map((tag) => (
            <span key={tag.key} className={`card-tag ${tag.className}`} title={tag.tag} aria-label={tag.tag}>
              {tag.short}
            </span>
          ))}
        </div>
      )}
      <div className="dexno">{dexNo}</div>
      {inView ? (
        <SpriteImage
          className="sprite"
          id={id}
          alt={name}
          width={144}
          height={144}
          loading={eagerLoad ? "eager" : "lazy"}
          fetchpriority={eagerLoad ? "high" : undefined}
          formName={name}
          speciesId={baseSpeciesId}
          pokemonUrl={url}
          dexNumber={dexNumber}
          shiny={shiny}
        />
      ) : (
        <div style={{ width: 144, height: 144 }} />
      )}
      <div className="name">{formatDisplayName(name)}</div>
      <div className="types">
        {types.length === 0 ? (
          <span className="type-chip skeleton" />
        ) : (
          types.map((t) => (
            <span key={t} className={`type-chip type-${t}`}>
              {t}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

export default React.memo(PokemonCard);








