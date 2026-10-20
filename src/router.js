// Client-side routing for the top-level pages. Pages are code-split; navigating preloads the
// next page's code first so the switch is instant (no "Loading..." flash) and can cross-fade.
import { PAGE_ROUTES } from "./routeMeta.js";
import { getBasePath } from "./utils/url.js";

const PAGE_LOADERS = {
  moves: () => import("./MovesPage.jsx"),
  abilities: () => import("./AbilitiesPage.jsx"),
  items: () => import("./ItemsPage.jsx"),
  ev: () => import("./EvTrainingPage.jsx"),
  whosthat: () => import("./MinigamePage.jsx"),
  save: () => import("./SavPage.jsx"),
  // Developer-only API explorer, never shipped in production builds
  ...(import.meta.env.DEV ? { test: () => import("./TestPage.jsx") } : {}),
};

const SEGMENT_TO_KEY = new Map();
for (const route of PAGE_ROUTES) {
  SEGMENT_TO_KEY.set(route.path, route.key);
  route.aliases.forEach((alias) => SEGMENT_TO_KEY.set(alias, route.key));
}
if (import.meta.env.DEV) SEGMENT_TO_KEY.set("test", "test");

/** "pokemon" (the Pokédex, incl. /<pokemon-slug>) or a PAGE_ROUTES key. Trailing slashes are ignored. */
export const resolveRouteKey = (pathname = window.location.pathname) => {
  const base = getBasePath();
  let path = String(pathname || "/");
  if (base !== "/" && path.toLowerCase().startsWith(base.toLowerCase())) {
    path = path.slice(base.length - 1);
  }
  const firstSegment = path.split("/").filter(Boolean)[0]?.toLowerCase() || "";
  return SEGMENT_TO_KEY.get(firstSegment) || "pokemon";
};

export const routeHref = (key) => {
  const route = PAGE_ROUTES.find((r) => r.key === key);
  return route ? `${getBasePath()}${route.path}` : getBasePath();
};

const loaded = new Map();
const resolvedModules = new Map();
/** Starts loading a page's code (safe to call repeatedly, e.g. on hover). */
export const preloadRoute = (key) => {
  const loader = PAGE_LOADERS[key];
  if (!loader) return Promise.resolve();
  if (!loaded.has(key)) {
    loaded.set(
      key,
      loader()
        .then((module) => {
          resolvedModules.set(key, module);
          return module;
        })
        .catch((error) => {
          loaded.delete(key);
          throw error;
        })
    );
  }
  return loaded.get(key);
};

/** The page component if its code has already loaded (lets the router render it without suspending). */
export const getLoadedPage = (key) => resolvedModules.get(key)?.default ?? null;

export const getPageLoader = (key) => () => preloadRoute(key);

/** Client-side navigation to a same-site URL. */
export const navigate = (href, { replace = false } = {}) => {
  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin) {
    window.location.assign(url.href);
    return;
  }
  if (url.href === window.location.href) return;
  window.history[replace ? "replaceState" : "pushState"]({}, "", url);
  window.dispatchEvent(new CustomEvent("locationchange", { detail: { push: !replace } }));
};

/** Old hash URLs (/#/moves, /#/sav, ...) -> path URLs, before the app renders. */
export const redirectLegacyHashRoute = () => {
  const hash = String(window.location.hash || "").toLowerCase();
  const match = hash.match(/^#\/([a-z-]+)/);
  if (!match) return;
  const key = SEGMENT_TO_KEY.get(match[1]);
  if (!key) return;
  const url = new URL(window.location.href);
  url.hash = "";
  url.pathname = routeHref(key);
  window.history.replaceState({}, "", url);
};
