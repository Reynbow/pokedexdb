// Shared slug normalization for the Save Reader's Pokemon Lazarus reference data.
// (The experimental Lazarus .sav parser that lived here was removed together with its
// upload UI; it is still available in git history.)
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
