import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon, { Cursor } from "./components/Icon.jsx";
import Sheet from "./components/Sheet.jsx";
import SpriteImage from "./components/SpriteImage.jsx";
import { CartLogos } from "./pokedex/GamePicker.jsx";
import { GAME_GROUPS, ROMAN, readGamePreference, regionLabel, writeGamePreference } from "./pokedex/games.js";
import { GAME_LOOKUP } from "./constants/games.js";
import {
	EV_PANEL_FEATHERS,
	EV_PANEL_POWER_ITEMS,
	EV_PANEL_VITAMINS,
	GRIT_ITEMS,
	getPowerItemBonus,
} from "./constants/evItems.js";
import { NATIONAL_ID_TO_SLUG } from "./data/pokemonSpeciesMap.js";
import { formatPokemonName } from "./utils/pokemonNames.js";
import "./styles/pokedex.css";
import "./styles/pages/ev-training.css";

/*
 * Facts on this page were checked against Bulbapedia ("Effort values", "Effort level", "Go Power",
 * the per-generation "List of Pokémon by effort value yield" pages, item pages and location pages)
 * and PokeAPI encounter data.
 */

/* ------------------------------------------------------------------------------- game rules */

// system: "statexp" (Gen I-II Stat Experience), "ev" (modern EVs), "av" (Let's Go AVs),
// "el" (Legends: Arceus Effort Levels).
// feathers: true | false | "dlc" (Legends: Z-A only sells them in the Mega Dimension DLC).
// pokerus / catchEvs / machoBrace: true | false | null (null = not stated for that game).
const GAME_RULES = {
	"red-blue-yellow": { gen: 1, system: "statexp" },
	"gold-silver-crystal": { gen: 2, system: "statexp" },
	"ruby-sapphire-emerald": { gen: 3, system: "ev", pokerus: true, machoBrace: true },
	"firered-leafgreen": { gen: 3, system: "ev", pokerus: true, machoBrace: true },
	"diamond-pearl": { gen: 4, system: "ev", pokerus: true, machoBrace: true },
	platinum: { gen: 4, system: "ev", pokerus: true, machoBrace: true },
	"heartgold-soulsilver": { gen: 4, system: "ev", pokerus: true, machoBrace: true },
	"black-white": { gen: 5, system: "ev", feathers: true, pokerus: true, machoBrace: true },
	"black-2-white-2": { gen: 5, system: "ev", feathers: true, pokerus: true, machoBrace: true },
	"x-y": { gen: 6, system: "ev", feathers: true, pokerus: true, catchEvs: true, machoBrace: true },
	"omega-ruby-alpha-sapphire": { gen: 6, system: "ev", feathers: true, pokerus: true, catchEvs: true, machoBrace: true },
	"sun-moon": { gen: 7, system: "ev", feathers: true, pokerus: true, catchEvs: true, machoBrace: false },
	"ultra-sun-ultra-moon": { gen: 7, system: "ev", feathers: true, pokerus: true, catchEvs: true, machoBrace: false },
	"lets-go": { gen: 7, system: "av" },
	"sword-shield": { gen: 8, system: "ev", feathers: true, pokerus: true, catchEvs: true, machoBrace: true },
	"brilliant-diamond-shining-pearl": { gen: 8, system: "ev", feathers: false, pokerus: true, catchEvs: true, machoBrace: true },
	"legends-arceus": { gen: 8, system: "el" },
	"scarlet-violet": { gen: 9, system: "ev", feathers: true, pokerus: false, catchEvs: true, machoBrace: false },
	"legends-za": { gen: 9, system: "ev", feathers: "dlc", pokerus: null, catchEvs: null, machoBrace: false },
};

const perStatCap = (gen) => (gen >= 6 ? 252 : 255);

function getEvBasics(rules) {
	if (!rules) {
		return [
			"From Generation III on, a Pokémon can hold 510 EVs in total. The per-stat cap is 255 in Generations III–V and 252 from Generation VI; either way only 252 count toward the stat.",
			"Every 4 EVs in a stat add 1 point to it at level 100 (proportionally less at lower levels).",
			"Defeating a Pokémon grants its species' EV yield; from Generation VI, catching one does too.",
			"Vitamins add 10 EVs each. Through Generation VII they stop working once the stat has 100 EVs; from Generation VIII they work all the way to 252. Feathers (called Wings before Sword & Shield) add 1 EV each.",
			"Power Items add +4 (Generations IV–VI) or +8 (Generation VII on) EVs of their stat per Pokémon defeated, and Pokérus doubles EVs from battles (it doesn't exist in Let's Go or Scarlet & Violet).",
			"Generations I–II use Stat Experience, Let's Go uses Awakening Values and Legends: Arceus uses Effort Levels — pick a game for the details.",
			"Natures modify final stats by ±10%; pair your EV spread with a matching nature to squeeze the most value out of each point.",
		];
	}
	const { gen } = rules;
	const bonus = getPowerItemBonus(gen);
	const items = [];
	items.push(
		gen <= 5
			? `Each Pokémon can hold up to 510 EVs overall and ${perStatCap(gen)} in a single stat, but only 252 of those count (stats use EVs ÷ 4).`
			: "Each Pokémon can hold up to 510 EVs overall, with no more than 252 in a single stat."
	);
	items.push("Every 4 EVs in a stat translate to +1 stat point at level 100 (less at lower levels).");
	const gainWho = gen <= 5
		? "Only Pokémon that took part in the battle (or hold the Exp. Share) receive them."
		: rules.catchEvs === null
			? ""
			: "Every party member that receives Exp. through the Exp. Share also gets the full EVs.";
	items.push(`Defeating${rules.catchEvs ? " or catching" : ""} a Pokémon grants its species' EV yield. ${gainWho}`.trim());
	const boosts = [];
	if (rules.pokerus) boosts.push("Pokérus doubles EVs earned in battle");
	if (bonus) boosts.push(`a Power Item adds +${bonus} EVs of its stat per Pokémon defeated`);
	if (rules.machoBrace) boosts.push("the Macho Brace doubles battle EVs");
	if (rules.pokerus === false) boosts.push("Pokérus has no effect in this game");
	if (boosts.length) {
		const text = boosts.join("; ");
		items.push(`${text.charAt(0).toUpperCase()}${text.slice(1)}.`);
	}
	const featherName = gen <= 7 ? "Wings" : "Feathers";
	const featherLabel = rules.feathers === "dlc" ? `${featherName} (Mega Dimension DLC)` : featherName;
	const featherText = rules.feathers ? ` ${featherLabel} add 1 EV each, up to the ${perStatCap(gen)} cap.` : "";
	items.push(
		gen >= 8
			? `Vitamins add 10 EVs each and work all the way to 252 (the old 100-EV limit was removed in Generation VIII), so 26 bottles max out a stat.${featherText}`
			: `Vitamins add 10 EVs each but can't be used once that stat already has 100 EVs.${featherText}`
	);
	items.push("Natures modify final stats by ±10%; pair your EV spread with a matching nature to squeeze the most value out of each point.");
	return items;
}

