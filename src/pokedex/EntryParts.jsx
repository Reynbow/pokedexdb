import { createElement, useEffect, useMemo, useState } from "react";
import Icon from "../components/Icon.jsx";
import { getTypeIconUrl } from "../utils/typeIcons.js";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const hideBrokenIcon = (event) => {
  event.currentTarget.style.display = "none";
};

export function TypeTag({ typeName, size = "", icon = true, as = "span", ...rest }) {
  return createElement(
    as,
    { className: `tag${size ? ` tag--${size}` : ""} t-${typeName}`, ...rest },
    icon ? <img src={getTypeIconUrl(typeName)} alt="" loading="lazy" decoding="async" onError={hideBrokenIcon} /> : null,
    typeName
  );
}

/* ---------------------------------------------------------------- Dex text */

/**
 * The Game Boy text box. The entry types itself in (tap to finish), then ▼ blinks.
 * The full text is always in the accessibility tree and reserves the box's height.
 */
export function DexDialog({ versions, selectedVersion, onSelect }) {
  const entry = versions.find((version) => version.name === selectedVersion) || versions[0] || null;
  const text = entry?.text || "";
  const [shown, setShown] = useState(text.length);

  useEffect(() => {
    if (!text || prefersReducedMotion()) {
      setShown(text.length);
      return undefined;
    }
    setShown(0);
    let count = 0;
    const timer = window.setInterval(() => {
      count += 2;
      setShown(Math.min(count, text.length));
      if (count >= text.length) window.clearInterval(timer);
    }, 16);
    return () => window.clearInterval(timer);
  }, [text]);

  if (!entry) return null;
  const done = shown >= text.length;

  return (
    <figure className="dialog entry-dialog" onClick={() => setShown(text.length)}>
      <figcaption className="entry-dialog__head">
        <span className="label">Pokédex entry</span>
        {versions.length > 1 ? (
          <label className="entry-dialog__version" onClick={(event) => event.stopPropagation()}>
            <span className="sr-only">Entry from</span>
            <select className="field__input" value={entry.name} onChange={(event) => onSelect(event.target.value)}>
              {versions.map((version) => (
                <option key={version.name} value={version.name}>
                  {version.displayName}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="entry-dialog__single">{entry.displayName}</span>
        )}
      </figcaption>
      <p className="dialog__text">
        <span className="dialog__ghost" aria-hidden="true">
          {text}
        </span>
        <span className="dialog__typed" aria-hidden="true">
          {text.slice(0, shown)}
        </span>
        <span className="sr-only">{text}</span>
      </p>
      {done ? <Icon name="down" className="dialog__caret" /> : null}
    </figure>
  );
}

/* ---------------------------------------------------------------- Stats */

const STAT_LABELS = {
  hp: "HP",
  attack: "Attack",
  defense: "Defense",
  "special-attack": "Sp. Atk",
  "special-defense": "Sp. Def",
  speed: "Speed",
};

const statTier = (value) => (value >= 80 ? "" : value >= 50 ? " meter--mid" : " meter--low");

export function StatMeters({ stats, evs, evKeyFor, onShowEvs }) {
  if (!Array.isArray(stats) || stats.length === 0) {
    return (
      <ul className="statbox__list" aria-hidden="true">
        {Object.values(STAT_LABELS).map((label) => (
          <li key={label} className="meter">
            <span className="meter__label">{label}</span>
            <span className="meter__value">–</span>
            <span className="meter__track skeleton" />
            <span />
          </li>
        ))}
      </ul>
    );
  }
  const total = stats.reduce((sum, s) => sum + (typeof s?.base_stat === "number" ? s.base_stat : 0), 0);
  const hasEvs = Boolean(evs) && Object.values(evs).some((value) => typeof value === "number" && value > 0);
  return (
    <div className="statbox">
      <ul className="statbox__list">
        {stats.map((s) => {
          const statName = s?.stat?.name || "";
          const value = s.base_stat;
          const evKey = evKeyFor?.[statName];
          const ev = evKey && evs && typeof evs[evKey] === "number" && evs[evKey] > 0 ? evs[evKey] : null;
          const label = STAT_LABELS[statName] || statName;
          return (
            <li key={statName} className={`meter${statTier(value)}`} style={{ "--pct": Math.min(100, (value / 200) * 100) }}>
              <span className="meter__label">{label}</span>
              <span className="meter__value">{value}</span>
              <span className="meter__track" aria-hidden="true">
                <span className="meter__fill" />
              </span>
              <span className="meter__ev">
                {ev ? (
                  <span className="stamp" title={`Competitive sets put ${ev} EVs in ${label}`}>
                    {ev} EV
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="statbox__foot">
        <p className="statbox__total">
          <span className="label">Total</span>
          <span className="num">{total}</span>
        </p>
        {hasEvs && onShowEvs ? (
          <button type="button" className="btn btn--sm" onClick={onShowEvs}>
            EV training plan
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Matchups */

const MATCHUP_ROWS = [
  { side: "weak", mult: 4, label: "×4" },
  { side: "weak", mult: 2, label: "×2" },
  { side: "resist", mult: 0.5, label: "×½" },
  { side: "resist", mult: 0.25, label: "×¼" },
  { side: "resist", mult: 0, label: "×0" },
];

export function Matchups({ weaknesses, resistances, ready, note }) {
  if (!ready) {
    return <p className="entry-muted">Working out matchups…</p>;
  }
  const bySide = { weak: weaknesses, resist: resistances };
  const rowsFor = (side) =>
    MATCHUP_ROWS.filter((row) => row.side === side)
      .map((row) => ({
        ...row,
        types: bySide[side].filter((entry) =>
          row.mult === 4 ? entry.mult >= 4 : row.mult === 2 ? entry.mult > 1 && entry.mult < 4 : row.mult === 0.5 ? entry.mult === 0.5 : row.mult === 0.25 ? entry.mult > 0 && entry.mult <= 0.25 : entry.mult === 0
        ),
      }))
      .filter((row) => row.types.length > 0);

  const renderSide = (side, title, empty) => {
    const rows = rowsFor(side);
    return (
      <section className="matchups__side" aria-label={title}>
        <h3 className="label">{title}</h3>
        {rows.length === 0 ? (
          <p className="entry-muted">{empty}</p>
        ) : (
          <dl className="matchups__rows">
            {rows.map((row) => (
              <div key={row.label} className="matchups__row">
                <dt className={`stamp${row.side === "weak" ? " stamp--red" : ""} matchups__mult`}>
                  <span className="sr-only">{row.mult === 0 ? "No damage" : `${row.mult} times damage`}</span>
                  <span aria-hidden="true">{row.label}</span>
                </dt>
                <dd className="matchups__types">
                  {row.types.map((entry) => (
                    <TypeTag key={entry.type} typeName={entry.type} />
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    );
  };

  return (
    <div className="matchups">
      {renderSide("weak", "Takes more damage from", "No weaknesses.")}
      {renderSide("resist", "Takes less damage from", "No resistances.")}
      {note ? <p className="entry-muted matchups__note">{note}</p> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- Where to find */

// Splits a location description into lines on newlines, semicolons, bullets and top-level commas
const splitDescription = (text) => {
  const value = String(text || "").trim();
  if (!value) return [];
  const segments = [];
  let buffer = "";
  let depth = 0;
  const commit = () => {
    const trimmed = buffer.trim();
    if (trimmed) segments.push(trimmed);
    buffer = "";
  };
  for (const char of value) {
    if (char === "\r") continue;
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === "\n" || char === ";" || char === "•" || (char === "," && depth === 0)) {
      commit();
      continue;
    }
    buffer += char;
  }
  commit();
  return segments;
};

const describeMethod = (method, areaLabel) => {
  const minLevel = method?.minLevel ?? method?.min_level ?? null;
  const maxLevel = method?.maxLevel ?? method?.max_level ?? null;
  const meta = [];
  if (minLevel != null && maxLevel != null) meta.push(minLevel === maxLevel ? `Lv. ${minLevel}` : `Lv. ${minLevel}–${maxLevel}`);
  else if (minLevel != null) meta.push(`Lv. ${minLevel}+`);
  else if (maxLevel != null) meta.push(`Up to Lv. ${maxLevel}`);
  if (method?.chance != null) meta.push(`${method.chance}%`);
  const descriptors = Array.isArray(method?.descriptors) ? method.descriptors : [];
  meta.push(...descriptors);
  const area = areaLabel && areaLabel.trim() && areaLabel.trim().toLowerCase() !== "locations" ? areaLabel.trim() : null;
  const rawLabel = String(method?.label || "").trim();
  const label = [area, rawLabel && !/^location\s+\d+$/i.test(rawLabel) ? rawLabel : null].filter(Boolean).join(" · ");
  return { label, meta, lines: splitDescription(method?.description) };
};

const methodsFor = (game) => {
  const out = [];
  (Array.isArray(game?.areas) ? game.areas : []).forEach((area) => {
    (Array.isArray(area?.methods) ? area.methods : []).forEach((method) => out.push(describeMethod(method || {}, area?.label || "")));
  });
  return out;
};

function GameLogos({ game, logoLookup }) {
  const logos = (game?.logos || []).map((file) => logoLookup.get(file)).filter(Boolean);
  if (logos.length === 0) return null;
  return (
    <span className="cart-logos area-game__logos" aria-hidden="true">
      {logos.map((src) => (
        <img key={src} src={src} alt="" width="50" height="50" />
      ))}
    </span>
  );
}

function MethodList({ methods }) {
  if (methods.length === 0) return <p className="entry-muted">No location details for this game.</p>;
  return (
    <ul className="area-methods">
      {methods.map((method, index) => (
        <li key={index} className="area-method">
          {method.label ? <p className="area-method__label">{method.label}</p> : null}
          {method.meta.length > 0 ? (
            <p className="area-method__meta">
              {method.meta.map((part) => (
                <span key={part} className="stamp">
                  {part}
                </span>
              ))}
            </p>
          ) : null}
          {method.lines.length > 0 ? (
            <ul className="area-method__lines">
              {method.lines.map((line, lineIndex) => (
                <li key={lineIndex}>{line}</li>
              ))}
            </ul>
          ) : null}
          {!method.label && method.meta.length === 0 && method.lines.length === 0 ? (
            <p className="entry-muted">Encounter details unavailable.</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Where to find it: the chosen game first, every other game it appears in below. */
export function AreaPanel({ games, primary, selectedGameLabel, loading, error, logoLookup }) {
  const others = useMemo(
    () => (Array.isArray(games) ? games.filter((game) => game !== primary).slice().reverse() : []),
    [games, primary]
  );
  if (loading) return <p className="entry-muted">Looking up locations…</p>;
  if (error) return <p className="entry-muted">{error}</p>;
  if (!games || games.length === 0) {
    return <p className="entry-muted">No wild encounters on record. It may only come from evolution, trades, events or gifts.</p>;
  }
  return (
    <div className="area">
      {primary ? (
        <section className="area-game area-game--primary" aria-label={`In ${primary.label}`}>
          <h3 className="area-game__head">
            <GameLogos game={primary} logoLookup={logoLookup} />
            <span>{primary.label}</span>
          </h3>
          <MethodList methods={methodsFor(primary)} />
        </section>
      ) : selectedGameLabel ? (
        <p className="area-missing">
          <span className="stamp stamp--red">Not wild</span> No wild encounters in {selectedGameLabel}. Check evolution, trades or the games below.
        </p>
      ) : null}
      {others.length > 0 ? (
        <section className="area-others" aria-label="Other games">
          <h3 className="label">{primary || selectedGameLabel ? "Other games" : "Games"}</h3>
          {others.map((game, index) => {
            const methods = methodsFor(game);
            return (
              <details key={game.version || game.label || index} className="area-game">
                <summary className="area-game__head">
                  <GameLogos game={game} logoLookup={logoLookup} />
                  <span>{game.label}</span>
                  <span className="area-game__count num">{methods.length}</span>
                  <Icon name="down" className="area-game__chevron" />
                </summary>
                <MethodList methods={methods} />
              </details>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- Moves */

const CATEGORY_LABEL = { physical: "Physical", special: "Special", status: "Status" };

function MoveRows({ moves, kind, moveDetailsMap, stabTypes }) {
  return (
    <table className="moves">
      <thead>
        <tr>
          <th scope="col" className="moves__lv">
            {kind === "levelUp" ? "Lv" : kind === "hm" ? "HM" : "TM"}
          </th>
          <th scope="col">Move</th>
          <th scope="col">Type</th>
          <th scope="col" className="moves__cat">
            Cat.
          </th>
          <th scope="col" className="moves__num">
            Pwr
          </th>
          <th scope="col" className="moves__num">
            Acc
          </th>
          <th scope="col" className="moves__num moves__pp">
            PP
          </th>
        </tr>
      </thead>
      <tbody>
        {moves.map((move) => {
          const details = moveDetailsMap.get(move.name);
          const type = details?.type || null;
          const stab = type && stabTypes.includes(type) && details?.damage_class !== "status";
          return (
            <tr key={move.name}>
              <td className="moves__lv num">{kind === "levelUp" ? move.levelLabel || "–" : ""}</td>
              <td className="moves__name">
                {move.label}
                {stab ? (
                  <abbr className="stamp moves__stab" title="Same-type attack bonus: 1.5× damage">
                    STAB
                  </abbr>
                ) : null}
              </td>
              <td>{type ? <TypeTag typeName={type} icon={false} /> : "–"}</td>
              <td className="moves__cat">
                {details?.damage_class ? (
                  <img
                    src={`/move-categories/${details.damage_class}.png`}
                    alt={CATEGORY_LABEL[details.damage_class] || details.damage_class}
                    title={CATEGORY_LABEL[details.damage_class] || details.damage_class}
                    width="25"
                    height="20"
                    onError={hideBrokenIcon}
                  />
                ) : (
                  "–"
                )}
              </td>
              <td className="moves__num num">{details?.power ?? "–"}</td>
              <td className="moves__num num">{details?.accuracy != null ? `${details.accuracy}%` : "–"}</td>
              <td className="moves__num moves__pp num">{details?.pp ?? "–"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function MovesPanel({ learnset, meta, moveDetailsMap, stabTypes, recommended, recommendedLabel }) {
  const groups = [
    { key: "levelUp", title: "Level up", moves: learnset.levelUp || [] },
    { key: "tm", title: "TM", moves: learnset.tm || [] },
    { key: "hm", title: "HM", moves: learnset.hm || [] },
  ].filter((group) => group.moves.length > 0);

  return (
    <div className="moves-panel">
      {meta.versionGroupLabel ? (
        <p className="entry-muted">
          Moves in {meta.versionGroupLabel}
          {meta.hasMixedSources ? ", plus moves from other games where this one has no data" : ""}.
        </p>
      ) : null}
      {Array.isArray(recommended) && recommended.length > 0 ? (
        <section className="moves-set" aria-label="Competitive set">
          <h3 className="label">{recommendedLabel || "Competitive set"}</h3>
          <ul className="moves-set__list">
            {recommended.slice(0, 4).map((move) => (
              <li key={move.name} className="moves-set__move">
                <span className="moves-set__name">{move.label}</span>
                {move.type ? <TypeTag typeName={move.type} icon={false} /> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {groups.length === 0 ? (
        <p className="entry-muted">No move data for this game.</p>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="moves-group" aria-label={`${group.title} moves`}>
            <h3 className="moves-group__head">
              {group.title}
              <span className="num">{group.moves.length}</span>
            </h3>
            <div className="moves-scroll">
              <MoveRows moves={group.moves} kind={group.key} moveDetailsMap={moveDetailsMap} stabTypes={stabTypes} />
            </div>
          </section>
        ))
      )}
    </div>
  );
}
