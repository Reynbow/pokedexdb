import React, { useEffect, useMemo, useState } from "react";
import {
  findRecommendedNature,
  fetchSmogonSets,
  fetchSmogonAnalyses,
  fetchSmogonStats,
  fetchSmogonTeams,
  normalizeSpeciesName,
} from "./smogonApi";
import "./TestPage.css";

const TEST_SPECIES = "gengar";

const formatNature = (value) => {
  if (!value) return "-";
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(", ") || "-";
  }
  if (typeof value === "string") {
    return value;
  }
  return "-";
};

const flattenMoves = (moves) => {
  if (!Array.isArray(moves)) return [];
  const list = [];
  moves.forEach((entry) => {
    if (!entry) return;
    if (Array.isArray(entry)) {
      list.push(entry.join(" / "));
    } else if (typeof entry === "string") {
      list.push(entry);
    }
  });
  return list;
};

const baseUrl = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");

function TestPage() {
  const [state, setState] = useState({
    loading: true,
    error: null,
    summary: null,
    datasets: null,
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const alias = TEST_SPECIES;
        const natureResult = await findRecommendedNature(alias);
        if (cancelled) return;
        const generation = natureResult.generation || "gen9";
        const speciesKey = natureResult.speciesKey || "Gengar";

        const setsData = await fetchSmogonSets(generation);
        if (cancelled) return;
        const speciesSets = setsData?.[speciesKey] || null;
        const availableFormats = speciesSets ? Object.keys(speciesSets) : [];
        const primaryFormat = natureResult.format || availableFormats[0] || null;

        let analysisEntry = null;
        try {
          const analysisData = await fetchSmogonAnalyses(generation);
          if (cancelled) return;
          const speciesAnalyses = analysisData?.[speciesKey] || null;
          if (speciesAnalyses) {
            if (primaryFormat && speciesAnalyses[primaryFormat]) {
              analysisEntry = speciesAnalyses[primaryFormat];
            } else {
              const firstKey = Object.keys(speciesAnalyses)[0];
              analysisEntry = firstKey ? speciesAnalyses[firstKey] : null;
            }
          }
        } catch (analysisError) {
          if (cancelled) return;
          analysisEntry = { error: analysisError.message || String(analysisError) };
        }

        const statsFormat = primaryFormat ? `${generation}${primaryFormat}` : null;
        let statsEntry = null;
        let statsMeta = null;
        if (statsFormat) {
          try {
            const statsData = await fetchSmogonStats(statsFormat);
            if (cancelled) return;
            statsMeta = {
              battles: statsData?.battles ?? null,
              cutoff: statsData?.cutoff ?? null,
              format: statsFormat,
            };
            const pokemonStats = statsData?.pokemon || {};
            const normalizedTarget = normalizeSpeciesName(speciesKey);
            statsEntry =
              Object.entries(pokemonStats).find(
                ([name]) => normalizeSpeciesName(name) === normalizedTarget
              )?.[1] || null;
          } catch (statsError) {
            if (cancelled) return;
            statsEntry = { error: statsError.message || String(statsError) };
          }
        }

        let teamList = null;
        if (statsFormat) {
          try {
            const teamsData = await fetchSmogonTeams(statsFormat);
            if (cancelled) return;
            if (Array.isArray(teamsData)) {
              const target = normalizeSpeciesName(speciesKey);
              teamList = teamsData
                .filter(
                  (team) =>
                    Array.isArray(team?.data) &&
                    team.data.some((member) => normalizeSpeciesName(member?.species) === target)
                )
                .slice(0, 5);
            } else {
              teamList = [];
            }
          } catch (teamsError) {
            if (cancelled) return;
            teamList = [{ error: teamsError.message || String(teamsError) }];
          }
        }

        if (cancelled) return;
        setState({
          loading: false,
          error: null,
          summary: {
            alias,
            generation,
            speciesKey,
            primaryFormat,
            nature: natureResult.nature || null,
            setName: natureResult.setName || null,
            searched: natureResult.searched,
            statsFormat,
          },
          datasets: {
            sets: speciesSets,
            formats: availableFormats,
            analysis: analysisEntry,
            stats: statsEntry,
            statsMeta,
            teams: teamList,
          },
        });
      } catch (error) {
        if (cancelled) return;
        setState({
          loading: false,
          error: error.message || String(error),
          summary: null,
          datasets: null,
        });
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const content = useMemo(() => {
    if (state.loading) {
      return (
        <div className="test-section">
          <p className="test-status">Loading Smogon data…</p>
        </div>
      );
    }
    if (state.error) {
      return (
        <div className="test-section">
          <p className="test-status error">Unable to load Smogon data: {state.error}</p>
        </div>
      );
    }
    const { summary, datasets } = state;
    const usagePct =
      typeof datasets.stats?.usage?.weighted === "number"
        ? (datasets.stats.usage.weighted * 100).toFixed(2)
        : null;
    const leadPct =
      typeof datasets.stats?.lead?.weighted === "number"
        ? (datasets.stats.lead.weighted * 100).toFixed(2)
        : null;
    const totalBattles =
      typeof datasets.statsMeta?.battles === "number" ? datasets.statsMeta.battles : null;
    const topMoves =
      datasets.stats?.moves && typeof datasets.stats.moves === "object"
        ? Object.entries(datasets.stats.moves).slice(0, 5)
        : [];
    if (!summary || !datasets) return null;
    return (
      <>
        <section className="test-section">
          <h2>Summary</h2>
          <div className="summary-grid">
            <div>
              <span className="label">Species</span>
              <span className="value text-capitalize">{summary.speciesKey}</span>
            </div>
            <div>
              <span className="label">Generation</span>
              <span className="value">{summary.generation}</span>
            </div>
            <div>
              <span className="label">Primary Format</span>
              <span className="value">{summary.primaryFormat || "-"}</span>
            </div>
            <div>
              <span className="label">Recommended Nature</span>
              <span className="value">{summary.nature || "-"}</span>
            </div>
            <div>
              <span className="label">Reference Set</span>
              <span className="value">{summary.setName || "-"}</span>
            </div>
            <div>
              <span className="label">Stats Dataset</span>
              <span className="value">{summary.statsFormat || "-"}</span>
            </div>
          </div>
          {Array.isArray(summary.searched) && summary.searched.length > 0 && (
            <p className="search-trail">
              Generations searched: {summary.searched.join(" → ")}
            </p>
          )}
        </section>

        <section className="test-section">
          <div className="section-heading">
            <h2>Movesets</h2>
            <span className="section-meta">
              Formats available: {datasets.formats.length || 0}
            </span>
          </div>
          {datasets.sets ? (
            <div className="card-grid">
              {Object.entries(datasets.sets).map(([formatKey, formatSets]) => (
                <article key={formatKey} className="data-card">
                  <header className="card-header">
                    <h3>{formatKey}</h3>
                  </header>
                  <div className="card-body">
                    {Object.entries(formatSets).map(([setName, setData]) => (
                      <div key={setName} className="set-block">
                        <div className="set-title">
                          <h4>{setName}</h4>
                          <span className="set-nature">{formatNature(setData?.nature)}</span>
                        </div>
                        {setData?.item && (
                          <p className="set-line">
                            <span className="tag">Item</span>
                            <span>{Array.isArray(setData.item) ? setData.item.join(" / ") : setData.item}</span>
                          </p>
                        )}
                        {setData?.ability && (
                          <p className="set-line">
                            <span className="tag">Ability</span>
                            <span>
                              {Array.isArray(setData.ability)
                                ? setData.ability.join(" / ")
                                : setData.ability}
                            </span>
                          </p>
                        )}
                        {setData?.moves && (
                          <ul className="move-list">
                            {flattenMoves(setData.moves).map((move) => (
                              <li key={move}>{move}</li>
                            ))}
                          </ul>
                        )}
                        {setData?.evs && (
                          <p className="set-line">
                            <span className="tag">EVs</span>
                            <span>
                              {Object.entries(setData.evs)
                                .map(([stat, value]) => `${stat.toUpperCase()}: ${value}`)
                                .join(" / ")}
                            </span>
                          </p>
                        )}
                        {setData?.teratypes && (
                          <p className="set-line">
                            <span className="tag">Tera</span>
                            <span>
                              {Array.isArray(setData.teratypes)
                                ? setData.teratypes.join(" / ")
                                : setData.teratypes}
                            </span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="test-status muted">No moveset data available.</p>
          )}
        </section>

        <section className="test-section">
          <div className="section-heading">
            <h2>Analysis</h2>
            <span className="section-meta">
              {datasets.analysis?.error ? "Unavailable" : summary.primaryFormat || "-"}
            </span>
          </div>
          {datasets.analysis?.error ? (
            <p className="test-status error">{datasets.analysis.error}</p>
          ) : datasets.analysis ? (
            <div className="analysis-content">
              {datasets.analysis.overview && (
                <div
                  className="analysis-block"
                  dangerouslySetInnerHTML={{ __html: datasets.analysis.overview }}
                />
              )}
              {datasets.analysis.sets && (
                <div className="analysis-block">
                  <h3>Sets</h3>
                  {Object.entries(datasets.analysis.sets).map(([setName, setData]) => (
                    <article key={setName} className="analysis-set">
                      <h4>{setName}</h4>
                      {setData?.description && (
                        <div
                          className="analysis-text"
                          dangerouslySetInnerHTML={{ __html: setData.description }}
                        />
                      )}
                      {setData?.usage && (
                        <div
                          className="analysis-text"
                          dangerouslySetInnerHTML={{ __html: setData.usage }}
                        />
                      )}
                    </article>
                  ))}
                </div>
              )}
              {datasets.analysis.comments && (
                <div
                  className="analysis-block"
                  dangerouslySetInnerHTML={{ __html: datasets.analysis.comments }}
                />
              )}
            </div>
          ) : (
            <p className="test-status muted">No analysis data available.</p>
          )}
        </section>

        <section className="test-section">
          <div className="section-heading">
            <h2>Usage Statistics</h2>
            <span className="section-meta">
              {datasets.statsMeta?.format || summary.statsFormat || "-"}
            </span>
          </div>
          {datasets.stats?.error ? (
            <p className="test-status error">{datasets.stats.error}</p>
          ) : datasets.stats ? (
            <div className="stats-grid">
              {totalBattles != null && (
                <div>
                  <span className="label">Total Battles</span>
                  <span className="value">{totalBattles.toLocaleString()}</span>
                </div>
              )}
              {usagePct && (
                <div>
                  <span className="label">Usage Rate</span>
                  <span className="value">{usagePct}%</span>
                </div>
              )}
              {leadPct && (
                <div>
                  <span className="label">Lead Rate</span>
                  <span className="value">{leadPct}%</span>
                </div>
              )}
              {topMoves.length > 0 && (
                <div className="wide">
                  <span className="label">Top Moves</span>
                  <span className="value">
                    {topMoves
                      .map(([move, pct]) =>
                        `${move} (${typeof pct === "number" ? (pct * 100).toFixed(1) : "0.0"}%)`
                      )
                      .join(" · ")}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="test-status muted">No usage statistics available.</p>
          )}
        </section>

        <section className="test-section">
          <div className="section-heading">
            <h2>Sample Teams Featuring Gengar</h2>
            <span className="section-meta">
              {Array.isArray(datasets.teams) ? datasets.teams.length : 0}
            </span>
          </div>
          {Array.isArray(datasets.teams) && datasets.teams.length > 0 ? (
            <div className="card-grid">
              {datasets.teams.map((team, idx) => (
                <article key={team?.name || idx} className="data-card">
                  {team?.error ? (
                    <p className="test-status error">{team.error}</p>
                  ) : (
                    <>
                      <header className="card-header">
                        <h3>{team?.name || `Team ${idx + 1}`}</h3>
                        {team?.author && <span className="card-subtitle">by {team.author}</span>}
                      </header>
                      <div className="card-body">
                        <ul className="team-list">
                          {(team?.data || []).map((member, memberIdx) => (
                            <li key={`${member?.species || "member"}-${memberIdx}`}>
                              <span className="text-capitalize">{member?.species || "Unknown"}</span>
                              {member?.item && <span className="item-chip">{member.item}</span>}
                              {member?.nature && <span className="item-chip">{member.nature}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="test-status muted">No sample teams include Gengar in this format.</p>
          )}
        </section>
      </>
    );
  }, [state]);

  return (
    <div className="test-page">
      <header className="test-header">
        <div className="header-top">
          <span className="test-badge">Experimental</span>
          <a className="back-link" href={`${baseUrl || "/"}`}>
            ← Back to Pokédex
          </a>
        </div>
        <h1>Smogon API Integration</h1>
        <p>
          Live data pulled from <a href="https://pkmn.github.io/smogon/">pkmn.github.io/smogon</a>{" "}
          using <strong className="text-capitalize">{TEST_SPECIES}</strong> as the reference species.
        </p>
      </header>
      {content}
      <footer className="test-footer">
        <p>
          Data provided by the unofficial{" "}
          <a href="https://github.com/pkmn/smogon" target="_blank" rel="noreferrer">
            @pkmn/smogon
          </a>{" "}
          API. Updated automatically every 24 hours.
        </p>
      </footer>
    </div>
  );
}

export default TestPage;
