import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import CategoryToggle from "./CategoryToggle.jsx";
import GameFilters from "./sections/GameFilters.jsx";
import { NATIONAL_GAME_OPTIONS } from "./constants/games.js";
import { GAME_LOGO_LOOKUP } from "./constants/games.js";
import SpriteImage from "./components/SpriteImage.jsx";

// Simple name -> id cache for sprite lookup
const NAME_TO_ID_CACHE = new Map();

function usePokemonIdByName(name) {
    const lower = String(name || "").toLowerCase().trim();
    const [id, setId] = useState(() => {
        try {
            if (!lower) return null;
            const cached = localStorage.getItem(`pokeIdByName:${lower}`);
            if (cached) return Number(cached);
        } catch {}
        if (NAME_TO_ID_CACHE.has(lower)) return NAME_TO_ID_CACHE.get(lower);
        return null;
    });
    useEffect(() => {
        let ignore = false;
        if (!lower || Number.isFinite(id)) return;
        const cachedMap = NAME_TO_ID_CACHE.get(lower);
        if (Number.isFinite(cachedMap)) {
            setId(cachedMap);
            return;
        }
        const cachedLs = (() => {
            try {
                const v = localStorage.getItem(`pokeIdByName:${lower}`);
                return v != null ? Number(v) : null;
            } catch {
                return null;
            }
        })();
        if (Number.isFinite(cachedLs)) {
            NAME_TO_ID_CACHE.set(lower, cachedLs);
            setId(cachedLs);
            return;
        }
        fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(lower)}`)
            .then((r) => r.json())
            .then((data) => {
                if (ignore) return;
                const nextId = Number(data?.id);
                if (Number.isFinite(nextId)) {
                    NAME_TO_ID_CACHE.set(lower, nextId);
                    try {
                        localStorage.setItem(`pokeIdByName:${lower}`, String(nextId));
                    } catch {}
                    setId(nextId);
                }
            })
            .catch(() => {});
        return () => {
            ignore = true;
        };
    }, [lower, id]);
    return id;
}

function NameSprite({ name, size = 56 }) {
    const id = usePokemonIdByName(name);
    if (!Number.isFinite(id)) {
        return (
            <div style={{ width: size, height: size, borderRadius: 8, background: "rgba(255,255,255,0.06)" }} aria-label={name} />
        );
    }
    return (
        <SpriteImage
            id={id}
            alt={name}
            width={size}
            height={size}
            className="ev-target-sprite"
        />
    );
}

function parseSimpleEvNumber(evText) {
    const raw = String(evText || "").toLowerCase();
    // ignore ranges like "+1–2" or "+1-2"
    if (/[+]\d+\s*[–-]\s*\d+/.test(raw)) return null;
    const m = raw.match(/[+]\s*(\d+)/);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
}

function renderGoToTargets(items) {
    if (!Array.isArray(items) || items.length === 0) return null;
    // Group by stat label
    const groups = new Map();
    items.forEach((it) => {
        const key = String(it.stat || "").trim();
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(it);
    });

    const renderTopRight = (locations, keyPrefix) => {
        if (!locations || locations.length === 0) return null;
        const lines = locations
            .map((s) => String(s || "").trim())
            .filter(Boolean);
        if (lines.length === 0) return null;
        return (
            <div className="ev-topline-right">
                {lines.map((line, i) => (
                    <div key={`${keyPrefix}-loc-${i}`} className="ev-location-line">{line}</div>
                ))}
            </div>
        );
    };

    const cards = [];
    let groupIndex = 0;
    for (const [statLabel, list] of groups.entries()) {
        // Determine distinct simple EV values in this stat
        const evNums = Array.from(
            new Set(
                list
                    .map((it) => parseSimpleEvNumber(it.ev))
                    .filter((v) => v != null)
            )
        ).sort((a, b) => a - b);

        if (evNums.length === 2) {
            const [low, high] = evNums;
            const leftItems = list.filter((it) => parseSimpleEvNumber(it.ev) === low);
            const rightItems = list.filter((it) => parseSimpleEvNumber(it.ev) === high);
            const leftSpecies = leftItems.flatMap((it) => Array.isArray(it.species) ? it.species : []).filter(Boolean);
            const rightSpecies = rightItems.flatMap((it) => Array.isArray(it.species) ? it.species : []).filter(Boolean);
            const leftLocs = Array.from(new Set(leftItems.map((it) => it.location).filter(Boolean))).map((loc) => String(loc).split(" / ").map((s) => s.trim()).filter(Boolean).join(" / ")).filter(Boolean);
            const rightLocs = Array.from(new Set(rightItems.map((it) => it.location).filter(Boolean))).map((loc) => String(loc).split(" / ").map((s) => s.trim()).filter(Boolean).join(" / ")).filter(Boolean);
            cards.push(
                <div key={`g-${groupIndex++}-${statLabel}`} className="ev-target" role="listitem">
                    <div className="ev-topline">
                        <span className="ev-badge">{`+${low} ${statLabel}`}</span>
                        <span className="ev-badge">{`+${high} ${statLabel}`}</span>
                    </div>
                    {renderTopRight([
                        leftLocs.join(" / "),
                        rightLocs.join(" / "),
                    ].filter(Boolean), `g-${groupIndex}`)}
                    <div className="ev-split">
                        <div className="ev-split-col">
                            {leftSpecies.map((name) => (
                                <div key={`L-${name}`} className="ev-target-sprite-wrap" title={name} aria-label={name}>
                                    <NameSprite name={name} />
                                    <div className="ev-target-species">{name.charAt(0).toUpperCase() + name.slice(1)}</div>
                                </div>
                            ))}
                        </div>
                        <div className="ev-split-col">
                            {rightSpecies.map((name) => (
                                <div key={`R-${name}`} className="ev-target-sprite-wrap" title={name} aria-label={name}>
                                    <NameSprite name={name} />
                                    <div className="ev-target-species">{name.charAt(0).toUpperCase() + name.slice(1)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
            continue;
        }

        // Fallback: render each entry as its own card
        list.forEach((it, idx) => {
            const locLines = Array.isArray(it.location) ? it.location : String(it.location || "").split(" / ").map((s) => s.trim()).filter(Boolean);
            cards.push(
                <div key={`g-${groupIndex}-${statLabel}-${idx}`} className="ev-target" role="listitem">
                    <div className="ev-topline">
                        <span className="ev-badge">{String(it.ev || "").replace(/\s*each\b/gi, "")}</span>
                        {renderTopRight(locLines, `g-${groupIndex}-${idx}`)}
                    </div>
                    <div className="ev-target-sprites">
                        {(it.species || []).map((name) => (
                            <div key={name} className="ev-target-sprite-wrap" title={name} aria-label={name}>
                                <NameSprite name={name} />
                                <div className="ev-target-species">{name.charAt(0).toUpperCase() + name.slice(1)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        });
        groupIndex++;
    }

    return (
        <div className="ev-targets-grid" role="list">
            {cards}
        </div>
    );
}

export default function EvTrainingPage() {
	const [selectedGame, setSelectedGame] = useState(null);

	const availableGames = useMemo(() => NATIONAL_GAME_OPTIONS, []);
	const selectedDex = "national";
	const showFilters = true;
	const showGameFilters = availableGames.length > 0;

	// Sort games newest → oldest (left to right)
	const nationalOrderIndex = useMemo(() => new Map(availableGames.map((g, idx) => [g.key, idx])), [availableGames]);
	const sortedAvailableGames = useMemo(() => {
		return availableGames.slice().sort((a, b) => {
			const ia = nationalOrderIndex.get(a?.key);
			const ib = nationalOrderIndex.get(b?.key);
			if (ia == null && ib == null) return 0;
			if (ia == null) return 1;
			if (ib == null) return -1;
			return ib - ia; // newest first
		});
	}, [availableGames, nationalOrderIndex]);

	const onGameClick = useCallback((gameKey) => {
		setSelectedGame((prev) => (prev === gameKey ? null : gameKey));
	}, []);

	const resolveLogoUrls = useCallback((game) => {
		const logos = game?.logos || [];
		return logos.map((f) => GAME_LOGO_LOOKUP.get(f)).filter(Boolean);
	}, []);

	const gameLabelLookup = useMemo(() => {
		const map = new Map();
		for (const g of availableGames) {
			map.set(g.key, g.label);
		}
		return map;
	}, [availableGames]);

	const renderGuideFor = (gameKey) => {
		if (!gameKey) return null;
		// Group games by mechanics differences
		const gen1 = ["red-blue-yellow"];
		const gen2 = ["gold-silver-crystal"];
		const gen3 = ["ruby-sapphire-emerald", "firered-leafgreen"];
		const gen4 = ["diamond-pearl", "platinum", "heartgold-soulsilver"];
		const gen5 = ["black-white", "black-2-white-2"];
		const gen6 = ["x-y", "omega-ruby-alpha-sapphire"];
		const gen7_standard = ["sun-moon", "ultra-sun-ultra-moon"];
		const lgpe = ["lets-go"]; // Awakening Values
		const gen8_standard = ["sword-shield", "brilliant-diamond-shining-pearl"];
		const pla = ["legends-arceus"]; // Effort Levels
		const gen9 = ["scarlet-violet", "legends-za"]; // ZA TBD

		const inList = (list) => list.includes(gameKey);

		if (inList(gen1)) {
			return (
				<div className="matchup-grid">
					<div className="matchup-box">
						<div className="matchup-title">Generation I (RBY): Stat Experience</div>
						<ul className="game-modal-method-description">
							<li>No modern EVs. Uses Stat Experience per stat (up to 65,535 each).</li>
							<li>Stat EXP is earned based on foes' base stats, no 510 total cap.</li>
							<li>Vitamins raise Stat EXP (capped by per-stat max), no EV-reducing berries.</li>
							<li>Changes apply on level up; box deposit/withdraw also recalculates.</li>
						</ul>
					</div>
					<div className="matchup-box">
						<div className="matchup-title">EV Items and where to buy</div>
						<ul className="game-modal-method-description">
							<li>Vitamins (HP Up, Protein, Iron, Calcium, Carbos): Celadon Department Store (5F), cash.</li>
							<li>Power Items/Macho Brace/Feathers/Berries: Not available in Gen I.</li>
						</ul>
					</div>
				</div>
			);
		}
		if (inList(gen2)) {
			return (
				<div className="matchup-grid">
					<div className="matchup-box">
						<div className="matchup-title">Generation II (GSC): Stat Experience + Pokérus</div>
						<ul className="game-modal-method-description">
							<li>Still uses per-stat Stat EXP (no 510 cap).</li>
							<li>Pokérus introduced, doubling Stat EXP gains while active.</li>
							<li>Vitamins raise Stat EXP; EV-reducing berries do not exist yet.</li>
						</ul>
					</div>
					<div className="matchup-box">
						<div className="matchup-title">EV Items and where to buy</div>
						<ul className="game-modal-method-description">
							<li>Vitamins (HP Up, Protein, Iron, Calcium, Zinc, Carbos): Goldenrod Department Store (Johto) and Celadon Department Store (Kanto), cash.</li>
							<li>Power Items/Macho Brace/Feathers: Not available for purchase in Gen II.</li>
						</ul>
					</div>
				</div>
			);
		}
		if (inList(gen3)) {
			return (
				<div className="matchup-grid">
					{gameKey === "ruby-sapphire-emerald" ? (
						<>
							<div className="matchup-box">
								<div className="matchup-title">Ruby, Sapphire & Emerald: Quick Setup</div>
								<ul className="game-modal-method-description">
									<li>Modern 510 EV cap with 252 per stat; vitamins stop boosting once a stat hits 100 EVs.</li>
									<li>Grab the Macho Brace from the Winstrate family and combine with Pokérus for doubled gains.</li>
									<li>Power Items do not exist yet, so track knockouts manually.</li>
								</ul>
							</div>
							<div className="matchup-box">
								<div className="matchup-title">Go-To Targets</div>
							{renderGoToTargets([
								{ stat: "HP", species: ["whismur"], ev: "+1 HP each", location: "Rusturf Tunnel" },
								{ stat: "Attack", species: ["shuppet"], ev: "+1 Attack each", location: "Mt. Pyre" },
								{ stat: "Defense", species: ["geodude", "aron"], ev: "+1 Defense each", location: "Granite Cave" },
								{ stat: "Sp. Atk", species: ["spinda"], ev: "+1 Sp. Atk each", location: "Route 113" },
								{ stat: "Sp. Def", species: ["tentacool", "tentacruel"], ev: "+1–2 Sp. Def each", location: "Coastlines of Hoenn" },
								{ stat: "Speed", species: ["zubat"], ev: "+1 Speed each", location: "Granite Cave" },
							])}
							</div>
							<div className="matchup-box">
								<div className="matchup-title">Shopping Notes</div>
								<ul className="game-modal-method-description">
									<li>Buy vitamins from Lilycove Department Store or Slateport's Energy Guru.</li>
									<li>Harvest EV-reducing berries from the Berry Master to fix mistakes.</li>
									<li>Keep only trainees in your party because every participant gains EVs.</li>
								</ul>
							</div>
						</>
					) : (
						<>
							<div className="matchup-box">
								<div className="matchup-title">FireRed & LeafGreen: Quick Setup</div>
								<ul className="game-modal-method-description">
									<li>510 total EVs with 252 per stat; vitamins stop after 100 EVs until you battle.</li>
									<li>No Macho Brace or Power Items for sale, so rely on Pokérus and careful counting.</li>
									<li>Use the Vs. Seeker to refresh trainer battles or stay in single-species tall grass.</li>
								</ul>
							</div>
							<div className="matchup-box">
								<div className="matchup-title">Go-To Targets</div>
							{renderGoToTargets([
								{ stat: "HP", species: ["drowzee"], ev: "+2 HP each", location: "Route 11" },
								{ stat: "Attack", species: ["primeape"], ev: "+2 Attack each", location: "Route 23 / Sevii Islands (trainers)" },
								{ stat: "Defense", species: ["onix", "graveler"], ev: "+2 Defense each", location: "Victory Road" },
								{ stat: "Sp. Atk", species: ["gastly"], ev: "+1 Sp. Atk each", location: "Pokémon Tower" },
								{ stat: "Sp. Def", species: ["tentacool", "tentacruel"], ev: "+1–2 Sp. Def each", location: "Routes 19–21 (surf)" },
								{ stat: "Speed", species: ["diglett", "dugtrio"], ev: "+1–2 Speed each", location: "Diglett's Cave" },
							])}
							</div>
							<div className="matchup-box">
								<div className="matchup-title">Shopping Notes</div>
								<ul className="game-modal-method-description">
									<li>Stock up on vitamins at the Celadon Department Store.</li>
									<li>Collect EV-reducing berries in Berry Forest each day.</li>
									<li>Withdraw benched Pokémon into the PC so they do not gain stray EVs.</li>
								</ul>
							</div>
						</>
					)}
				</div>
			);
		}
		if (inList(gen4)) {
			if (gameKey === "heartgold-soulsilver") {
				return (
					<div className="matchup-grid">
						<div className="matchup-box">
							<div className="matchup-title">HeartGold & SoulSilver: Quick Setup</div>
							<ul className="game-modal-method-description">
								<li>Plan sessions around rematch trainers, Safari Zone blocks, or tall-grass loops.</li>
								<li>Power Items cost 16 BP at the Battle Frontier and stack with Pokérus.</li>
								<li>Macho Brace is rewarded in Goldenrod, offering a simple 2x boost early on.</li>
							</ul>
						</div>
						<div className="matchup-box">
							<div className="matchup-title">Go-To Targets</div>
							{renderGoToTargets([
								{ stat: "HP", species: ["wooper", "quagsire"], ev: "+1–2 HP each", location: "Union Cave B2F (surf)" },
								{ stat: "Attack", species: ["mankey", "primeape"], ev: "+1–2 Attack each", location: "Route 42 rematches" },
								{ stat: "Defense", species: ["graveler", "onix"], ev: "+2 Defense each", location: "Route 45" },
								{ stat: "Sp. Atk", species: ["gastly"], ev: "+1 Sp. Atk each", location: "Sprout/Bell Tower (night)" },
								{ stat: "Sp. Def", species: ["tentacool", "tentacruel"], ev: "+1–2 Sp. Def each", location: "Route 41 (surf)" },
								{ stat: "Speed", species: ["diglett", "pidgeotto"], ev: "+1–2 Speed each", location: "Diglett's Cave / Route 43" },
							])}
						</div>
						<div className="matchup-box">
							<div className="matchup-title">Shopping Notes</div>
							<ul className="game-modal-method-description">
								<li>Vitamins sold in Goldenrod and Celadon Department Stores.</li>
								<li>Grow EV-reducing berries with the portable Berry Pots between sessions.</li>
								<li>Keep extra party members boxed so they do not pick up stray EVs.</li>
							</ul>
						</div>
					</div>
				);
			}
			return (
				<div className="matchup-grid">
					<div className="matchup-box">
						<div className="matchup-title">Diamond, Pearl & Platinum: Quick Setup</div>
						<ul className="game-modal-method-description">
							<li>510 EV cap with vitamins topping out at 100 EVs until you battle again.</li>
							<li>Power Items cost 16 BP at the Battle Tower or Frontier; stack with Pokérus.</li>
							<li>Use the Vs. Seeker or cycling loops to chain encounters efficiently.</li>
						</ul>
					</div>
					<div className="matchup-box">
						<div className="matchup-title">Go-To Targets</div>
						{renderGoToTargets([
							{ stat: "HP", species: ["bibarel"], ev: "+2 HP each", location: "Route 212 (south)" },
							{ stat: "Attack", species: ["gyarados"], ev: "+2 Attack each", location: "Surf (Resort Area / Route 218)" },
							{ stat: "Defense", species: ["geodude", "graveler"], ev: "+1–2 Defense each", location: "Iron Island" },
							{ stat: "Sp. Atk", species: ["gastly"], ev: "+1 Sp. Atk each", location: "Old Chateau" },
							{ stat: "Sp. Def", species: ["tentacruel"], ev: "+2 Sp. Def each", location: "Route 223" },
							{ stat: "Speed", species: ["starly", "staravia"], ev: "+1–2 Speed each", location: "Route 201" },
						])}
					</div>
					<div className="matchup-box">
						<div className="matchup-title">Shopping Notes</div>
						<ul className="game-modal-method-description">
							<li>Buy vitamins at Veilstone Department Store.</li>
							<li>Stock Power Items at the Battle Tower or Frontier for 16 BP.</li>
							<li>Use the Pokétch Counter app to track knockouts per stat.</li>
						</ul>
					</div>
				</div>
			);
		}
		if (inList(gen5)) {
			if (gameKey === "black-2-white-2") {
				return (
					<div className="matchup-grid">
						<div className="matchup-box">
							<div className="matchup-title">Black 2 & White 2: Quick Setup</div>
							<ul className="game-modal-method-description">
								<li>Power Items cost 16 BP at the Battle Subway or Pokémon World Tournament.</li>
								<li>Join Avenue shops can discount vitamins and offer EV-reset services.</li>
								<li>Wings from Driftveil Drawbridge help fine-tune leftover points.</li>
							</ul>
						</div>
						<div className="matchup-box">
							<div className="matchup-title">Go-To Targets</div>
							{renderGoToTargets([
								{ stat: "HP", species: ["audino"], ev: "+2 HP each", location: "Shaking grass (Floccesy Ranch)" },
								{ stat: "Attack", species: ["sandile"], ev: "+1 Attack each", location: "Desert Resort" },
								{ stat: "Defense", species: ["boldore"], ev: "+2 Defense each", location: "Clay Tunnel" },
								{ stat: "Sp. Atk", species: ["litwick"], ev: "+1 Sp. Atk each", location: "Celestial Tower" },
								{ stat: "Sp. Def", species: ["frillish", "jellicent"], ev: "+1–2 Sp. Def each", location: "Route 4 / Undella Bay (surf)" },
								{ stat: "Speed", species: ["basculin"], ev: "+2 Speed each", location: "Fishing (various)" },
							])}
						</div>
						<div className="matchup-box">
							<div className="matchup-title">Shopping Notes</div>
							<ul className="game-modal-method-description">
								<li>Buy vitamins at Shopping Mall Nine or through Join Avenue vendors.</li>
								<li>Power Items are also sold for BP at the Pokémon World Tournament counter.</li>
								<li>Use the medal box or a notebook to track remaining EV totals.</li>
							</ul>
						</div>
					</div>
				);
			}
			return (
				<div className="matchup-grid">
					<div className="matchup-box">
						<div className="matchup-title">Black & White: Quick Setup</div>
						<ul className="game-modal-method-description">
							<li>Power Items cost 16 BP at the Battle Subway in Nimbasa City.</li>
							<li>Feathers from Driftveil and Marvelous Bridges add +1 EV for easy cleanup.</li>
							<li>Audino in shaking grass give HP EVs plus experience for leveling.</li>
						</ul>
					</div>
					<div className="matchup-box">
						<div className="matchup-title">Go-To Targets</div>
						{renderGoToTargets([
							{ stat: "HP", species: ["audino"], ev: "+2 HP each", location: "Shaking grass (Unova)" },
							{ stat: "Attack", species: ["lillipup", "herdier"], ev: "+1–2 Attack each", location: "Route 1" },
							{ stat: "Defense", species: ["roggenrola"], ev: "+1 Defense each", location: "Wellspring Cave" },
							{ stat: "Sp. Atk", species: ["litwick"], ev: "+1 Sp. Atk each", location: "Celestial Tower" },
							{ stat: "Sp. Def", species: ["frillish"], ev: "+1 Sp. Def each", location: "Undella Bay (surf)" },
							{ stat: "Speed", species: ["basculin"], ev: "+2 Speed each", location: "Fishing (various)" },
						])}
					</div>
					<div className="matchup-box">
						<div className="matchup-title">Shopping Notes</div>
						<ul className="game-modal-method-description">
							<li>Vitamins sold at Shopping Mall Nine on Route 9.</li>
							<li>Pick up the Macho Brace from Anville Town for an early 2x boost.</li>
							<li>Feathers respawn daily on the drawbridges, perfect for topping off stats.</li>
						</ul>
					</div>
				</div>
			);
		}
		if (inList(gen6)) {
			if (gameKey === "omega-ruby-alpha-sapphire") {
				return (
					<div className="matchup-grid">
						<div className="matchup-box">
							<div className="matchup-title">Omega Ruby & Alpha Sapphire: Quick Setup</div>
							<ul className="game-modal-method-description">
								<li>Horde battles and DexNav chains deliver fast EVs once you unlock the Mach Bike.</li>
								<li>Power Items cost 16 BP at the Battle Maison on the Battle Resort.</li>
								<li>Secret Base trainers or Blissey bases can level new Pokémon between sessions.</li>
							</ul>
						</div>
						<div className="matchup-box">
							<div className="matchup-title">Go-To Targets</div>
							{renderGoToTargets([
								{ stat: "HP", species: ["whismur"], ev: "+1 HP each (hordes)", location: "Rusturf Tunnel" },
								{ stat: "Attack", species: ["shuppet"], ev: "+1 Attack each (hordes)", location: "Route 121" },
								{ stat: "Defense", species: ["geodude"], ev: "+1 Defense each (hordes)", location: "Granite Cave" },
								{ stat: "Sp. Atk", species: ["spinda"], ev: "+1 Sp. Atk each (hordes)", location: "Route 113" },
								{ stat: "Sp. Def", species: ["tentacool", "tentacruel"], ev: "+1–2 Sp. Def each", location: "Surf (Hoenn routes)" },
								{ stat: "Speed", species: ["zubat"], ev: "+1 Speed each (hordes)", location: "Granite Cave" },
							])}
						</div>
						<div className="matchup-box">
							<div className="matchup-title">Shopping Notes</div>
							<ul className="game-modal-method-description">
								<li>Vitamins available in Lilycove Department Store or Slateport's Energy Guru.</li>
								<li>Power Items and Macho Brace stack with Pokérus for massive horde gains.</li>
								<li>Use the DexNav search counter to maintain chains for rarer EV targets.</li>
							</ul>
						</div>
					</div>
				);
			}
			return (
				<div className="matchup-grid">
					<div className="matchup-box">
						<div className="matchup-title">X & Y: Quick Setup</div>
						<ul className="game-modal-method-description">
							<li>Horde battles yield five EV payouts at once; combine with Power Items for big gains.</li>
							<li>Super Training lets you top off or reset individual stats quickly.</li>
							<li>Power Items cost 16 BP at the Battle Maison in Kiloude City.</li>
						</ul>
					</div>
					<div className="matchup-box">
						<div className="matchup-title">Go-To Targets</div>
						{renderGoToTargets([
							{ stat: "HP", species: ["gulpin"], ev: "+1 HP each (hordes)", location: "Route 5" },
							{ stat: "Attack", species: ["axew"], ev: "+1 Attack each (hordes)", location: "Route 10" },
							{ stat: "Defense", species: ["nosepass"], ev: "+1 Defense each (hordes)", location: "Route 8 cliffs" },
							{ stat: "Sp. Atk", species: ["psyduck"], ev: "+1 Sp. Atk each (hordes)", location: "Route 7" },
							{ stat: "Sp. Def", species: ["tentacool"], ev: "+1 Sp. Def each", location: "Route 12 (fishing)" },
							{ stat: "Speed", species: ["fletchling"], ev: "+1 Speed each (hordes)", location: "Route 5" },
						])}
					</div>
					<div className="matchup-box">
						<div className="matchup-title">Shopping Notes</div>
						<ul className="game-modal-method-description">
							<li>Buy vitamins at Lumiose City Poké Marts for 10,000 Pokédollars.</li>
							<li>Power Items and reset bags drop from the Battle Maison and Super Training.</li>
							<li>Use O-Powers to replenish PP and speed up encounter loops.</li>
						</ul>
					</div>
				</div>
			);
		}
		if (inList(gen7_standard)) {
			return (
				<div className="matchup-grid">
					<div className="matchup-box">
						<div className="matchup-title">Sun, Moon, Ultra Sun & Ultra Moon: Quick Setup</div>
						<ul className="game-modal-method-description">
							<li>SOS chains plus Adrenaline Orbs spawn endless single-stat targets.</li>
							<li>Power Items cost 16 BP at the Battle Tree and stack with Pokérus.</li>
							<li>Use Poke Pelago's Isle Evelup or Festival Plaza shops for passive EV tweaks.</li>
						</ul>
					</div>
					<div className="matchup-box">
						<div className="matchup-title">Go-To Targets</div>
						{renderGoToTargets([
							{ stat: "HP", species: ["caterpie", "metapod"], ev: "+1 HP each (SOS)", location: "Route 1" },
							{ stat: "Attack", species: ["yungoos", "gumshoos"], ev: "+1–2 Attack each (SOS)", location: "Route 1 (night)" },
							{ stat: "Defense", species: ["roggenrola"], ev: "+1 Defense each (SOS)", location: "Ten Carat Hill" },
							{ stat: "Sp. Atk", species: ["gastly"], ev: "+1 Sp. Atk each (SOS)", location: "Hau'oli Cemetery" },
							{ stat: "Sp. Def", species: ["dewpider"], ev: "+1 Sp. Def each (SOS)", location: "Brooklet Hill" },
							{ stat: "Speed", species: ["zubat"], ev: "+1 Speed each (SOS)", location: "Verdant Cavern" },
						])}
					</div>
					<div className="matchup-box">
						<div className="matchup-title">Shopping Notes</div>
						<ul className="game-modal-method-description">
							<li>Buy vitamins at Hau'oli City's shopping mall or Thrifty Megamart for 10,000 Pokédollars.</li>
							<li>Power Items and EV-reset berries sold for BP at the Battle Tree.</li>
							<li>Keep a False Swipe user with lots of PP to maintain SOS chains easily.</li>
						</ul>
					</div>
				</div>
			);
		}
		if (inList(lgpe)) {
			return (
				<div className="matchup-grid">
					<div className="matchup-box">
						<div className="matchup-title">Let's Go (LGPE): Awakening Values (AVs)</div>
						<ul className="game-modal-method-description">
							<li>Traditional EVs are replaced by Awakening Values (0–200 per stat).</li>
							<li>Use Candies to raise AVs; Power Items, feathers, Pokérus do not apply.</li>
						</ul>
					</div>
					<div className="matchup-box">
						<div className="matchup-title">EV/AV Items and where to buy</div>
						<ul className="game-modal-method-description">
							<li>Candies (Health/Mighty/Smart/Clever/Swift, etc.): Earn via catch combos, GO Park transfers, and in-game rewards; not sold in standard Poké Marts.</li>
							<li>Vitamins/Power Items/Feathers: Not part of the LGPE AV system via shops.</li>
						</ul>
					</div>
				</div>
			);
		}
		if (inList(pla)) {
			return (
				<div className="matchup-grid">
					<div className="matchup-box">
						<div className="matchup-title">Legends: Arceus: Effort Levels (ELs)</div>
						<ul className="game-modal-method-description">
							<li>No EVs. Uses Effort Levels (0–10) per stat, boosted with Grit items.</li>
							<li>ELs increase stats directly; mechanics are separate from traditional EVs.</li>
						</ul>
					</div>
					<div className="matchup-box">
						<div className="matchup-title">EL Items and where to buy</div>
						<ul className="game-modal-method-description">
							<li>Grit Dust/Gravel/Pebble/Rock: Trading Post (Jubilife Village) for Merit Points (MP); also drops and requests.</li>
						</ul>
					</div>
				</div>
			);
		}
		if (inList(gen8_standard)) {
			if (gameKey === "sword-shield") {
				return (
					<div className="matchup-grid">
						<div className="matchup-box">
							<div className="matchup-title">Sword & Shield: Quick Setup</div>
							<ul className="game-modal-method-description">
								<li>Vitamins raise a stat straight to 252 EVs; grab them in Wyndon.</li>
								<li>Power Items cost 10 BP at Hammerlocke's BP Shop or the Battle Tower.</li>
								<li>Every party member gains EXP and EVs, so bench anyone already trained.</li>
							</ul>
						</div>
						<div className="matchup-box">
							<div className="matchup-title">Fast Cash & BP</div>
							<ul className="game-modal-method-description">
								<li>Farm Max Raid dens for Watts, buy Luxury Balls, and sell them for profit.</li>
								<li>Run Champion Cup rematches with Gigantamax Meowth to earn about 300,000 Pokédollars per run.</li>
								<li>Visit the Digging Duo near the Wild Area Nursery for sellable treasures and Bottle Caps.</li>
							</ul>
						</div>
						<div className="matchup-box">
							<div className="matchup-title">Go-To Targets</div>
							{renderGoToTargets([
								{ stat: "HP", species: ["skwovet"], ev: "+1 HP each", location: "Route 1" },
								{ stat: "Attack", species: ["timburr"], ev: "+1 Attack each", location: "Galar Mine No. 1" },
								{ stat: "Defense", species: ["rolycoly"], ev: "+1 Defense each", location: "Route 3" },
								{ stat: "Sp. Atk", species: ["gastly"], ev: "+1 Sp. Atk each", location: "Watchtower Ruins" },
								{ stat: "Sp. Def", species: ["duskull"], ev: "+1 Sp. Def each", location: "Watchtower Ruins (night)" },
								{ stat: "Speed", species: ["rookidee"], ev: "+1 Speed each", location: "Route 2" },
							])}
						</div>
					</div>
				);
			}
			return (
				<div className="matchup-grid">
					<div className="matchup-box">
						<div className="matchup-title">Brilliant Diamond & Shining Pearl: Quick Setup</div>
						<ul className="game-modal-method-description">
							<li>Vitamins instantly reach 252 EVs just like in modern titles.</li>
							<li>Power Items cost 10 BP at the Fight Area Battle Tower.</li>
							<li>Use Poké Radar chains or Grand Underground rooms to isolate single-stat species.</li>
						</ul>
					</div>
					<div className="matchup-box">
						<div className="matchup-title">Go-To Targets</div>
						{renderGoToTargets([
							{ stat: "HP", species: ["bibarel"], ev: "+2 HP each", location: "Route 212" },
							{ stat: "Attack", species: ["gyarados"], ev: "+2 Attack each", location: "Surf (Route 218)" },
							{ stat: "Defense", species: ["graveler"], ev: "+2 Defense each", location: "Iron Island / Grand Underground" },
							{ stat: "Sp. Atk", species: ["gastly"], ev: "+1 Sp. Atk each", location: "Lost Tower" },
							{ stat: "Sp. Def", species: ["tentacruel"], ev: "+2 Sp. Def each", location: "Route 223" },
							{ stat: "Speed", species: ["starly", "staravia"], ev: "+1–2 Speed each", location: "Near Sandgem Town" },
						])}
					</div>
					<div className="matchup-box">
						<div className="matchup-title">Shopping Notes</div>
						<ul className="game-modal-method-description">
							<li>Vitamins restocked at Veilstone Department Store.</li>
							<li>Power Items sold for BP at the Battle Tower front desk.</li>
							<li>Use the Pokétch Counter app or pokechart to track remaining KOs.</li>
						</ul>
					</div>
				</div>
			);
		}
		if (inList(gen9)) {
			return (
				<div className="matchup-grid">
					<div className="matchup-box">
						<div className="matchup-title">Scarlet & Violet: Quick Start</div>
						<ul className="game-modal-method-description">
							<li>Power Items add +8 EVs; 1 EV foes give 9 EVs total, so 28 KOs hits 252.</li>
							<li>2 EV foes (e.g., Cyclizar) give 10 EVs; only 26 KOs needed.</li>
							<li>Your whole party gains EVs from battles, so box anything you don't want training.</li>
							<li>Auto-battles (R button) give zero EVs; battle manually.</li>
							<li>Vitamins jump straight to 252 in a stat if you prefer spending cash/LP.</li>
						</ul>
					</div>
					<div className="matchup-box">
						<div className="matchup-title">Go-To Targets</div>
						{renderGoToTargets([
							{ stat: "HP", species: ["marill", "azumarill"], ev: "+2 HP" },
							{ stat: "HP", species: ["azumarill"], ev: "+3 HP" },
							{ stat: "Attack", species: ["heracross", "bisharp", "lokix"], ev: "+2 Attack" },
							{ stat: "Attack", species: ["luxray"], ev: "+3 Attack" },
							{ stat: "Defense", species: ["bergmite"], ev: "+1 Defense" },
							{ stat: "Defense", species: ["avalugg", "slowbro"], ev: "+2 Defense" },
							{ stat: "Sp. Atk", species: ["flaaffy", "girafarig"], ev: "+2 Sp. Atk" },
							{ stat: "Sp. Def", species: ["goomy", "sliggoo"], ev: "+1 Sp. Def" },
							{ stat: "Sp. Def", species: ["swablu", "altaria"], ev: "+2 Sp. Def" },
							{ stat: "Speed", species: ["murkrow", "pawmi", "deerling", "rookidee", "wattrel"], ev: "+1 Speed" },
							{ stat: "Speed", species: ["corvisquire", "cyclizar"], ev: "+2 Speed" },
						])}
					</div>
					<div className="matchup-box">
						<div className="matchup-title">Speedy Farming Spots</div>
						<ul className="game-modal-method-description">
							<li>Speed EVs: Fletchling/Rookidee south of Mesagoza (1 EV each).</li>
							<li>Speed EVs (faster): Cyclizar near Levincia or Porto Marinada (2 EV each).</li>
							<li>Other stats: pick single-type swarms and pair with the matching Power Item.</li>
							<li>Use meals/sandwiches for Encounter Power so targets spawn nonstop.</li>
						</ul>
					</div>
					<div className="matchup-box">
						<div className="matchup-title">Shop Cheat Sheet</div>
						<ul className="game-modal-method-description">
							<li>Power Items: Delibird Presents (Mesagoza/Levincia/Cascarrafa) for 10,000₽.</li>
							<li>Vitamins & Feathers: Chansey Supply (same cities) for 10,000₽ per vitamin.</li>
							<li>Feathers & EV berries also show up via Porto Marinada auctions and overworld pickups.</li>
							<li>Track KOs via move PP or the in-game EV graph to stay on script.</li>
						</ul>
					</div>
				</div>
			);
		}
		return null;
	};
	return (
		<div className="app-shell">
			<a
				className="discord-support-fab"
				href="https://discord.gg/WXMjmyjeC3"
				target="_blank"
				rel="noopener noreferrer"
				aria-label="Report a bug or request a feature on Discord"
			>
				Feedback · Discord
			</a>
			<header className="app-header">
		<div className="container">
			<h1 className="title">EV Training</h1>
			<p className="subtitle">Effort Values (EVs): quick primer</p>
					<CategoryToggle />
				</div>
			</header>
			<main className="container">
				{showFilters && showGameFilters && (
					<GameFilters
						showFilters={showFilters}
						showGameFilters={showGameFilters}
						selectedDex={selectedDex}
						gameFiltersRef={null}
						availableGames={sortedAvailableGames}
						selectedGame={selectedGame}
						onGameClick={onGameClick}
						resolveLogoUrls={resolveLogoUrls}
					/>
				)}
		<section className="content single-col" style={{ paddingTop: 16 }}>
			<div className="matchup-grid" style={{ marginBottom: 16 }}>
					<div className="matchup-box">
						<div className="matchup-title">EV Basics</div>
						<ul className="game-modal-method-description">
							<li>Each Pokémon can invest up to 510 EVs overall, with no more than 252 EVs in a single stat.</li>
							<li>Every 4 EVs in a stat translate to roughly +1 actual stat point at level 100 (less at lower levels).</li>
							<li>Defeating or catching a Pokémon grants EVs based on its species; battling with Pokérus or Power Items multiplies those gains.</li>
							<li>Vitamins instantly add 10 EVs per use (up to the 252 cap), while feathers and Power Items give precise +1 or +8 boosts.</li>
							<li>Natures modify final stats by ±10%; pair your EV spread with a matching nature to squeeze the most value out of each point.</li>
						</ul>
					</div>
				<div className="matchup-box">
					<div className="vitamin-columns">
						<div className="vitamin-column">
							<div className="vitamin-column-title">Vitamins</div>
							<ul className="game-modal-method-description vitamin-list">
								<li className="vitamin-item">
									<img className="vitamin-icon" src="/items/images/hpup.png" alt="HP Up" loading="lazy" />
									<div>
										<strong>HP Up</strong>
										<div>+10 HP</div>
									</div>
								</li>
								<li className="vitamin-item">
									<img className="vitamin-icon" src="/items/images/protein.png" alt="Protein" loading="lazy" />
									<div>
										<strong>Protein</strong>
										<div>+10 Attack</div>
									</div>
								</li>
								<li className="vitamin-item">
									<img className="vitamin-icon" src="/items/images/iron.png" alt="Iron" loading="lazy" />
									<div>
										<strong>Iron</strong>
										<div>+10 Defense</div>
									</div>
								</li>
								<li className="vitamin-item">
									<img className="vitamin-icon" src="/items/images/calcium.png" alt="Calcium" loading="lazy" />
									<div>
										<strong>Calcium</strong>
										<div>+10 Sp. Atk</div>
									</div>
								</li>
								<li className="vitamin-item">
									<img className="vitamin-icon" src="/items/images/zinc.png" alt="Zinc" loading="lazy" />
									<div>
										<strong>Zinc</strong>
										<div>+10 Sp. Def</div>
									</div>
								</li>
								<li className="vitamin-item">
									<img className="vitamin-icon" src="/items/images/carbos.png" alt="Carbos" loading="lazy" />
									<div>
										<strong>Carbos</strong>
										<div>+10 Speed</div>
									</div>
								</li>
							</ul>
						</div>
						<div className="vitamin-column">
							<div className="vitamin-column-title">Feathers</div>
							<ul className="game-modal-method-description vitamin-list">
								<li className="vitamin-item">
									<img className="vitamin-icon" src="/items/images/healthfeather.png" alt="Health Feather" loading="lazy" />
									<div>
										<strong>Health Feather</strong>
										<div>+1 HP</div>
									</div>
								</li>
								<li className="vitamin-item">
									<img className="vitamin-icon" src="/items/images/musclefeather.png" alt="Muscle Feather" loading="lazy" />
									<div>
										<strong>Muscle Feather</strong>
										<div>+1 Attack</div>
									</div>
								</li>
								<li className="vitamin-item">
									<img className="vitamin-icon" src="/items/images/resistfeather.png" alt="Resist Feather" loading="lazy" />
									<div>
										<strong>Resist Feather</strong>
										<div>+1 Defense</div>
									</div>
								</li>
								<li className="vitamin-item">
									<img className="vitamin-icon" src="/items/images/geniusfeather.png" alt="Genius Feather" loading="lazy" />
									<div>
										<strong>Genius Feather</strong>
										<div>+1 Sp. Atk</div>
									</div>
								</li>
								<li className="vitamin-item">
									<img className="vitamin-icon" src="/items/images/cleverfeather.png" alt="Clever Feather" loading="lazy" />
									<div>
										<strong>Clever Feather</strong>
										<div>+1 Sp. Def</div>
									</div>
								</li>
								<li className="vitamin-item">
									<img className="vitamin-icon" src="/items/images/swiftfeather.png" alt="Swift Feather" loading="lazy" />
									<div>
										<strong>Swift Feather</strong>
										<div>+1 Speed</div>
									</div>
								</li>
							</ul>
						</div>
						<div className="vitamin-column">
							<div className="vitamin-column-title">Power Items</div>
							<ul className="game-modal-method-description vitamin-list">
								<li className="vitamin-item">
									<img className="vitamin-icon" src="/items/images/powerweight.png" alt="Power Weight" loading="lazy" />
									<div>
										<strong>Power Weight</strong>
										<div>+8 HP</div>
									</div>
								</li>
								<li className="vitamin-item">
									<img className="vitamin-icon" src="/items/images/powerbracer.png" alt="Power Bracer" loading="lazy" />
									<div>
										<strong>Power Bracer</strong>
										<div>+8 Attack</div>
									</div>
								</li>
								<li className="vitamin-item">
									<img className="vitamin-icon" src="/items/images/powerbelt.png" alt="Power Belt" loading="lazy" />
									<div>
										<strong>Power Belt</strong>
										<div>+8 Defense</div>
									</div>
								</li>
								<li className="vitamin-item">
									<img className="vitamin-icon" src="/items/images/powerlens.png" alt="Power Lens" loading="lazy" />
									<div>
										<strong>Power Lens</strong>
										<div>+8 Sp. Atk</div>
									</div>
								</li>
								<li className="vitamin-item">
									<img className="vitamin-icon" src="/items/images/powerband.png" alt="Power Band" loading="lazy" />
									<div>
										<strong>Power Band</strong>
										<div>+8 Sp. Def</div>
									</div>
								</li>
								<li className="vitamin-item">
									<img className="vitamin-icon" src="/items/images/poweranklet.png" alt="Power Anklet" loading="lazy" />
									<div>
										<strong>Power Anklet</strong>
										<div>+8 Speed</div>
									</div>
								</li>
							</ul>
						</div>
					</div>
				</div>
			</div>
					{selectedGame ? (
			renderGuideFor(selectedGame)
					) : (
						<div className="matchup-box">
							<div className="matchup-title">Select a Game</div>
							<p style={{ margin: 0 }}>
								Choose a game above to see EV training specifics for that version.
							</p>
						</div>
					)}
				</section>
			</main>
		</div>
	);
}



