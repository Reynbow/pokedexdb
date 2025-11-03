import React, { useEffect } from "react";
import { buildSpriteSources } from "./SpriteImage.jsx";

export default function PrefetchSprites({ items, limit = 24 }) {
  useEffect(() => {
    if (!Array.isArray(items) || items.length === 0) return;
    const toPrefetch = items.slice(0, Math.max(0, Number(limit) || 0));
    const images = [];
    toPrefetch.forEach((item) => {
      try {
        const sources = buildSpriteSources(item.id, null, {
          formName: item.name,
          pokemonUrl: item.url,
          dexNumber: item.dexNumber,
          shiny: Boolean(item.shiny),
        });
        const href = sources.find((s) => typeof s === "string" && s && !s.startsWith("data:"));
        if (!href) return;
        const img = new Image();
        img.decoding = "async";
        img.loading = "eager";
        img.src = href;
        images.push(img);
      } catch {}
    });
    return () => {
      // no cleanup needed; allow browser cache to persist
    };
  }, [items, limit]);
  return null;
}


