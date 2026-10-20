import Sheet from "../components/Sheet.jsx";
import Icon, { Cursor } from "../components/Icon.jsx";
import { GAME_GROUPS, gameLogos, regionLabel } from "./games.js";

export function CartLogos({ game, className = "" }) {
  const logos = gameLogos(game);
  if (logos.length === 0) {
    return (
      <span className={`cart-logos cart-logos--national ${className}`.trim()} aria-hidden="true">
        <Icon name="ball" />
      </span>
    );
  }
  return (
    <span className={`cart-logos ${className}`.trim()} aria-hidden="true">
      {logos.map((src) => (
        <img key={src} src={src} alt="" width="50" height="50" />
      ))}
    </span>
  );
}

const countLabel = (count) => (count ? `${count} Pokémon` : "");

function Option({ game, selected, count, onPick }) {
  const title = game ? game.label : "National Pokédex";
  const sub = game ? [regionLabel(game), countLabel(count)].filter(Boolean).join(" · ") : ["Every game", countLabel(count)].filter(Boolean).join(" · ");
  return (
    <li>
      <button
        type="button"
        className="cart-option"
        aria-pressed={selected}
        onClick={() => onPick(game ? game.key : null)}
      >
        <Cursor className="cart-option__cursor" />
        <CartLogos game={game} />
        <span className="cart-option__text">
          <span className="cart-option__title">{title}</span>
          <span className="cart-option__sub">{sub}</span>
        </span>
      </button>
    </li>
  );
}

// Up/Down moves between games like a menu cursor
const onMenuKeyDown = (event) => {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") return;
  const items = Array.from(event.currentTarget.querySelectorAll(".cart-option"));
  const index = items.indexOf(document.activeElement);
  let next = index;
  if (event.key === "ArrowDown") next = Math.min(items.length - 1, index + 1);
  if (event.key === "ArrowUp") next = Math.max(0, index - 1);
  if (event.key === "Home") next = 0;
  if (event.key === "End") next = items.length - 1;
  event.preventDefault();
  items[next]?.focus();
};

/** Pick the cartridge: the game every number, form, type and location follows. */
export default function GamePicker({ open, onClose, anchorRef, selectedGame, counts, onPick }) {
  const pick = (key) => {
    onPick(key);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} anchorRef={anchorRef} label="Choose your game" width={400} className="cart-sheet">
      <div className="popsheet__head">
        <h2 className="popsheet__title">Choose your game</h2>
        <button type="button" className="btn btn--quiet btn--icon btn--sm" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
      </div>
      <div className="popsheet__body cart-menu" onKeyDown={onMenuKeyDown}>
        <ul className="cart-list">
          <Option game={null} selected={!selectedGame} count={counts?.get("national")} onPick={pick} />
        </ul>
        {GAME_GROUPS.map((group) => (
          <section key={group.gen} className="cart-group" aria-label={group.label}>
            <h3 className="cart-group__label">{group.label}</h3>
            <ul className="cart-list">
              {group.games.map((game) => (
                <Option
                  key={game.key}
                  game={game}
                  selected={selectedGame === game.key}
                  count={counts?.get(game.key)}
                  onPick={pick}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Sheet>
  );
}
