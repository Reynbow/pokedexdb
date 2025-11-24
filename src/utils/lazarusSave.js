const SECTION_TOTAL_SIZE = 0x1000;
const SECTION_DATA_SIZE = 0xF80;
const SECTION_ID_OFFSET = 0x0FF4;
const SAVE_INDEX_OFFSET = 0x0FFC;
const SAVE_SECTION_COUNT = 14;
const SAVE_BLOCK_ID = {
  TRAINER_INFO: 0,
  TEAM_ITEMS: 1,
};
// Emerald uses 52 bytes for owned/seen flags (NUM_DEX_FLAG_BYTES with NUM_SPECIES=412).
// Lazarus extends the dex, so derive the length from reference data and keep a sane floor.
const DEFAULT_DEX_FLAG_BYTES = 0x34;
// Lazarus National Dex currently goes well past 512 entries; 129 bytes covers IDs up to 1025.
const LAZARUS_MIN_DEX_FLAG_BYTES = 0x81;
// Observed Lazarus save layout: owned flags live inside SaveBlock1 around this offset.
const LAZARUS_POKEDEX_OWNED_OFFSET = 0x1B7; // decimal 439
const LAZARUS_POKEDEX_OWNED_OFFSET_FALLBACK = 0x1CF; // decimal 463 (second-best from sb2 heuristic)
// Newer Lazarus builds store the National Dex caught flags further into SaveBlock1 (after section merge).
// This offset (0x466) matches the provided sample saves when sections 1-4 are concatenated.
const LAZARUS_POKEDEX_OWNED_OFFSET_V2 = 0x466; // decimal 1126
const PARTY_COUNT_OFFSET = 0x234;
const PARTY_DATA_OFFSET = 0x238;
const PARTY_SLOT_SIZE = 100;
const BOX_SUBSTRUCT_OFFSET = 0x20;
const SUBSTRUCT_SIZE = 12;
const STATUS_OFFSET = 80;
const LEVEL_OFFSET = 84;
const HP_OFFSET = 86;
const MAX_HP_OFFSET = 88;
const ATTACK_OFFSET = 90;
const DEFENSE_OFFSET = 92;
const SPEED_OFFSET = 94;
const SP_ATTACK_OFFSET = 96;
const SP_DEFENSE_OFFSET = 98;
const PARTY_MAX_SIZE = 6;

const SUBSTRUCT_ORDERS = [
  [0, 1, 2, 3],
  [0, 1, 3, 2],
  [0, 2, 1, 3],
  [0, 3, 1, 2],
  [0, 2, 3, 1],
  [0, 3, 2, 1],
  [1, 0, 2, 3],
  [1, 0, 3, 2],
  [2, 0, 1, 3],
  [3, 0, 1, 2],
  [2, 0, 3, 1],
  [3, 0, 2, 1],
  [1, 2, 0, 3],
  [1, 3, 0, 2],
  [2, 1, 0, 3],
  [3, 1, 0, 2],
  [2, 3, 0, 1],
  [3, 2, 0, 1],
  [1, 2, 3, 0],
  [1, 3, 2, 0],
  [2, 1, 3, 0],
  [3, 1, 2, 0],
  [2, 3, 1, 0],
  [3, 2, 1, 0],
];

