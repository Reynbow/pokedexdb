const normalizeBasePath = (base = "/") => {
  let path = base || "/";
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  if (!path.endsWith("/")) {
    path = `${path}/`;
  }
  return path;
};

const BASE_PATH = normalizeBasePath(import.meta.env?.BASE_URL ?? "/");
const BASE_SEGMENTS = BASE_PATH.split("/").filter(Boolean);

export const getPokemonSlugFromPath = (pathname) => {
  const pathSegments = String(pathname || "").split("/").filter(Boolean);
  let offset = 0;
  if (BASE_SEGMENTS.length > 0) {
    while (offset < BASE_SEGMENTS.length && pathSegments[offset] === BASE_SEGMENTS[offset]) {
      offset += 1;
    }
  }
  const slugSegment = pathSegments[offset] ?? "";
  if (!slugSegment) return "";
  try {
    return decodeURIComponent(slugSegment).toLowerCase();
  } catch {
    return slugSegment.toLowerCase();
  }
};

export const getPokemonSlugFromLocation = (loc = window.location) =>
  getPokemonSlugFromPath(loc?.pathname ?? "");

export const normalizePokemonSlug = (value) => String(value || "").trim().toLowerCase();

export const buildPokemonPath = (value) => {
  const slug = normalizePokemonSlug(value);
  if (!slug) return BASE_PATH;
  return `${BASE_PATH}${encodeURIComponent(slug)}`;
};

export const updatePokemonLocation = (value, options = {}) => {
  const { replace = false, pruneKeys = ["p"] } = options;
  const url = new URL(window.location.href);
  pruneKeys.forEach((key) => url.searchParams.delete(key));
  url.pathname = buildPokemonPath(value);
  const method = replace ? "replaceState" : "pushState";
  window.history[method]({}, "", url);
  try {
    window.dispatchEvent(new PopStateEvent("popstate"));
  } catch {}
  return url;
};

export const getBasePath = () => BASE_PATH;

