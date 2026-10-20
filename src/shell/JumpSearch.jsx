import { useEffect, useId, useMemo, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import { loadPokemonList } from "../data/staticData.js";
import { formatPokemonName } from "../utils/pokemonNames.js";
import { buildPokemonPath } from "../utils/url.js";
import { navigate } from "../router.js";

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/♀/g, "f")
    .replace(/♂/g, "m")
    .replace(/[^a-z0-9]/g, "");

const MAX_RESULTS = 8;

/** Jump to any Pokémon from anywhere: type a name or number, Enter opens its entry. */
export default function JumpSearch({ autoFocus = false, onDone, className = "" }) {
  const [query, setQuery] = useState("");
  const [list, setList] = useState(null);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const listId = useId();

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Load the index lazily on first interaction (it's usually already cached by the Pokédex)
  const ensureList = () => {
    if (list) return;
    loadPokemonList()
      .then((entries) =>
        setList(
          entries
            .filter((entry) => !String(entry.name).includes("totem"))
            .map((entry) => {
              const label = formatPokemonName(entry.name);
              return {
                name: entry.name,
                label,
                id: entry.id,
                speciesId: entry.speciesId,
                keys: [normalize(entry.name), normalize(label)],
                isForm: entry.id >= 10000,
              };
            })
        )
      )
      .catch(() => setList([]));
  };

  const results = useMemo(() => {
    if (!list) return [];
    const q = normalize(query);
    if (!q) return [];
    const number = /^\d+$/.test(q) ? Number(q) : null;
    const scored = [];
    for (const item of list) {
      let score = -1;
      if (number != null) {
        if (!item.isForm && item.id === number) score = 0;
      } else if (item.keys.some((key) => key === q)) score = 1;
      else if (item.keys.some((key) => key.startsWith(q))) score = 2 + (item.isForm ? 1 : 0);
      else if (item.keys.some((key) => key.includes(q))) score = 4 + (item.isForm ? 1 : 0);
      if (score >= 0) scored.push({ item, score });
    }
    scored.sort((a, b) => a.score - b.score || (a.item.speciesId ?? 0) - (b.item.speciesId ?? 0) || a.item.id - b.item.id);
    return scored.slice(0, MAX_RESULTS).map((s) => s.item);
  }, [list, query]);

  const go = (item) => {
    if (!item) return;
    navigate(buildPokemonPath(item.name));
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
    onDone?.();
  };

  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(results[active] || results[0]);
    } else if (event.key === "Escape") {
      setQuery("");
      setOpen(false);
      inputRef.current?.blur();
      onDone?.();
    }
  };

  const showResults = open && query.trim().length > 0;

  return (
    <div className={`jump ${className}`.trim()}>
      <label className="field jump__field">
        <span className="sr-only">Jump to a Pokémon</span>
        <Icon name="search" />
        <input
          ref={inputRef}
          className="field__input jump__input"
          type="text"
          role="combobox"
          aria-expanded={showResults}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showResults && results[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          spellCheck="false"
          placeholder="Jump to a Pokémon"
          value={query}
          onFocus={() => {
            ensureList();
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onChange={(event) => {
            ensureList();
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        <kbd className="jump__kbd" aria-hidden="true">
          /
        </kbd>
      </label>
      {showResults ? (
        <ul className="jump__results sheet" id={listId} role="listbox">
          {results.length === 0 ? (
            <li className="jump__none">{list ? "No Pokémon by that name or number." : "Loading…"}</li>
          ) : (
            results.map((item, index) => (
              <li
                key={item.name}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                className="jump__option"
                onMouseDown={(event) => {
                  event.preventDefault();
                  go(item);
                }}
                onMouseEnter={() => setActive(index)}
              >
                <span className="dexno">{item.isForm ? "Form" : `No.${String(item.id).padStart(4, "0")}`}</span>
                <span className="jump__name">{item.label}</span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