export function normalizeSpeciesSlug(value) {
  if (value == null) return "";
  return String(value)
    .toLowerCase()
    .replace(/\u2640|female/g, "-f")
    .replace(/\u2642|male/g, "-m")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function readUint16LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32LE(bytes, offset) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function writeUint32LE(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function interpretGen3Status(value) {
  if (!value) return "OK";
  const sleepCounter = value & 0x7;
  if (sleepCounter) return "SLP";
  if (value & 0x8) return "PSN";
  if (value & 0x10) return "BRN";
  if (value & 0x20) return "FRZ";
  if (value & 0x40) return "PAR";
  if (value & 0x80) return "PSN";
  return "OK";
}

function normalizeTypeName(value) {
  if (!value) return null;
  return value
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function collectSections(bytes) {
  const byIndex = new Map();
  for (let offset = 0; offset + SECTION_TOTAL_SIZE <= bytes.length; offset += SECTION_TOTAL_SIZE) {
    const sectionId = readUint16LE(bytes, offset + SECTION_ID_OFFSET);
    if (sectionId < 0 || sectionId >= SAVE_SECTION_COUNT) {
      continue;
    }
    const saveIndex = readUint32LE(bytes, offset + SAVE_INDEX_OFFSET);
    if (!byIndex.has(saveIndex)) {
      byIndex.set(saveIndex, new Map());
    }
    const sectionData = bytes.slice(offset, offset + SECTION_DATA_SIZE);
    byIndex.get(saveIndex).set(sectionId, sectionData);
  }
  if (byIndex.size === 0) {
    throw new Error("Unable to locate valid save sections.");
  }
  const latestIndex = Math.max(...byIndex.keys());
  return {
    saveIndex: latestIndex,
    sections: byIndex.get(latestIndex),
  };
}

function assembleSaveBlock1(sections) {
  // SaveBlock1 spans section IDs 1-4 (inclusive) in order.
  const parts = [];
  let totalLength = 0;
  for (let sectionId = 1; sectionId <= 4; sectionId++) {
    const part = sections.get(sectionId);
    const chunk = part instanceof Uint8Array ? part : new Uint8Array(SECTION_DATA_SIZE);
    parts.push(chunk);
    totalLength += chunk.length;
  }

  const merged = new Uint8Array(totalLength);
  let cursor = 0;
  for (const chunk of parts) {
    merged.set(chunk, cursor);
    cursor += chunk.length;
  }
  return merged;
}

function countSetBits(bytes) {
  let total = 0;
  for (let i = 0; i < bytes.length; i++) {
    let value = bytes[i];
    value = value - ((value >> 1) & 0x55);
    value = (value & 0x33) + ((value >> 2) & 0x33);
    total += ((value + (value >> 4)) & 0x0f) & 0x0f;
  }
  return total;
}

function readBit(bytes, index) {
  const byteIndex = Math.floor(index / 8);
  const bit = index % 8;
  if (byteIndex < 0 || byteIndex >= bytes.length) {
    return false;
  }
  // Bits are stored MSB-first within each byte.
  return ((bytes[byteIndex] >> (7 - bit)) & 1) !== 0;
}

function detectDexFlagLength(context) {
  const candidates = [];

  // Capture any National Dex IDs (preferred) plus Lazarus custom IDs from provided reference data.
  if (context?.recordsByNationalId instanceof Map) {
    for (const [key, record] of context.recordsByNationalId.entries()) {
      const numericKey = Number(key);
      if (Number.isFinite(numericKey)) {
        candidates.push(numericKey);
      }
      const recordNationalId = Number(record?.nationalId);
      if (Number.isFinite(recordNationalId)) {
        candidates.push(recordNationalId);
      }
      const recordId = Number(record?.id);
      if (Number.isFinite(recordId)) {
        candidates.push(recordId);
      }
    }
  }

  if (context?.recordsBySlug instanceof Map) {
    for (const record of context.recordsBySlug.values()) {
      const recordNationalId = Number(record?.nationalId);
      if (Number.isFinite(recordNationalId)) {
        candidates.push(recordNationalId);
      }
      const recordId = Number(record?.id);
      if (Number.isFinite(recordId)) {
        candidates.push(recordId);
      }
    }
  }

  if (context?.slugByNationalId instanceof Map) {
    for (const key of context.slugByNationalId.keys()) {
      const numericKey = Number(key);
      if (Number.isFinite(numericKey)) {
        candidates.push(numericKey);
      }
    }
  }

  if (candidates.length === 0) {
    return DEFAULT_DEX_FLAG_BYTES;
  }

  const maxId = Math.max(...candidates);
  const derivedLength = Math.ceil(maxId / 8);
  return Math.max(DEFAULT_DEX_FLAG_BYTES, LAZARUS_MIN_DEX_FLAG_BYTES, derivedLength);
}

function findOwnedFlagOffset(saveBytes, dexFlagBytes, knownSpecies = []) {
  const searchLimit = Math.max(0, saveBytes.length - dexFlagBytes);
  let bestOffset = 0;
  let bestScore = -Infinity;

  for (let offset = 0; offset + dexFlagBytes <= saveBytes.length; offset++) {
    const ownedSlice = saveBytes.subarray(offset, offset + dexFlagBytes);
    const seenSlice =
      offset + dexFlagBytes * 2 <= saveBytes.length
        ? saveBytes.subarray(offset + dexFlagBytes, offset + dexFlagBytes * 2)
        : null;

    const ownedBits = countSetBits(ownedSlice);
    const seenBits = seenSlice ? countSetBits(seenSlice) : 0;
    const knownMatches = knownSpecies.reduce((count, speciesId) => {
      if (!Number.isInteger(speciesId) || speciesId <= 0) return count;
      return readBit(ownedSlice, speciesId - 1) ? count + 1 : count;
    }, 0);

    // Skip obvious empty chunks unless they match known species (for new saves)
    if (ownedBits === 0 && knownMatches === 0) {
      continue;
    }

    // Prefer slices with party matches; otherwise choose the sparsest bitfield.
    const score = knownMatches * 5000 - ownedBits + seenBits * 0.5;
    if (score > bestScore) {
      bestScore = score;
      bestOffset = offset;
    }
  }

  return bestOffset;
}

function extractCaughtPokemonFromSource(flagsSource, dexFlagBytes, knownSpecies, preferredOffset) {
  const parseAt = (ownedOffset) => {
    const results = [];
    for (let i = 0; i < dexFlagBytes * 8; i++) {
      const byteIndex = Math.floor(i / 8);
      const bit = i % 8;
      const value = flagsSource[ownedOffset + byteIndex];
      if (((value >> (7 - bit)) & 1) === 0) {
        continue;
      }
      results.push(i + 1);
    }
    const bitCount = countSetBits(flagsSource.subarray(ownedOffset, ownedOffset + dexFlagBytes));
    const partyMatches = Array.isArray(knownSpecies)
      ? knownSpecies.reduce((count, id) => (results.includes(id) ? count + 1 : count), 0)
      : 0;
    return { results, bitCount, partyMatches, offset: ownedOffset };
  };

  const candidates = [];
  if (
    preferredOffset != null &&
    preferredOffset >= 0 &&
    preferredOffset + dexFlagBytes <= flagsSource.length
  ) {
    candidates.push(parseAt(preferredOffset));
  }

  const autoOffset = findOwnedFlagOffset(flagsSource, dexFlagBytes, knownSpecies);
  if (
    autoOffset != null &&
    autoOffset >= 0 &&
    autoOffset + dexFlagBytes <= flagsSource.length
  ) {
    candidates.push(parseAt(autoOffset));
  }

  return candidates.length > 0 ? candidates : [parseAt(Math.max(0, preferredOffset || 0))];
}

function scanFlagSources(flagSources, dexFlagBytes, knownSpecies) {
  const scored = [];
  flagSources.forEach(({ label, data }) => {
    if (!(data instanceof Uint8Array)) return;
    for (let offset = 0; offset + dexFlagBytes <= data.length; offset++) {
      const ownedSlice = data.subarray(offset, offset + dexFlagBytes);
      const bitCount = countSetBits(ownedSlice);
      if (bitCount === 0) continue;
      const partyMatches = Array.isArray(knownSpecies)
        ? knownSpecies.reduce((count, id) => (readBit(ownedSlice, id - 1) ? count + 1 : count), 0)
        : 0;
      const results = [];
      let minId = Number.MAX_SAFE_INTEGER;
      let maxId = 0;
      for (let i = 0; i < dexFlagBytes * 8; i++) {
        if (readBit(ownedSlice, i)) {
          results.push(i + 1);
          if (i + 1 < minId) minId = i + 1;
          if (i + 1 > maxId) maxId = i + 1;
        }
      }
      if (minId === Number.MAX_SAFE_INTEGER) {
        minId = 9999;
      }
      // Allow higher maxId values - Lazarus dex has 529 pokemon, and saves may use National Dex IDs
      // Only filter out obviously invalid results (e.g., maxId > 1025 which is beyond current National Dex)
      if (maxId > 1025) {
        continue;
      }
      // Calculate target bit count based on party matches
      // For new saves with few pokemon, expect very few bits
      // For saves with many pokemon, expect more bits
      const targetBits = partyMatches > 0 ? Math.max(partyMatches, bitCount > 10 ? 88 : 1) : (bitCount > 10 ? 88 : 1);
      // Litten has Lazarus custom ID 4 and National Dex ID 725
      // Check for both to support either ID system
      const littenLazarusId = 4;
      const littenNationalId = 725;
      let score = 0;
      // Heavily prioritize party member matches - if we have party members, they MUST be in caught list
      if (knownSpecies.length > 0) {
        if (partyMatches === 0) {
          // No party matches - heavily penalize (this is likely wrong)
          score -= 1000;
        } else {
          // Party matches found - heavily boost
          score += partyMatches * 100;
        }
      }
      // Penalize if bit count is way off from target
      score -= Math.abs(bitCount - targetBits) * 2;
      // Prefer results with reasonable bit counts (not too many, not too few)
      if (bitCount >= 1 && bitCount <= 200) {
        score += 10;
      } else if (bitCount > 200) {
        // Too many bits - likely false positive
        score -= 50;
      }
      if (minId <= 10) score += 5;
      // Boost score if Litten is found (either ID system)
      if (results.includes(littenLazarusId) || results.includes(littenNationalId)) score += 10;
      scored.push({ label, offset, bitCount, partyMatches, results, score, minId, maxId });
    }
  });
  if (scored.length === 0) {
    return { results: [], bitCount: 0, partyMatches: 0, offset: 0, label: "none", score: -Infinity };
  }
  // Litten has Lazarus custom ID 4 and National Dex ID 725
  // Check for both to support either ID system
  const littenLazarusId = 4;
  const littenNationalId = 725;
  const hasLitten = (results) => results.includes(littenLazarusId) || results.includes(littenNationalId);
  const littenCandidates = scored.filter((c) => hasLitten(c.results));

  // If the preferred fixed offset contains Litten and a reasonable bitcount, return it directly.
  const fixed = scored.find(
    (c) =>
      c.label === "block1" &&
      c.offset === LAZARUS_POKEDEX_OWNED_OFFSET &&
      hasLitten(c.results) &&
      c.bitCount > 0 &&
      c.bitCount <= 150
  );
  if (fixed) {
    return fixed;
  }

  if (littenCandidates.length > 0) {
    // Prioritize candidates that match party members
    const withPartyMatches = littenCandidates.filter((c) => c.partyMatches > 0);
    if (withPartyMatches.length > 0) {
      // Prefer results that match party members
      withPartyMatches.sort(
        (a, b) =>
          b.partyMatches - a.partyMatches ||
          Math.abs(a.bitCount - (a.partyMatches > 1 ? 88 : 1)) - Math.abs(b.bitCount - (b.partyMatches > 1 ? 88 : 1)) ||
          a.bitCount - b.bitCount ||
          a.offset - b.offset
      );
      return withPartyMatches[0];
    }
    // If no party matches, use original logic
    const littenTarget = (entry) => (entry.partyMatches > 1 || entry.bitCount > 10 ? 88 : 1);
    littenCandidates.sort(
      (a, b) =>
        Math.abs(a.bitCount - littenTarget(a)) - Math.abs(b.bitCount - littenTarget(b)) ||
        a.bitCount - b.bitCount ||
        b.partyMatches - a.partyMatches ||
        a.offset - b.offset
    );
    return littenCandidates[0];
  }
  // Prioritize results with party matches
  const withPartyMatches = scored.filter((c) => c.partyMatches > 0);
  if (withPartyMatches.length > 0) {
    withPartyMatches.sort((a, b) => b.score - a.score || b.partyMatches - a.partyMatches || a.bitCount - b.bitCount || a.offset - b.offset);
    return withPartyMatches[0];
  }
  // Fallback to best score if no party matches
  scored.sort((a, b) => b.score - a.score || a.bitCount - b.bitCount || a.offset - b.offset);
  return scored[0];
}

function decryptSubstructs(bytes, offset, personality, otId) {
  const key = personality ^ otId;
  const order = SUBSTRUCT_ORDERS[personality % SUBSTRUCT_ORDERS.length];
  const encrypted = bytes.slice(offset, offset + SUBSTRUCT_SIZE * 4);
  const decrypted = new Uint8Array(SUBSTRUCT_SIZE * 4);
  for (let i = 0; i < encrypted.length; i += 4) {
    const word = readUint32LE(encrypted, i);
    writeUint32LE(decrypted, i, word ^ key);
  }
  const substructs = new Array(4);
  for (let type = 0; type < 4; type++) {
    const sourceIndex = order[type];
    const start = sourceIndex * SUBSTRUCT_SIZE;
    substructs[type] = decrypted.slice(start, start + SUBSTRUCT_SIZE);
  }
  return substructs;
}

function toDisplayName(slug) {
  if (!slug) return "";
  return slug
    .split("-")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function parsePartySlot(bytes, offset, context) {
  const recordsByNationalId = context?.recordsByNationalId;
  const recordsBySlug = context?.recordsBySlug;
  const slugByNationalId = context?.slugByNationalId;
  const personality = readUint32LE(bytes, offset);
  if (personality === 0) return null;
  const otId = readUint32LE(bytes, offset + 4);
  const substructs = decryptSubstructs(bytes, offset + BOX_SUBSTRUCT_OFFSET, personality, otId);
  // Read species ID directly from the growth substruct (substruct 0)
  // Mask to 16 bits to ensure valid range
  const speciesInternalId = readUint16LE(substructs[0], 0) & 0xFFFF;
  if (speciesInternalId === 0 || speciesInternalId > 1025) {
    return null;
  }
  // Always use slug-based lookup: National ID -> slug -> Lazarus entry
  let record = null;
  let fallbackSlug = null;
  if (slugByNationalId instanceof Map) {
    fallbackSlug = slugByNationalId.get(speciesInternalId) || null;
    if (fallbackSlug && recordsBySlug instanceof Map) {
      record = recordsBySlug.get(fallbackSlug) || null;
    }
  }
  // Fallback to direct National ID lookup if slug lookup failed
  if (!record && recordsByNationalId instanceof Map) {
    record = recordsByNationalId.get(speciesInternalId) || null;
  }
  const types = Array.isArray(record?.types)
    ? record.types.map((type) => normalizeTypeName(type)).filter(Boolean)
    : [];
  const stats = {
    attack: readUint16LE(bytes, offset + ATTACK_OFFSET),
    defense: readUint16LE(bytes, offset + DEFENSE_OFFSET),
    speed: readUint16LE(bytes, offset + SPEED_OFFSET),
    spAttack: readUint16LE(bytes, offset + SP_ATTACK_OFFSET),
    spDefense: readUint16LE(bytes, offset + SP_DEFENSE_OFFSET),
  };
  if (stats.special == null) {
    stats.special = stats.spAttack ?? null;
  }
  const statusValue = readUint32LE(bytes, offset + STATUS_OFFSET);
  const normalizedSlug = normalizeSpeciesSlug(record?.slug || record?.name || fallbackSlug);
  // speciesInternalId is the National Dex ID in Gen 3
  const nationalId = Number.isFinite(speciesInternalId) && speciesInternalId > 0 ? speciesInternalId : null;
  
  // Nature is determined by personality % 25 in Gen 3
  const NATURE_NAMES = [
    "Hardy", "Lonely", "Brave", "Adamant", "Naughty",
    "Bold", "Docile", "Relaxed", "Impish", "Lax",
    "Timid", "Hasty", "Serious", "Jolly", "Naive",
    "Modest", "Mild", "Quiet", "Bashful", "Rash",
    "Calm", "Gentle", "Sassy", "Careful", "Quirky"
  ];
  const natureIndex = personality % 25;
  const nature = NATURE_NAMES[natureIndex] || "Unknown";

  return {
    speciesInternalId,
    slug: normalizedSlug || null,
    displayName: record?.name || (normalizedSlug ? toDisplayName(normalizedSlug) : null),
    dexId: record?.id ?? speciesInternalId,
    nationalId,
    currentHp: readUint16LE(bytes, offset + HP_OFFSET),
    maxHp: readUint16LE(bytes, offset + MAX_HP_OFFSET),
    level: bytes[offset + LEVEL_OFFSET],
    status: statusValue,
    statusText: interpretGen3Status(statusValue),
    types: types.length > 0 ? types : ["Unknown"],
    stats,
    nature,
    originalTrainerId: otId,
    originalTrainerIdFormatted: String(otId & 0xffff)
      .padStart(5, "0")
      .slice(-5),
    originalTrainerName: null,
    nickname: null,
  };
}

function extractPartyMembers(saveBlock1, context) {
  const count = Math.min(saveBlock1[PARTY_COUNT_OFFSET] || 0, PARTY_MAX_SIZE);
  const members = [];
  for (let i = 0; i < count; i++) {
    const offset = PARTY_DATA_OFFSET + i * PARTY_SLOT_SIZE;
    if (offset + PARTY_SLOT_SIZE > saveBlock1.length) {
      break;
    }
    const slot = parsePartySlot(saveBlock1, offset, context);
    if (slot) {
      members.push({
        slot: i + 1,
        ...slot,
      });
    }
  }
  return members;
}

function readDexFlags(source, offset, dexFlagBytes) {
  if (!(source instanceof Uint8Array)) return null;
  if (offset == null || offset < 0 || offset + dexFlagBytes > source.length) {
    return null;
  }
  const slice = source.subarray(offset, offset + dexFlagBytes);
  const results = [];
  for (let i = 0; i < dexFlagBytes * 8; i++) {
    const byteIndex = Math.floor(i / 8);
    const bit = i % 8;
    if (((slice[byteIndex] >> (7 - bit)) & 1) === 0) {
      continue;
    }
    results.push(i + 1);
  }
  return results;
}

export function parseLazarusSavFile(arrayBuffer, options = {}) {
  if (!(arrayBuffer instanceof ArrayBuffer)) {
    throw new Error("Expected an ArrayBuffer for save data.");
  }
  const bytes = new Uint8Array(arrayBuffer);
  if (bytes.length < SECTION_TOTAL_SIZE) {
    throw new Error("Save file is too small to contain valid data.");
  }
  const { sections } = collectSections(bytes);
  const saveBlock2 = sections.get(SAVE_BLOCK_ID.TRAINER_INFO);
  const saveBlock1 = sections.get(SAVE_BLOCK_ID.TEAM_ITEMS);
  if (!saveBlock1 || !saveBlock2) {
    throw new Error("Missing required save blocks.");
  }
  const context = {
    recordsByNationalId: options.recordsByNationalId instanceof Map ? options.recordsByNationalId : new Map(),
    recordsBySlug: options.recordsBySlug instanceof Map ? options.recordsBySlug : new Map(),
    slugByNationalId: options.slugByNationalId instanceof Map ? options.slugByNationalId : new Map(),
  };
  const dexFlagBytes = detectDexFlagLength(context);
  const assembledSaveBlock1 = assembleSaveBlock1(sections);
  const partyMembers = extractPartyMembers(assembledSaveBlock1, context);
  // Use National Dex IDs for party species matching, as the save file likely uses National Dex IDs
  // for caught flags. Fallback to speciesInternalId if nationalId is not available.
  const partySpecies = partyMembers
    .map((entry) => {
      if (Number.isFinite(entry?.nationalId)) return Number(entry.nationalId);
      if (Number.isFinite(entry?.speciesInternalId)) return Number(entry.speciesInternalId);
      // Also check dexId as fallback (might be Lazarus custom ID or National Dex ID)
      if (Number.isFinite(entry?.dexId)) return Number(entry.dexId);
      return null;
    })
    .filter((value) => Number.isInteger(value) && value > 0);
  const preferredDexBytes = Math.max(dexFlagBytes, LAZARUS_MIN_DEX_FLAG_BYTES);
  // First try the observed National Dex caught flag location used by current Lazarus saves.
  let usedFixedDexFlags = false;
  let caughtPokemon = readDexFlags(assembledSaveBlock1, LAZARUS_POKEDEX_OWNED_OFFSET_V2, preferredDexBytes);
  if (Array.isArray(caughtPokemon) && caughtPokemon.length > 0) {
    usedFixedDexFlags = true;
  } else {
    const best = scanFlagSources(
      [
        { label: "block1", data: assembledSaveBlock1 },
        { label: "sb2", data: saveBlock2 },
      ],
      preferredDexBytes,
      partySpecies
    );
    caughtPokemon = best?.results || [];
  }
  
  // Validate the results: if we have party members, they should be in the caught list
  // This helps filter out false positives from random bitfields
  const partyNationalIds = new Set(
    partyMembers
      .map((entry) => entry?.nationalId)
      .filter((id) => Number.isFinite(id) && id > 0)
      .map((id) => Number(id))
  );
  const partyLazarusIds = new Set(
    partyMembers
      .map((entry) => {
        // Get Lazarus custom ID from the record if available
        if (entry?.slug && context.recordsBySlug instanceof Map) {
          const record = context.recordsBySlug.get(entry.slug);
          return record?.id != null ? Number(record.id) : null;
        }
        return null;
      })
      .filter((id) => Number.isFinite(id) && id > 0)
      .map((id) => Number(id))
  );

  let hasPartyMatches = false;
  if (partyMembers.length > 0 && caughtPokemon.length > 0) {
    const caughtSet = new Set(caughtPokemon);
    // Check if any party members are in the caught list (using either ID system)
    hasPartyMatches = Array.from(partyNationalIds).some((id) => caughtSet.has(id)) ||
                           Array.from(partyLazarusIds).some((id) => caughtSet.has(id));
    
    // If no party members match, this is likely a false positive - try to find a better match
    // by prioritizing results that match party members
    if (!hasPartyMatches && partyMembers.length > 0 && !usedFixedDexFlags) {
      // Only discard when we relied on heuristics; fixed offsets can legitimately miss party members
      // (e.g., pre-Pokedex captures).
      if (caughtPokemon.length > partyMembers.length * 2) {
        caughtPokemon = [];
      }
    }
  }
  // If the Pokédex flags missed current party members (common before receiving the Pokédex),
  // ensure they display as caught without overwriting good flag data.
  if (partyMembers.length > 0 && (!hasPartyMatches || caughtPokemon.length === 0)) {
    const merged = new Set(caughtPokemon);
    partyNationalIds.forEach((id) => merged.add(id));
    caughtPokemon = Array.from(merged).sort((a, b) => a - b);
  }
  
  return {
    caughtPokemon,
    partyMembers,
  };
}

export default parseLazarusSavFile;

