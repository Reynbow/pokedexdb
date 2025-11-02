/**
 * Get the URL for a Pokemon type icon
 * Uses a reliable CDN source for type icons
 * @param {string} type - The type name (e.g., "fire", "water", "grass")
 * @returns {string} The URL to the type icon
 */
export function getTypeIconUrl(type) {
  // Using a common GitHub repository that hosts Pokemon type SVG icons
  // This is a well-known repo in the Pokemon developer community
  const normalizedType = String(type || "").toLowerCase().trim();
  
  // Common CDN options (in order of preference):
  // 1. duiker101's pokemon-type-svg-icons (very popular)
  // 2. Alternative: PokeAPI doesn't host type icons, so we use GitHub CDN
  return `https://raw.githubusercontent.com/duiker101/pokemon-type-svg-icons/master/icons/${normalizedType}.svg`;
}

/**
 * Get all type icon URLs as a Map for quick lookup
 * @param {string[]} types - Array of type names
 * @returns {Map<string, string>} Map of type names to icon URLs
 */
export function getTypeIconMap(types) {
  const map = new Map();
  types.forEach((type) => {
    map.set(type, getTypeIconUrl(type));
  });
  return map;
}