/* ------------------------------------------------------------------------- per-game guides */

const box = (title, items) => ({ title, items });

const GEN3_CAPS = "510 EVs in total and up to 255 in one stat (only 252 count); vitamins stop working once a stat has 100 EVs.";
const GEN4_CAPS = GEN3_CAPS;
const GEN3_4_PARTY = "Only Pokémon that battle (or hold the Exp. Share) gain EVs, so lead with your trainee and switch out, or give it the Exp. Share.";
const GEN8_VITAMINS = "Vitamins add 10 EVs each with no 100-EV limit (new in Generation VIII), so 26 bottles max out a stat.";

const GUIDES = {
	"red-blue-yellow": [
		box("Generation I (RBY): Stat Experience", [
			"No modern EVs: each stat has its own Stat Experience, up to 65,535, with no overall cap.",
			"Defeating a Pokémon adds its base stats to the Stat Exp of the Pokémon that battled (split between them if several took part).",
			"Vitamins add 2,560 Stat Exp each and are refused once that stat has 25,600 or more.",
			"Stats update on level-up, or when the Pokémon is withdrawn from the PC (the box trick).",
			"There is a single Special stat; Calcium raises it.",
		]),
		box("EV Items and where to buy", [
			"Vitamins (HP Up, Protein, Iron, Carbos, Calcium): Celadon Department Store, for cash.",
			"Power Items, the Macho Brace, Wings/Feathers, EV-reducing berries and Pokérus don't exist yet.",
		]),
	],
	"gold-silver-crystal": [
		box("Generation II (GSC): Stat Experience + Pokérus", [
			"Same Stat Exp system as Generation I: up to 65,535 per stat and no 510 total cap.",
			"Sp. Atk and Sp. Def share one Special Stat Exp value (gained from the foe's Sp. Atk base stat), so Calcium raises both; Zinc doesn't exist until Generation III.",
			"Pokérus debuts and doubles Stat Exp from battles; the effect stays even after the Pokémon is cured.",
			"Vitamins add 2,560 Stat Exp each until that stat reaches 25,600; EV-reducing berries do not exist yet.",
		]),
		box("EV Items and where to buy", [
			"Vitamins (HP Up, Protein, Iron, Carbos, Calcium): Goldenrod Department Store and Celadon Department Store, for cash.",
			"Power Items, the Macho Brace and Wings/Feathers don't exist yet.",
		]),
	],
	"ruby-sapphire-emerald": [
		box("Ruby, Sapphire & Emerald: Quick Setup", [
			GEN3_CAPS,
			"Get the Macho Brace from the Winstrate family on Route 111: it doubles battle EVs, and Pokérus doubles them again (4×).",
			"Power Items do not exist yet, so track knockouts manually.",
		]),
		box("Shopping Notes", [
			"Buy vitamins from Lilycove Department Store or the Energy Guru in Slateport Market.",
			"Emerald only: Pomeg, Kelpsy, Qualot, Hondew, Grepa and Tamato Berries lower a stat by 10 EVs (the Berry Master on Route 123 hands them out). In Ruby and Sapphire they can't be used on Pokémon.",
			GEN3_4_PARTY,
		]),
	],
	"firered-leafgreen": [
		box("FireRed & LeafGreen: Quick Setup", [
			GEN3_CAPS,
			"The Macho Brace is an item in Viridian Gym; Power Items don't exist yet.",
			"Pokérus can't be caught here (the games have no clock) and doesn't spread; only Pokémon traded in already infected have it.",
			"Use the Vs. Seeker to rematch trainers, or stay in spots dominated by a single species.",
		]),
		box("Shopping Notes", [
			"Stock up on vitamins at the Celadon Department Store.",
			"EV-reducing berries do nothing in FireRed and LeafGreen; that effect started with Emerald.",
			GEN3_4_PARTY,
		]),
	],
	"heartgold-soulsilver": [
		box("HeartGold & SoulSilver: Quick Setup", [
			GEN4_CAPS,
			"Power Items (+4 EVs per KO, doubled by Pokérus) cost 16 BP at the Battle Frontier.",
			"The Macho Brace is held by the Machop you receive in an in-game trade at Goldenrod Department Store.",
			"Plan sessions around rematch trainers, Safari Zone blocks, or tall-grass loops.",
		]),
		box("Shopping Notes", [
			"Vitamins are sold in the Goldenrod and Celadon Department Stores.",
			"EV-reducing berries lower a stat by 10 EVs, or straight to 100 if it was above 110; grow extras in the Berry Pots.",
			GEN3_4_PARTY,
		]),
	],
	"diamond-pearl": [
		box("Diamond, Pearl & Platinum: Quick Setup", [
			GEN4_CAPS,
			"Power Items (+4 EVs per KO, doubled by Pokérus) cost 16 BP at the Battle Park's Exchange Service Corner (Diamond/Pearl) or the Battle Frontier (Platinum).",
			"The Macho Brace is found in Pastoria City.",
			"Use the Vs. Seeker or Poké Radar chains to repeat encounters efficiently.",
		]),
		box("Shopping Notes", [
			"Buy vitamins at Veilstone Department Store.",
			"EV-reducing berries lower a stat by 10 EVs, or straight to 100 if it was above 110; the Berry Master's house on Route 208 gives them out.",
			"Use the Pokétch Counter app to track knockouts per stat.",
		]),
	],
	"black-white": [
		box("Black & White: Quick Setup", [
			"510 EVs in total and up to 255 per stat (only 252 count); vitamins stop at 100 EVs, but Wings (+1 each) keep working up to 255.",
			"Power Items (+4 EVs per KO) cost 16 BP at the Battle Subway in Nimbasa City.",
			"Audino in shaking grass give 2 HP EVs plus plenty of Exp.",
		]),
		box("Shopping Notes", [
			"Vitamins are sold at Shopping Mall Nine on Route 9.",
			"The Macho Brace is in Nimbasa City's eastern gate.",
			"Investigate the bird shadows on Driftveil Drawbridge and Marvelous Bridge for Wings to top off stats.",
		]),
	],
	"black-2-white-2": [
		box("Black 2 & White 2: Quick Setup", [
			"Power Items (+4 EVs per KO) cost 16 BP at the Battle Subway or the Pokémon World Tournament.",
			"Join Avenue's Market sells vitamins by the dozen, and its Dojo, Beauty Salon and Café can raise or lower EVs for a fee.",
			"Wings from Driftveil Drawbridge and Marvelous Bridge (and Black Tower/White Treehollow) fine-tune leftover points.",
		]),
		box("Shopping Notes", [
			"Buy vitamins at Shopping Mall Nine or Join Avenue's Market.",
			"The Macho Brace is in Nimbasa City's eastern gate.",
			"After the Champion, Bianca (via Xtransceiver) tells you when a party Pokémon has 510 EVs or 252 in a stat.",
		]),
	],
	"x-y": [
		box("X & Y: Quick Setup", [
			"Horde battles give five Pokémon's EVs at once, and Power Items add their bonus for each one; use Sweet Scent or Honey where hordes appear (in clear weather).",
			"Super Training raises individual stats, and a Reset Bag wipes all of a Pokémon's EVs.",
			"Power Items (+4 EVs per KO) cost 16 BP at the Battle Maison in Kiloude City.",
		]),
		box("Shopping Notes", [
			"Buy vitamins at the Laverre City Poké Mart for 9,800 Pokédollars each.",
			"The Macho Brace is on Route 15.",
			"The Juice Shoppe in Lumiose City sells and blends EV juices.",
		]),
	],
	"omega-ruby-alpha-sapphire": [
		box("Omega Ruby & Alpha Sapphire: Quick Setup", [
			"Horde encounters (Sweet Scent or Honey) give five Pokémon's EVs at once.",
			"Power Items (+4 EVs per KO) cost 16 BP at the Battle Maison in the Battle Resort.",
			"Super Training raises individual stats, and a Reset Bag wipes all EVs.",
		]),
		box("Shopping Notes", [
			"Vitamins are available in Lilycove Department Store or from the Energy Guru in Slateport Market.",
			"The Macho Brace is on Route 111; it or a Power Item stacks with Pokérus.",
			"Use the DexNav to find specific species quickly.",
		]),
	],
	"sun-moon": [
		box("Sun, Moon, Ultra Sun & Ultra Moon: Quick Setup", [
			"Allies called in SOS battles give double EVs. Adrenaline Orbs make wild Pokémon call for help more often (in Ultra Sun/Ultra Moon they only call once per battle without one).",
			"Power Items now add +8 EVs per KO; they cost 16 BP at the Battle Royal Dome. The Macho Brace isn't obtainable.",
			"Isle Evelup in Poké Pelago trains boxed Pokémon passively, and Festival Plaza Bouncy Houses and Food Stalls can adjust EVs.",
		]),
		box("Shopping Notes", [
			"Buy vitamins at the Mount Hokulani Poké Mart for 10,000 Pokédollars each.",
			"EV-reducing berries come from the berry piles on Route 10.",
			"Keep a False Swipe user with lots of PP to maintain SOS chains easily; press Y on the Summary screen to see the EV graph.",
		]),
	],
	"lets-go": [
		box("Let's Go (LGPE): Awakening Values (AVs)", [
			"There are no EVs: stats grow through Awakening Values, up to 200 in each stat.",
			"Every level-up adds 1 AV to a random stat; Candy raises the stat you choose.",
			"Vitamins, Feathers, Power Items and Pokérus aren't part of these games.",
		]),
		box("AV Candy and how to get it", [
			"Stat Candy: Health (HP), Mighty (Attack), Tough (Defense), Smart (Sp. Atk), Courage (Sp. Def) and Quick (Speed), each also in L and XL sizes.",
			"Each use adds 1 AV, but higher AVs need more Candy; larger sizes count for more, and past certain AV thresholds only the larger sizes work.",
			"Get Candy by catching wild Pokémon (longer Catch Combos give more and bigger Candy) or by transferring Pokémon to Professor Oak; species Candy raises all of that Pokémon's AVs by 1.",
		]),
	],
	"legends-arceus": [
		box("Legends: Arceus: Effort Levels (ELs)", [
			"Stats use Effort Levels (0–10 per stat) instead of EVs. Starting ELs come from IVs: IV 20–25 gives EL 1, 26–30 gives EL 2 and 31 gives EL 3.",
			"Each EL adds a bonus straight onto the stat, scaled by the Pokémon's base stat and level.",
			"Natures still modify stats. Battles still award hidden EVs, but they only matter after a transfer via HOME, and ELs don't carry over.",
			"ELs are raised only by using Grit items.",
		]),
		box("How to get Grit", [
			"Defeat wild Pokémon in battle; alpha Pokémon are the best source.",
			"Release Pokémon from your pastures (mass releases add up quickly).",
			"Trade 10 of one Grit tier for 1 of the next with Zisu at the training grounds in Jubilife Village.",
			"Many requests and missions also reward Grit.",
		]),
	],
	"sword-shield": [
		box("Sword & Shield: Quick Setup", [
			`${GEN8_VITAMINS} Buy them at Wyndon's southern Poké Mart or for 2 BP in Hammerlocke.`,
			"Power Items (+8 EVs per KO) and the Macho Brace cost 10 BP at Hammerlocke's BP shop.",
			"Every party member gains EXP and EVs, so bench anyone already trained. Max Raid Battles give no EVs, but Hammerlocke University seminars (Poké Jobs) raise EVs while you're away.",
		]),
		box("Fast Cash & BP", [
			"Earn BP at the Battle Tower in Wyndon and spend it at Hammerlocke's BP shop.",
			"Rematch the Champion Cup at Wyndon Stadium for big prize money; an Amulet Coin or G-Max Gold Rush adds more.",
			"Farm Max Raid dens for Watts and pay the Digging Duo at Bridge Field (across from the Nursery) 500 Watts to dig up items such as Bottle Caps.",
		]),
	],
	"brilliant-diamond-shining-pearl": [
		box("Brilliant Diamond & Shining Pearl: Quick Setup", [
			GEN8_VITAMINS,
			"Power Items (+8 EVs per KO) cost 10 BP at the Battle Park's Exchange Service Corner; the Macho Brace is found in Pastoria City. Wings/Feathers aren't available.",
			"Use Poké Radar chains or Grand Underground hideaways to isolate single-stat species.",
		]),
		box("Shopping Notes", [
			"Vitamins are sold at Veilstone Department Store.",
			"EV-reducing berries come from the Berry Master's house on Route 208 or are picked up by walking Pokémon.",
			"Press X on the Summary screen to see the EV graph, and use the Pokétch Counter app to track KOs.",
		]),
	],
	"scarlet-violet": [
		box("Scarlet & Violet: Quick Start", [
			"Power Items add +8 EVs; 1 EV foes give 9 EVs total, so 28 KOs hits 252.",
			"2 EV foes (e.g., Cyclizar) give 10 EVs; only 26 KOs needed.",
			"Your whole party gains EVs from battles, so box anything you don't want training.",
			"Let's Go auto battles (R button) give no EVs; battle manually.",
			`${GEN8_VITAMINS} Pokérus doesn't work in Scarlet & Violet.`,
		]),
		box("Shop Cheat Sheet", [
			"Power Items: Delibird Presents (Mesagoza/Levincia/Cascarrafa) for 10,000₽.",
			"Vitamins: Chansey Supply for 10,000₽ each once you have 3 Gym Badges.",
			"Feathers & EV-reducing berries: Porto Marinada auctions, Tera Raid Battles and sparkling overworld items.",
			"Press L on the moves-and-stats screen to see the EV graph; a Fresh-Start Mochi (The Teal Mask) resets all EVs.",
		]),
	],
	"legends-za": [
		box("Legends: Z-A: EV Training", [
			"Farm EVs by battling in Wild Zones. Each Wild Zone mixes several species, so pick zones where your target stat dominates.",
			"Vitamins are sold at every Pokémon Center (5,000₽ each) and work up to 252; Power Items come from Side Mission 072 or Quasartico Inc. (180 Mega Shards).",
			"Smashing Mega Crystals gives Exp. but no EVs, even with a Power Item.",
			"Lady Clear in the Rust Syndicate Office lobby resets EVs for 5 Mega Shards; EV-reducing berries are sold in Magenta Sector 1, Magenta Sector 6 and Jaune Plaza.",
			"Feathers are only available with the Mega Dimension DLC (Vert Sector 7, 60 Mega Shards).",
		]),
	],
};
GUIDES.platinum = GUIDES["diamond-pearl"];
GUIDES["ultra-sun-ultra-moon"] = GUIDES["sun-moon"];

