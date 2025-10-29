import React, { memo } from "react";

function GameFilters({
  showFilters,
  showGameFilters,
  selectedDex,
  gameFiltersRef,
  availableGames,
  selectedGame,
  onGameClick,
  resolveLogoUrls,
}) {
  if (!(showFilters && showGameFilters)) return null;
  return (
    <div className="game-filters-row">
      <div className="game-filters-controls">
        <div
          className={`game-filters${selectedDex === "national" ? " game-filters--left" : ""}`}
          ref={gameFiltersRef}
        >
          {availableGames.map((game) => {
            const isOn = game.key === selectedGame;
            const logoUrls = (resolveLogoUrls ? resolveLogoUrls(game) : []) || [];
            return (
              <button
                key={game.key}
                type="button"
                className={`filter-chip game-chip${isOn ? " is-on" : ""}`}
                onClick={() => onGameClick && onGameClick(game.key)}
                aria-pressed={isOn}
                aria-label={game.label}
              >
                {logoUrls.length > 0 && (
                  <span className="game-chip-logos" aria-hidden="true">
                    {logoUrls.map((src) => (
                      <img key={src} src={src} alt="" className="game-chip-logo" />
                    ))}
                  </span>
                )}
                <span className="game-chip-label">{game.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default memo(GameFilters);


