import React, { useEffect, useMemo, useState } from "react";

import { getBasePath } from "../utils/url.js";

const SPRITE_PLACEHOLDER =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'><rect width='96' height='96' rx='12' fill='%23202631'/><text x='50%' y='52%' text-anchor='middle' dominant-baseline='middle' font-family='Arial' font-size='12' fill='%23cbd5f5'>No Sprite</text></svg>";

const buildSpriteSources = (id, variant, options = {}) => {
  const { formName, speciesId, pokemonUrl, dexNumber, shiny = false } = options;
  const clean = String(id ?? "").trim();
  const lowerName = String(formName || "").toLowerCase();
  const sources = [];
  const seen = new Set();
  const push = (value) => {
    const str = typeof value === "string" ? value.trim() : "";
    if (!str) return;
    if (seen.has(str)) return;
    seen.add(str);
    sources.push(str);
  };

  if (clean) {
    if (shiny && variant === "home") {
      push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/shiny/${clean}.png`);
    }
    if (variant === "home") {
      push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${clean}.png`);
    }
    if (shiny) {
      push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${clean}.png`);
    }
    push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${clean}.png`);
    push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${clean}.png`);
  }

  const baseSpeciesId = (() => {
    if (Number.isFinite(speciesId)) return speciesId;
    const matchDex = typeof dexNumber === "string" ? dexNumber.match(/\d+/) : null;
    if (matchDex) {
      const value = Number(matchDex[0]);
      if (Number.isFinite(value) && value > 0) return value;
    }
    if (typeof pokemonUrl === "string" && pokemonUrl) {
      const parts = pokemonUrl.split("/").filter(Boolean);
      const maybe = Number(parts[parts.length - 1]);
      if (Number.isFinite(maybe) && maybe > 0 && maybe < 10000) {
        return maybe;
      }
    }
    const numericId = Number(clean);
    if (Number.isFinite(numericId) && numericId > 0 && numericId < 10000) {
      return numericId;
    }
    return null;
  })();

  if (lowerName.includes("mega")) {
    const padded = baseSpeciesId != null ? String(baseSpeciesId).padStart(4, "0") : null;
    const basePath = getBasePath();
    const buildPath = (suffix) => {
      if (!suffix) return null;
      const cleanSuffix = suffix.startsWith("/") ? suffix.slice(1) : suffix;
      return `${basePath}${cleanSuffix}`;
    };

    const detailTokens = lowerName.split("-").filter(Boolean);
    let variantTokens = detailTokens.length > 1 ? detailTokens.slice(1) : detailTokens.slice();
    if (!variantTokens.includes("mega")) {
      variantTokens = [...variantTokens, "mega"];
    }

    const toTitleToken = (token) => {
      if (!token) return "";
      if (/^\d+$/.test(token)) return token;
      return token.charAt(0).toUpperCase() + token.slice(1);
    };

    const formattedTokens = variantTokens
      .map((token) => token.replace(/[^a-z0-9]/g, ""))
      .filter(Boolean)
      .map(toTitleToken);

    const labels = new Set();
    if (formattedTokens.length) {
      labels.add(formattedTokens.join("."));
      labels.add(formattedTokens[0]);
      labels.add(formattedTokens.join(""));
    }
    labels.add("Mega");

    if (padded) {
      labels.forEach((label) => {
        if (!label) return;
        push(buildPath(`/sprites/${padded}.${label}.png`));
        push(buildPath(`/sprites/${padded}.${label}.1.png`));
        push(buildPath(`/sprites/${padded}.${label}.2.png`));
      });
    }

    const sanitizedDetail = lowerName
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "");
    if (sanitizedDetail) {
      push(buildPath(`/sprites/${sanitizedDetail}.png`));
    }
  }

  push(SPRITE_PLACEHOLDER);
  return sources;
};

export default function SpriteImage({
  id,
  alt,
  onError,
  variant = null,
  formName = null,
  speciesId = null,
  pokemonUrl = null,
  dexNumber = null,
  shiny = false,
  ...rest
}) {
  const sources = useMemo(
    () => buildSpriteSources(id, variant, { formName, speciesId, pokemonUrl, dexNumber, shiny }),
    [id, variant, formName, speciesId, pokemonUrl, dexNumber, shiny]
  );
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [id, shiny]);

  const handleError = (event) => {
    setIndex((prev) => {
      const next = prev + 1;
      if (next < sources.length) {
        return next;
      }
      if (onError) {
        onError(event);
      }
      return prev;
    });
  };

  const src = sources[Math.min(index, sources.length - 1)];
  return <img {...rest} alt={alt} src={src} onError={handleError} />;
}