/* ------------------------------------------------------------------------- go-to targets */

// One entry per species group: `ev` is the per-KO yield of every species in `species`.
// Yields: Bulbapedia's per-generation EV yield lists (cross-checked with PokeAPI). Locations:
// PokeAPI encounter data (Gen III-VI) and Bulbapedia location pages (Gen VII-IX).
const t = (stat, ev, species, location) => ({ stat, ev, species, location });

const TARGETS_BY_GAME = {
	"ruby-sapphire-emerald": [
		t("HP", 1, ["whismur"], "Rusturf Tunnel"),
		t("Attack", 1, ["shuppet"], "Mt. Pyre (Sapphire/Emerald)"),
		t("Defense", 1, ["aron"], "Granite Cave B1F/B2F"),
		t("Sp. Atk", 1, ["spinda"], "Route 113"),
		t("Sp. Def", 1, ["tentacool"], "Surfing on most Hoenn sea routes"),
		t("Speed", 1, ["zubat"], "Meteor Falls / Granite Cave"),
	],
	"firered-leafgreen": [
		t("HP", 2, ["jigglypuff"], "Route 3"),
		t("Attack", 1, ["mankey"], "Route 22"),
		t("Attack", 2, ["primeape"], "Route 23 / Victory Road"),
		t("Defense", 1, ["geodude", "onix"], "Victory Road"),
		t("Sp. Atk", 1, ["gastly"], "Pokémon Tower"),
		t("Sp. Def", 1, ["tentacool"], "Routes 19–21 (surf)"),
		t("Speed", 1, ["diglett"], "Diglett's Cave"),
		t("Speed", 2, ["dugtrio"], "Diglett's Cave"),
	],
	"heartgold-soulsilver": [
		t("HP", 1, ["wooper"], "Union Cave 1F/B1F (surf)"),
		t("HP", 2, ["quagsire"], "Union Cave 1F/B1F (surf)"),
		t("Attack", 1, ["mankey"], "Route 42 (HeartGold)"),
		t("Attack", 1, ["machop"], "Mt. Mortar"),
		t("Defense", 1, ["geodude"], "Route 45"),
		t("Defense", 2, ["graveler"], "Route 45"),
		t("Sp. Atk", 1, ["gastly"], "Sprout/Bell Tower (night)"),
		t("Sp. Def", 1, ["tentacool"], "Route 41 (surf)"),
		t("Sp. Def", 2, ["tentacruel"], "Route 41 (surf)"),
		t("Speed", 1, ["diglett"], "Diglett's Cave"),
		t("Speed", 2, ["pidgeotto"], "Route 43 (morning/day)"),
	],
	"diamond-pearl": [
		t("HP", 1, ["wooper"], "Great Marsh"),
		t("HP", 2, ["quagsire"], "Great Marsh"),
		t("Attack", 2, ["gyarados"], "Super Rod (e.g. Route 218)"),
		t("Attack", 2, ["bibarel"], "Route 209"),
		t("Defense", 1, ["geodude"], "Iron Island"),
		t("Defense", 2, ["graveler"], "Iron Island"),
		t("Sp. Atk", 1, ["gastly"], "Old Chateau"),
		t("Sp. Def", 2, ["tentacruel"], "Route 223 (surf)"),
		t("Speed", 1, ["starly"], "Route 201"),
		t("Speed", 2, ["staravia"], "Route 209 / Route 212 north (day)"),
	],
	"black-white": [
		t("HP", 2, ["audino"], "Shaking grass (e.g. Routes 1–3)"),
		t("Attack", 1, ["lillipup"], "Route 1 (grass)"),
		t("Attack", 2, ["herdier"], "Route 1 dark grass (west, needs Surf)"),
		t("Defense", 1, ["roggenrola"], "Wellspring Cave"),
		t("Sp. Atk", 1, ["litwick", "elgyem"], "Celestial Tower"),
		t("Sp. Def", 1, ["frillish"], "Driftveil City / Route 17 (surf)"),
		t("Speed", 2, ["basculin"], "Surfing or fishing (e.g. Route 3)"),
	],
	"black-2-white-2": [
		t("HP", 2, ["audino"], "Shaking grass (Floccesy Ranch)"),
		t("Attack", 1, ["sandile"], "Desert Resort / Route 4"),
		t("Defense", 2, ["swadloon"], "Lostlorn Forest"),
		t("Sp. Atk", 1, ["litwick", "elgyem"], "Celestial Tower"),
		t("Sp. Def", 1, ["frillish"], "Route 4 (surf)"),
		t("Sp. Def", 2, ["jellicent"], "Humilau City (rippling water)"),
		t("Speed", 2, ["basculin"], "Surfing or fishing (e.g. Floccesy Ranch)"),
	],
	"x-y": [
		t("HP", 1, ["gulpin"], "Route 5 (hordes)"),
		t("Attack", 1, ["bellsprout"], "Route 14 (hordes)"),
		t("Attack", 2, ["weepinbell"], "Route 19 (hordes)"),
		t("Defense", 1, ["nosepass"], "Route 10 (hordes)"),
		t("Defense", 2, ["durant"], "Terminus Cave (hordes)"),
		t("Sp. Atk", 1, ["vanillite"], "Frost Cavern (hordes)"),
		t("Sp. Def", 1, ["hoppip"], "Route 7 (hordes)"),
		t("Speed", 1, ["wingull"], "Route 8 / Azure Bay (hordes)"),
		t("Speed", 2, ["floatzel"], "Victory Road (hordes)"),
	],
	"omega-ruby-alpha-sapphire": [
		t("HP", 1, ["whismur"], "Rusturf Tunnel (hordes)"),
		t("Attack", 1, ["shuppet"], "Mt. Pyre interior (hordes)"),
		t("Defense", 1, ["sandshrew"], "Route 111 desert (hordes)"),
		t("Sp. Atk", 1, ["spinda"], "Route 113 (hordes)"),
		t("Sp. Def", 1, ["swablu"], "Route 115 (hordes)"),
		t("Speed", 1, ["zubat"], "Meteor Falls (hordes)"),
	],
	"sun-moon": [
		t("HP", 1, ["caterpie"], "Route 1"),
		t("Attack", 1, ["yungoos"], "Route 1 (day)"),
		t("Defense", 1, ["roggenrola"], "Ten Carat Hill"),
		t("Sp. Atk", 1, ["gastly"], "Hau'oli Cemetery"),
		t("Sp. Def", 1, ["dewpider"], "Brooklet Hill (day)"),
		t("Speed", 1, ["zubat"], "Verdant Cavern"),
	],
	"sword-shield": [
		t("HP", 2, ["wobbuffet", "diggersby", "noctowl"], "Hammerlocke Hills / Giant's Cap"),
		t("Attack", 2, ["perrserker"], "Route 7"),
		t("Defense", 2, ["torkoal", "carkol"], "Giant's Cap (harsh sunlight)"),
		t("Sp. Atk", 2, ["maractus"], "Route 6 / Stony Wilderness (harsh sunlight)"),
		t("Sp. Def", 1, ["duskull"], "Watchtower Ruins"),
		t("Speed", 2, ["liepard", "galvantula"], "Route 7"),
	],
	"brilliant-diamond-shining-pearl": [
		t("HP", 1, ["wooper"], "Route 212 south (surf)"),
		t("HP", 2, ["quagsire"], "Route 212 south (surf)"),
		t("Attack", 2, ["gyarados"], "Super Rod (e.g. Route 218)"),
		t("Attack", 2, ["bibarel"], "Route 209"),
		t("Defense", 1, ["geodude"], "Iron Island"),
		t("Defense", 2, ["graveler"], "Iron Island"),
		t("Sp. Atk", 1, ["gastly"], "Old Chateau / Lost Tower"),
		t("Sp. Def", 2, ["tentacruel"], "Route 223 (surf)"),
		t("Speed", 1, ["starly"], "Route 201"),
		t("Speed", 2, ["staravia"], "Route 209 / Route 212 north"),
	],
	// The Scarlet/Violet maps already name the area, so these entries carry no location text.
	"scarlet-violet": [
		t("HP", 2, ["gastrodon"]),
		t("HP", 3, ["azumarill"]),
		t("Attack", 2, ["heracross", "bisharp", "lokix"]),
		t("Attack", 3, ["luxray"]),
		t("Defense", 1, ["bergmite"]),
		t("Defense", 2, ["avalugg", "slowbro"]),
		t("Sp. Atk", 2, ["flaaffy", "girafarig"]),
		t("Sp. Def", 1, ["swablu"]),
		t("Sp. Def", 2, ["sliggoo", "altaria"]),
		t("Speed", 1, ["murkrow", "deerling", "rookidee", "wattrel"]),
		t("Speed", 2, ["corvisquire", "cyclizar"]),
	],
	"legends-za": [
		t("HP", 1, ["snorunt"], "Wild Zone 12"),
		t("HP", 2, ["gogoat"], "Wild Zone 12"),
		t("Attack", 1, ["scyther", "phantump"], "Wild Zone 13"),
		t("Attack", 2, ["weepinbell", "pinsir", "heracross"], "Wild Zone 13"),
		t("Defense", 1, ["onix", "aron"], "Wild Zone 14"),
		t("Defense", 2, ["lairon"], "Wild Zone 14"),
		t("Sp. Atk", 2, ["lampent", "pyroar"], "Wild Zone 17"),
		t("Sp. Def", 1, ["swablu"], "Wild Zone 18"),
		t("Sp. Def", 2, ["altaria"], "Wild Zone 18"),
		t("Speed", 1, ["espurr"], "Wild Zone 3"),
		t("Speed", 2, ["pikachu"], "Wild Zone 3"),
	],
};
TARGETS_BY_GAME.platinum = TARGETS_BY_GAME["diamond-pearl"];
TARGETS_BY_GAME["ultra-sun-ultra-moon"] = TARGETS_BY_GAME["sun-moon"];

