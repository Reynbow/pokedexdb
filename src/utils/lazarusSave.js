const SECTION_TOTAL_SIZE = 0x1000;
const SECTION_DATA_SIZE = 0xF80;
const SECTION_ID_OFFSET = 0x0FF4;
const SAVE_INDEX_OFFSET = 0x0FFC;
const SAVE_SECTION_COUNT = 14;
const SAVE_BLOCK_ID = {
  TRAINER_INFO: 0,
  TEAM_ITEMS: 1,
};
const DEX_FLAG_BYTES = 0x7C;
const OWNED_OFFSET = 0x28;
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

function extractCaughtPokemon(saveBlock2, context) {
  const recordsByNationalId = context?.recordsByNationalId;
  const results = [];
  for (let i = 0; i < DEX_FLAG_BYTES * 8; i++) {
    const byteIndex = Math.floor(i / 8);
    const bit = i % 8;
    const value = saveBlock2[OWNED_OFFSET + byteIndex];
    if (((value >> bit) & 1) !== 0) {
      const nationalId = i + 1;
      const record = recordsByNationalId?.get?.(nationalId) || null;
      results.push(record?.id ?? nationalId);
    }
  }
  return results;
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
  const caughtPokemon = extractCaughtPokemon(saveBlock2, context);
  const partyMembers = extractPartyMembers(saveBlock1, context);
  return {
    caughtPokemon,
    partyMembers,
  };
}

export default parseLazarusSavFile;

