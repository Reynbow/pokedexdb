import React, { useMemo } from "react";

const CATEGORIES = [
  { key: "pokemon", label: "Pokemon", hash: "" },
  { key: "items", label: "Items", hash: "#/items" },
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
    // Clear any selected Pokemon param when switching sections
    u.searchParams.delete("p");
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