// Map screenshots exist for these games; Scarlet/Violet screenshots already show the area name.
const MAP_FOLDERS = {
	"scarlet-violet": "scarletviolet",
	"legends-za": "legendsza",
	"sword-shield": "swordshield",
};
const MAP_FILE_BY_STAT = {
	HP: "hp",
	Attack: "attack",
	Defense: "defense",
	"Sp. Atk": "spattack",
	"Sp. Def": "spdef",
	Speed: "speed",
};
const SHOW_LOCATION_PILL = new Set(["legends-za", "sword-shield"]);

/* -------------------------------------------------------------------------------- stats */

const STATS = [
	{ key: "HP", short: "HP", full: "HP" },
	{ key: "Attack", short: "Atk", full: "Attack" },
	{ key: "Defense", short: "Def", full: "Defense" },
	{ key: "Sp. Atk", short: "SpA", full: "Sp. Atk" },
	{ key: "Sp. Def", short: "SpD", full: "Sp. Def" },
	{ key: "Speed", short: "Spe", full: "Speed" },
];
const EMPTY_SPREAD = Object.fromEntries(STATS.map((s) => [s.key, 0]));
const MAX_PER_STAT = 252;
const MAX_TOTAL = 510;

const SYSTEM_LABEL = { statexp: "Stat Experience", ev: "Effort Values", av: "Awakening Values", el: "Effort Levels" };

