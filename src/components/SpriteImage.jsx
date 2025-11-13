import React, { useEffect, useMemo, useRef, useState } from "react";

import { getBasePath } from "../utils/url.js";

const SPRITE_PLACEHOLDER =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'><rect width='96' height='96' rx='12' fill='%23202631'/><text x='50%' y='52%' text-anchor='middle' dominant-baseline='middle' font-family='Arial' font-size='12' fill='%23cbd5f5'>No Sprite</text></svg>";

export const buildSpriteSources = (id, variant, options = {}) => {
  const { formName, speciesId, pokemonUrl, dexNumber, shiny = false, gameSpritePath = null } = options;
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
  const basePath = getBasePath();
  const local = (p) => `${basePath}${p.startsWith("/") ? p.slice(1) : p}`;
  const preferShowdownAnimated = variant === "animated" || variant === "showdown";
  const preferHome = variant === "home";

  if (clean) {
    // If variant is "home", prioritize home sprites from /sprites/pokemon/other/home/
    if (preferHome) {
      // Local home sprites first
      if (shiny) {
        push(local(`/sprites/pokemon/other/home/shiny/${clean}.png`));
      }
      push(local(`/sprites/pokemon/other/home/${clean}.png`));
      // Remote home sprite fallbacks
      if (shiny) {
        push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/shiny/${clean}.png`);
      }
      push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${clean}.png`);
    }

    // If gameSpritePath is provided, prioritize game-specific sprites
    if (gameSpritePath) {
      const baseUrl = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/";
      // Try shiny version first if shiny is enabled
      if (shiny) {
        push(`${baseUrl}${gameSpritePath}shiny/${clean}.png`);
      }
      // Always try regular version
      push(`${baseUrl}${gameSpritePath}${clean}.png`);
    }

    if (preferShowdownAnimated) {
      if (shiny) {
        push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/shiny/${clean}.gif`);
      }
      push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${clean}.gif`);
    }

    // Prefer locally hosted sprites first (skip if using home variant)
    if (!preferHome) {
      if (shiny) {
        push(local(`/sprites/pokemon/shiny/${clean}.png`));
      }
      push(local(`/sprites/pokemon/${clean}.png`));
      push(local(`/sprites/pokemon/other/showdown/${clean}.png`));
    }

    // Remote fallbacks (skip if using home variant)
    if (!preferHome) {
      if (shiny) {
        push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${clean}.png`);
      }
      if (preferShowdownAnimated) {
        if (shiny) {
          push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/shiny/${clean}.png`);
        }
        push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${clean}.png`);
      }
      push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${clean}.png`);
    }
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

  // Add unknown pokemon sprite as fallback before placeholder
  // If variant is "home", try home sprites first
  if (preferHome) {
    if (shiny) {
      push(local(`/sprites/pokemon/other/home/shiny/0.png`));
      push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/shiny/0.png`);
    }
    push(local(`/sprites/pokemon/other/home/0.png`));
    push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/0.png`);
  }
  // Try shiny unknown sprite first if shiny is enabled (skip if using home variant)
  if (!preferHome && shiny) {
    push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/0.png`);
  }
  // Try animated/showdown unknown sprite if variant prefers showdown assets
  if (preferShowdownAnimated) {
    if (shiny) {
      push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/shiny/0.gif`);
      push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/shiny/0.png`);
    }
    push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/0.gif`);
    push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/0.png`);
  }
  // Regular unknown sprite fallback (skip if using home variant)
  if (!preferHome) {
    push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png`);
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
  gameSpritePath = null,
  onLoad,
  ...rest
}) {
  const sources = useMemo(
    () => buildSpriteSources(id, variant, { formName, speciesId, pokemonUrl, dexNumber, shiny, gameSpritePath }),
    [id, variant, formName, speciesId, pokemonUrl, dexNumber, shiny, gameSpritePath]
  );
  const [index, setIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const imgRef = useRef(null);

  const src = sources[Math.min(index, sources.length - 1)];

  useEffect(() => {
    setIndex(0);
    setIsLoading(true);
  }, [id, shiny]);

  // Check if image is already loaded (cached) after src changes
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalHeight !== 0) {
      setIsLoading(false);
    }
  }, [src]);

  const handleError = (event) => {
    setIndex((prev) => {
      const next = prev + 1;
      if (next < sources.length) {
        setIsLoading(true);
        return next;
      }
      setIsLoading(false);
      if (onError) {
        onError(event);
      }
      return prev;
    });
  };

  const handleLoad = (event) => {
    setIsLoading(false);
    if (onLoad) {
      onLoad(event);
    }
  };
  // Add lazy loading by default if not explicitly set
  const loading = rest.loading !== undefined ? rest.loading : "lazy";
  
  // Fade in the image when it loads - but don't hide if it's already loaded
  const imgStyle = {
    ...rest.style,
    opacity: isLoading && src !== SPRITE_PLACEHOLDER ? 0 : 1,
    transition: isLoading && src !== SPRITE_PLACEHOLDER ? 'opacity 0.2s ease-in' : 'none',
  };
  
  return (
    <img
      {...rest}
      ref={imgRef}
      alt={alt}
      src={src}
      onError={handleError}
      onLoad={handleLoad}
      loading={loading}
      style={imgStyle}
    />
  );
}








