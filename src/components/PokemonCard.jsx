import React, { useEffect, useMemo, useRef, useState } from "react";
import SpriteImage from "./SpriteImage.jsx";
import { SPECIAL_FILTERS, SPECIAL_TAG_META } from "../constants/tags.js";
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
      options || { root: null, rootMargin: "200px 0px", threshold: 0.01 }
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

function PokemonCard({ name, id, url, onSelect, selected, dexNumber, detailsCache }) {
  const cache = detailsCache || localDetailsCache;
  const [types, setTypes] = useState(cache.get(String(id))?.types || []);
  const [cardRef, inView] = useInView({ root: null, rootMargin: "300px 0px", threshold: 0.01 });
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

  useEffect(() => {
    const node = cardRef.current;
    if (!selected || !node || !node.isConnected) return;
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [selected]);

  const dexNo = dexNumber || `#${id}`;

  return (
    <div
      className={`card${selected ? " is-selected" : ""}`}
      title={name}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect?.()}
      ref={cardRef}
      aria-current={selected ? "true" : undefined}
    >
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
        <SpriteImage className="sprite" id={id} alt={name} width={144} height={144} loading="lazy" />
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