/** One line for the cartridge: the stat system and its caps in the chosen game. */
function capsSummary(rules) {
	if (!rules) return "General rules · 510 EVs total · 252 per stat";
	if (rules.system === "statexp") return "Stat Exp · up to 65,535 per stat";
	if (rules.system === "av") return "AVs · up to 200 per stat";
	if (rules.system === "el") return "Effort Levels · 0–10 per stat";
	return `EVs · 510 total · ${perStatCap(rules.gen)} per stat`;
}

const kosTo = (goal, perKo) => Math.ceil(goal / perKo);

/* ------------------------------------------------------------------------------ sprites */

const SLUG_TO_NATIONAL_ID = new Map(
	Object.entries(NATIONAL_ID_TO_SLUG).map(([id, slug]) => [slug, Number(id)])
);

function Mon({ name }) {
	const id = SLUG_TO_NATIONAL_ID.get(String(name || "").toLowerCase().trim());
	return (
		<li className="evt-mon">
			{Number.isFinite(id) ? (
				<SpriteImage id={id} alt="" width={48} height={48} loading="lazy" className="evt-mon__sprite" />
			) : (
				<span className="evt-mon__sprite evt-mon__sprite--none" aria-hidden="true" />
			)}
			<span className="evt-mon__name">{formatPokemonName(name)}</span>
		</li>
	);
}

