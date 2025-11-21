import React, { useMemo, useState, useEffect } from "react";

const CATEGORIES = [
  { key: "pokemon", label: "Pokemon", hash: "", isPath: true },
  { key: "moves", label: "Moves", hash: "/moves", isPath: true },
  { key: "abilities", label: "Abilities", hash: "/abilities", isPath: true },
  { key: "ev", label: "EV Training", hash: "/ev-training", isPath: true },
  { key: "whosthat", label: "Who's That?", hash: "/whosthat", isPath: true },
  { key: "sav", label: "Save Reader", hash: "/save", isPath: true },
];

function getActiveCategory() {
  const pathname = window.location.pathname.toLowerCase();
  const hash = String(window.location.hash || "").toLowerCase();
  const basePath = (import.meta.env?.BASE_URL || "/").replace(/\/+$|^$/, "/");
  
  // Check path-based routes
  const normalizedPath = pathname.replace(basePath === "/" ? "" : basePath, "").replace(/^\//, "");
  if (normalizedPath === "save" || pathname.endsWith("/save")) return "sav";
  if (normalizedPath === "moves" || pathname.endsWith("/moves")) return "moves";
  if (normalizedPath === "abilities" || pathname.endsWith("/abilities")) return "abilities";
  if (normalizedPath === "ev-training" || normalizedPath === "ev" || pathname.endsWith("/ev-training") || pathname.endsWith("/ev")) return "ev";
  if (normalizedPath === "whosthat" || pathname.endsWith("/whosthat")) return "whosthat";
  if (normalizedPath === "items" || pathname.endsWith("/items")) return "items";
  if (normalizedPath === "home" || pathname.endsWith("/home")) return "pokemon";
  
  // Legacy hash-based routes (for backward compatibility)
  if (hash.startsWith("#/items")) return "items";
  if (hash.startsWith("#/moves")) return "moves";
  if (hash.startsWith("#/abilities")) return "abilities";
  if (hash.startsWith("#/ev-training") || hash.startsWith("#/ev")) return "ev";
  if (hash.startsWith("#/whosthat")) return "whosthat";
  if (hash.startsWith("#/sav")) return "sav";
  
  return "pokemon";
}

export default function CategoryToggle() {
  const [, forceUpdate] = useState(0);
  const active = useMemo(() => getActiveCategory(), [forceUpdate]);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 768;
    }
    return false;
  });

  useEffect(() => {
    const onChange = () => {
      forceUpdate(v => v + 1);
    };
    window.addEventListener('hashchange', onChange);
    window.addEventListener('popstate', onChange);
    window.addEventListener('locationchange', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
      window.removeEventListener('popstate', onChange);
      window.removeEventListener('locationchange', onChange);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNavigate = (target) => {
    const targetHash = target.hash;
    const u = new URL(window.location.href);
    // Keep only the relevant param for the target section
    const keepMap = { pokemon: "p", items: "i", moves: "m", abilities: "a" };
    const keep = keepMap[target.key] || null;
    ["p", "i", "m", "a"].forEach((k) => {
      if (k !== keep) u.searchParams.delete(k);
    });
    
    // Handle path-based routing
    if (target.isPath) {
      const basePath = (import.meta.env?.BASE_URL || "/").replace(/\/+$|^$/, "/");
      if (targetHash === "") {
        // Home/pokemon page
        u.pathname = basePath === "/" ? "/" : basePath;
      } else if (targetHash.startsWith("/")) {
        const newPath = basePath === "/" ? targetHash : `${basePath}${targetHash.replace(/^\//, "")}`;
        u.pathname = newPath;
      }
      u.hash = "";
      window.history.pushState({}, "", u);
      // Dispatch custom event to trigger router re-render
      window.dispatchEvent(new Event('locationchange'));
      return;
    }
    
    // Legacy hash-based routing (fallback)
    window.history.replaceState({}, "", u);
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
  };

  return (
    <div className={`category-toggle-row${isMobile ? " is-mobile" : ""}`} role="tablist" aria-label="Pokedex Sections">
      {CATEGORIES.map((cat) => {
        const isOn = active === cat.key;
        return (
          <button
            key={cat.key}
            type="button"
            role="tab"
            aria-selected={isOn}
            aria-pressed={isOn}
            className={`filter-chip${isOn ? " is-on" : ""}`}
            data-category={cat.key}
            onClick={() => handleNavigate(cat)}
          >
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}

