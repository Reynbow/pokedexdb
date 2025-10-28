import React, { useMemo } from "react";

const CATEGORIES = [
  { key: "pokemon", label: "Pokemon", hash: "" },
  { key: "moves", label: "Moves", hash: "#/moves" },
  { key: "abilities", label: "Abilities", hash: "#/abilities" },
];

function getActiveCategory() {
  const hash = String(window.location.hash || "").toLowerCase();
  if (hash.startsWith("#/items")) return "items";
  if (hash.startsWith("#/moves")) return "moves";
  if (hash.startsWith("#/abilities")) return "abilities";
  return "pokemon";
}

export default function CategoryToggle() {
  const active = useMemo(() => getActiveCategory(), []);

  const handleNavigate = (target) => {
    const targetHash = target.hash;
    const u = new URL(window.location.href);
    // Keep only the relevant param for the target section
    const keepMap = { pokemon: "p", items: "i", moves: "m", abilities: "a" };
    const keep = keepMap[target.key] || null;
    ["p", "i", "m", "a"].forEach((k) => {
      if (k !== keep) u.searchParams.delete(k);
    });
    window.history.replaceState({}, "", u);
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
  };

  return (
    <div className="category-toggle-row" role="tablist" aria-label="Pokedex Sections">
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
            onClick={() => handleNavigate(cat)}
          >
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}