/* --------------------------------------------------------------------------------- maps */

function TrainingMap({ src, statLabel, onOpen, yields, place }) {
	const label = `${statLabel} EV training map`;
	return (
		<figure className="evt-map">
			<button type="button" className="evt-map__open" onClick={() => onOpen({ src, label })} aria-label={`Enlarge ${label}`}>
				<img className="evt-map__img" src={src} alt={label} loading="lazy" />
				<span className="evt-map__zoom" aria-hidden="true">
					<Icon name="search" />
				</span>
			</button>
			{place ? <figcaption className="evt-map__chip evt-map__place">{place}</figcaption> : null}
			{yields.length ? (
				<div className="evt-map__yields" aria-hidden="true">
					{yields.map((text) => (
						<span key={text} className="evt-map__chip">
							{text}
						</span>
					))}
				</div>
			) : null}
		</figure>
	);
}

/** The enlarged map: a framed viewer over the page. Escape, the close button or the backdrop closes it. */
function MapViewer({ map, onClose }) {
	const closeRef = useRef(null);
	useEffect(() => {
		const previouslyFocused = document.activeElement;
		closeRef.current?.focus();
		const onKeyDown = (event) => {
			if (event.key === "Escape") {
				event.preventDefault();
				onClose();
			} else if (event.key === "Tab") {
				// The close button is the only focusable element: keep focus inside the dialog.
				event.preventDefault();
				closeRef.current?.focus();
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			if (previouslyFocused && typeof previouslyFocused.focus === "function") previouslyFocused.focus();
		};
	}, [onClose]);
	return createPortal(
		<>
			<div className="scrim" onClick={onClose} aria-hidden="true" />
			<div className="sheet evt-viewer" role="dialog" aria-modal="true" aria-label={map.label}>
				<div className="popsheet__head">
					<h2 className="popsheet__title">{map.label}</h2>
					<button ref={closeRef} type="button" className="btn btn--quiet btn--icon btn--sm" onClick={onClose} aria-label="Close map">
						<Icon name="close" />
					</button>
				</div>
				<div className="evt-viewer__body">
					<img src={map.src} alt={map.label} />
				</div>
			</div>
		</>,
		document.body
	);
}

/* ------------------------------------------------------------------------ where to train */

const uniqueStrings = (values) => Array.from(new Set(values.map((v) => String(v || "").trim()).filter(Boolean)));

function StatGroup({ group, mapSrc, showPlace, bonus, goal, onOpenMap }) {
	// Lowest yield first; a stable sort keeps the data's order within one yield
	const entries = [...group.list].sort((a, b) => a.ev - b.ev);
	const evValues = uniqueStrings(entries.map((it) => it.ev)).map(Number);
	// On a map, the lower yield's area is on the left and the higher one's on the right
	const yields = mapSrc && evValues.length <= 2 ? evValues.map((ev) => `+${ev} ${group.key}`) : [];
	const place = mapSrc && showPlace ? uniqueStrings(entries.map((it) => it.location)).join(" / ") : "";
	const headId = `evt-stat-${group.short.toLowerCase()}`;

	return (
		<section className="evt-stat" aria-labelledby={headId}>
			<h3 className="evt-stat__head" id={headId}>
				{group.key}
			</h3>
			{mapSrc ? <TrainingMap src={mapSrc} statLabel={group.key} onOpen={onOpenMap} yields={yields} place={place} /> : null}
			<ul className="evt-targets">
				{entries.map((it) => (
					<li key={`${it.ev}-${it.species.join("-")}`} className="evt-target">
						<p className="evt-target__yield">
							<span className="evt-target__num">+{it.ev}</span>
							<span className="evt-target__stat">{group.short}</span>
							<span className="sr-only"> {group.key} EVs per Pokémon defeated</span>
						</p>
						<div className="evt-target__body">
							<ul className="evt-mons">
								{it.species.map((name) => (
									<Mon key={name} name={name} />
								))}
							</ul>
							{!place && it.location ? (
								<p className="evt-target__where">
									<Icon name="pin" />
									<span>{it.location}</span>
								</p>
							) : null}
							<p className="evt-target__kos">
								<span className="num">{kosTo(goal, it.ev)}</span> KOs to {goal}
								{bonus ? (
									<>
										{" · "}
										<span className="num">{kosTo(goal, it.ev + bonus)}</span> with a Power Item
									</>
								) : null}
							</p>
						</div>
					</li>
				))}
			</ul>
		</section>
	);
}

function WhereToTrain({ gameKey, rules, focus, onFocus, spread, onOpenMap }) {
	const items = TARGETS_BY_GAME[gameKey];
	if (!items || items.length === 0) return null;
	const mapFolder = MAP_FOLDERS[gameKey];
	const showPlace = SHOW_LOCATION_PILL.has(gameKey);
	const bonus = getPowerItemBonus(rules?.gen);
	const mapSrcFor = (stat) => (mapFolder && MAP_FILE_BY_STAT[stat] ? `/maps/${mapFolder}/${MAP_FILE_BY_STAT[stat]}.webp` : null);
	const groups = STATS.map((s) => ({ ...s, list: items.filter((it) => it.stat === s.key) })).filter((g) => g.list.length > 0);
	const shown = focus ? groups.filter((g) => g.key === focus) : groups;

	return (
		<section className="win evt-where evt-slot--where" aria-labelledby="evt-where-title">
			<div className="win__head">
				<h2 className="win__title" id="evt-where-title">
					Where to train
				</h2>
			</div>
			<div className="win__body">
				<div className="seg evt-stats" role="group" aria-label="Show spots for">
					<button type="button" className="seg__btn" aria-pressed={!focus} onClick={() => onFocus(null)}>
						All
					</button>
					{STATS.map((s) => (
						<button
							key={s.key}
							type="button"
							className="seg__btn"
							aria-pressed={focus === s.key}
							aria-label={s.short === s.full ? s.full : `${s.short} (${s.full})`}
							onClick={() => onFocus(s.key)}
						>
							{s.short}
						</button>
					))}
				</div>
				{shown.length === 0 ? (
					<p className="evt-none">No go-to spot is listed for {focus} in this game.</p>
				) : (
					shown.map((group) => (
						<StatGroup
							key={group.key}
							group={group}
							mapSrc={mapSrcFor(group.key)}
							showPlace={showPlace}
							bonus={bonus}
							goal={spread[group.key] > 0 ? spread[group.key] : MAX_PER_STAT}
							onOpenMap={onOpenMap}
						/>
					))
				)}
			</div>
		</section>
	);
}

/* --------------------------------------------------------------------------- spread plan */

function SpreadPlanner({ spread, setSpread, focus }) {
	const total = STATS.reduce((sum, s) => sum + spread[s.key], 0);
	const setStat = (key, raw) => {
		setSpread((prev) => {
			const others = STATS.reduce((sum, s) => (s.key === key ? sum : sum + prev[s.key]), 0);
			const room = Math.max(0, MAX_TOTAL - others);
			const value = Math.floor(Math.min(Number(raw) || 0, room, MAX_PER_STAT) / 4) * 4;
			return prev[key] === value ? prev : { ...prev, [key]: value };
		});
	};

	return (
		<section className="win evt-spread evt-slot--spread" aria-labelledby="evt-spread-title">
			<div className="win__head">
				<h2 className="win__title" id="evt-spread-title">
					Plan a spread
				</h2>
				<button type="button" className="btn btn--quiet btn--sm" onClick={() => setSpread(EMPTY_SPREAD)} disabled={total === 0}>
					Clear
				</button>
			</div>
			<div className="win__body">
				<ul className="evt-meters">
					{STATS.map((s) => {
						const value = spread[s.key];
						const gain = Math.floor(value / 4);
						return (
							<li
								key={s.key}
								className={`meter evt-meter${focus === s.key ? " is-focus" : ""}`}
								style={{ "--pct": (value / MAX_PER_STAT) * 100 }}
							>
								<span className="meter__label">
									<Cursor className="evt-meter__cursor" />
									{s.short}
								</span>
								<span className="meter__value">{value}</span>
								<span className="evt-meter__slider">
									<span className="meter__track" aria-hidden="true">
										<span className="meter__fill" />
									</span>
									<input
										type="range"
										className="evt-meter__input"
										min={0}
										max={MAX_PER_STAT}
										step={4}
										value={value}
										onChange={(event) => setStat(s.key, event.target.value)}
										aria-label={`${s.full} EVs`}
										aria-valuetext={`${value} EVs, +${gain} ${s.full} at level 100`}
									/>
								</span>
								<span className="evt-meter__gain">+{gain}</span>
							</li>
						);
					})}
				</ul>
				<div className="meter evt-meter evt-meter--total" style={{ "--pct": (total / MAX_TOTAL) * 100 }}>
					<span className="meter__label">Total</span>
					<span className="meter__value">{total}</span>
					<span className="evt-meter__slider">
						<span className="meter__track" aria-hidden="true">
							<span className="meter__fill" />
						</span>
					</span>
					<span className="evt-meter__gain">
						{MAX_TOTAL - total} left
					</span>
				</div>
				<p className="evt-note">
					Drag a bar to plan: each stat counts up to 252 and all six share 510. +N is the stat gain at level 100 (4 EVs = 1
					point). Where to train counts KOs to these numbers, or to 252 for a stat left at 0.
				</p>
			</div>
		</section>
	);
}

/* -------------------------------------------------------------------------- items panel */

// Columns for the items window, based on what exists in the selected game.
function getItemColumns(rules) {
	if (rules && rules.system !== "ev" && rules.system !== "statexp") return [];
	const gen = rules?.gen ?? null;
	const columns = [];

	if (rules?.system === "statexp") {
		columns.push({
			title: "Vitamins",
			note: "Refused once that stat has 25,600 Stat Exp.",
			entries: EV_PANEL_VITAMINS.filter((v) => !v.introduced || v.introduced <= gen).map((v) => ({
				name: v.name,
				image: v.image,
				stat: v.stat,
				effect: `+2,560 ${v.statGen1to2 || v.stat} Stat Exp`,
			})),
		});
		return columns;
	}

	columns.push({
		title: "Vitamins",
		note: gen == null
			? "Gen 3–7: refused once the stat has 100 EVs. Gen 8+: works up to 252."
			: gen >= 8
				? "Works all the way to 252 EVs."
				: "Refused once that stat has 100 EVs.",
		entries: EV_PANEL_VITAMINS.map((v) => ({ name: v.name, image: v.image, stat: v.stat, effect: `+10 ${v.stat}` })),
	});

	if (gen == null || rules.feathers) {
		const useWings = gen != null && gen <= 7;
		columns.push({
			title: useWings ? "Wings" : "Feathers",
			note: rules?.feathers === "dlc" ? "Mega Dimension DLC only." : gen == null ? "Called Wings before Sword & Shield (Gen 5+)." : null,
			entries: EV_PANEL_FEATHERS.map((f) => ({ name: useWings ? f.wingName : f.name, image: f.image, stat: f.stat, effect: `+1 ${f.stat}` })),
		});
	}

	const bonus = gen == null ? 8 : getPowerItemBonus(gen);
	if (bonus) {
		columns.push({
			title: "Power Items",
			note: gen == null ? "Per KO; +4 in Gen 4–6." : "Per Pokémon defeated, on top of its yield.",
			entries: EV_PANEL_POWER_ITEMS.map((p) => ({ name: p.name, image: p.image, stat: p.stat, effect: `+${bonus} ${p.stat}` })),
		});
	}
	return columns;
}

function EvItems({ rules, focus }) {
	const columns = getItemColumns(rules);
	if (columns.length === 0) return null;
	return (
		<section className="win evt-items evt-slot--items" aria-labelledby="evt-items-title">
			<div className="win__head">
				<h2 className="win__title" id="evt-items-title">
					{rules?.system === "statexp" ? "Stat Exp items" : "EV items"}
				</h2>
			</div>
			<div className="win__body evt-items__body">
				{columns.map((column) => (
					<section key={column.title} className="evt-items__group" aria-label={column.title}>
						<h3 className="evt-items__title">{column.title}</h3>
						{column.note ? <p className="evt-note">{column.note}</p> : null}
						<ul className="evt-item-list">
							{column.entries.map((entry) => (
								<li key={entry.name} className={`evt-item${focus && entry.stat === focus ? " is-focus" : ""}`}>
									<Cursor className="evt-item__cursor" />
									<img className="evt-item__icon" src={entry.image} alt="" width={24} height={24} loading="lazy" />
									<span className="evt-item__name">{entry.name}</span>
									<span className="evt-item__effect">{entry.effect}</span>
								</li>
							))}
						</ul>
					</section>
				))}
			</div>
		</section>
	);
}

function GritItems() {
	return (
		<section className="win evt-items evt-slot--items" aria-labelledby="evt-grit-title">
			<div className="win__head">
				<h2 className="win__title" id="evt-grit-title">
					Grit items
				</h2>
			</div>
			<div className="win__body">
				<ul className="evt-item-list">
					{GRIT_ITEMS.map((item) => (
						<li key={item.name} className="evt-item evt-item--grit">
							<span className="evt-item__well">
								<img className="evt-item__icon" src={item.image} alt="" width={24} height={24} loading="lazy" />
							</span>
							<span className="evt-item__text">
								<span className="evt-item__name">{item.name}</span>
								<span className="evt-item__effect">{item.effect}</span>
							</span>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}

/* ------------------------------------------------------------------------ guide windows */

function GuideWindows({ gameKey }) {
	const boxes = GUIDES[gameKey];
	if (!boxes) return null;
	return (
		<div className="evt-guide evt-slot--guide">
			{boxes.map((guideBox, index) => (
				<section key={guideBox.title} className="win evt-box" aria-labelledby={`evt-guide-${index}`}>
					<div className="win__head">
						<h2 className="win__title" id={`evt-guide-${index}`}>
							{guideBox.title}
						</h2>
					</div>
					<div className="win__body">
						<ul className="evt-list">
							{guideBox.items.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
					</div>
				</section>
			))}
		</div>
	);
}

/* --------------------------------------------------------------------------- game picker */

function PickerOption({ game, selected, onPick }) {
	const rules = game ? GAME_RULES[game.key] : null;
	const title = game ? game.label : "All games";
	const sub = game ? [regionLabel(game), SYSTEM_LABEL[rules?.system]].filter(Boolean).join(" · ") : "General EV rules";
	return (
		<li>
			<button type="button" className="cart-option" aria-pressed={selected} onClick={() => onPick(game ? game.key : null)}>
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

function EvGamePicker({ open, onClose, anchorRef, selectedGame, onPick }) {
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
					<PickerOption game={null} selected={!selectedGame} onPick={pick} />
				</ul>
				{GAME_GROUPS.map((group) => (
					<section key={group.gen} className="cart-group" aria-label={group.label}>
						<h3 className="cart-group__label">{group.label}</h3>
						<ul className="cart-list">
							{group.games.map((game) => (
								<PickerOption key={game.key} game={game} selected={selectedGame === game.key} onPick={pick} />
							))}
						</ul>
					</section>
				))}
			</div>
		</Sheet>
	);
}

/* --------------------------------------------------------------------------------- page */

export default function EvTrainingPage() {
	// Starts on the game picked on the Pokédex (the cartridge is shared across the site)
	const [selectedGame, setSelectedGameState] = useState(() => readGamePreference());
	const setSelectedGame = useCallback((key) => {
		setSelectedGameState(key || null);
		writeGamePreference(key || null);
	}, []);
	const [openMap, setOpenMap] = useState(null);
	const [pickerOpen, setPickerOpen] = useState(false);
	const [focus, setFocus] = useState(null);
	const [spread, setSpread] = useState(EMPTY_SPREAD);
	const cartRef = useRef(null);

	const rules = selectedGame ? GAME_RULES[selectedGame] || null : null;
	const game = selectedGame ? GAME_LOOKUP.get(selectedGame) || null : null;
	const isLegendsArceus = rules?.system === "el";
	const showEvBasics = !rules || rules.system === "ev";
	const hasTargets = Boolean(selectedGame && TARGETS_BY_GAME[selectedGame]?.length);
	// The stat focus only applies where the game lists training spots
	const activeFocus = hasTargets ? focus : null;

	const closeMap = useCallback(() => setOpenMap(null), []);
	const closePicker = useCallback(() => setPickerOpen(false), []);
	const openPicker = () => setPickerOpen(true);

	return (
		<main className="evt">
			<h1 className="sr-only">EV Training</h1>
			<div className="strip evt-strip">
				<div className="strip__row">
					<button
						ref={cartRef}
						type="button"
						className="cart"
						aria-haspopup="dialog"
						aria-expanded={pickerOpen}
						onClick={openPicker}
					>
						<CartLogos game={game} />
						<span className="cart__text">
							<span className="cart__title">{game ? game.label : "All games"}</span>
							<span className="cart__sub">{capsSummary(rules)}</span>
						</span>
						<Icon name="down" className="cart__chevron" />
						<span className="sr-only">Change game</span>
					</button>
					{rules ? (
						<p className="evt-strip__system">
							<span className="label">Gen {ROMAN[rules.gen]}</span>
							{SYSTEM_LABEL[rules.system]}
						</p>
					) : null}
				</div>
			</div>

			<div className="evt-body">
				<div className="evt-col evt-col--main">
					{!selectedGame ? (
						<section className="win evt-prompt evt-slot--prompt" aria-labelledby="evt-prompt-title">
							<div className="empty">
								<h2 className="empty__title" id="evt-prompt-title">
									Choose your game
								</h2>
								<p>EV rules, training spots and where to buy items change from game to game. Pick the one you're playing.</p>
								<button type="button" className="btn" onClick={openPicker}>
									<Icon name="ball" />
									Choose game
								</button>
							</div>
						</section>
					) : null}
					{hasTargets ? (
						<WhereToTrain
							gameKey={selectedGame}
							rules={rules}
							focus={activeFocus}
							onFocus={setFocus}
							spread={spread}
							onOpenMap={setOpenMap}
						/>
					) : null}
					{selectedGame ? <GuideWindows gameKey={selectedGame} /> : null}
					{showEvBasics ? (
						<section className="win evt-box evt-slot--basics" aria-labelledby="evt-basics-title">
							<div className="win__head">
								<h2 className="win__title" id="evt-basics-title">
									EV basics
								</h2>
							</div>
							<div className="win__body">
								<ul className="evt-list">
									{getEvBasics(rules).map((item) => (
										<li key={item}>{item}</li>
									))}
								</ul>
							</div>
						</section>
					) : null}
				</div>
				<div className="evt-col evt-col--side">
					{showEvBasics ? <SpreadPlanner spread={spread} setSpread={setSpread} focus={activeFocus} /> : null}
					{isLegendsArceus ? <GritItems /> : <EvItems rules={rules} focus={activeFocus} />}
				</div>
			</div>

			<EvGamePicker
				open={pickerOpen}
				onClose={closePicker}
				anchorRef={cartRef}
				selectedGame={selectedGame}
				onPick={setSelectedGame}
			/>
			{openMap ? <MapViewer map={openMap} onClose={closeMap} /> : null}
		</main>
	);
}
