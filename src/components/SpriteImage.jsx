import React, { useEffect, useMemo, useState } from "react";

const SPRITE_PLACEHOLDER =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'><rect width='96' height='96' rx='12' fill='%23202631'/><text x='50%' y='52%' text-anchor='middle' dominant-baseline='middle' font-family='Arial' font-size='12' fill='%23cbd5f5'>No Sprite</text></svg>";

const buildSpriteSources = (id) => {
  const clean = String(id ?? "").trim();
  const sources = [];
  if (clean) {
    // Use higher resolution Showdown sprites for better pixel art quality
    sources.push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${clean}.png`);
    sources.push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${clean}.png`);
  }
  sources.push(SPRITE_PLACEHOLDER);
  return sources;
};

export default function SpriteImage({ id, alt, onError, ...rest }) {
  const sources = useMemo(() => buildSpriteSources(id), [id]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [id]);

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








