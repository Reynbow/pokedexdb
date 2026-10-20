import React, { useEffect, useState } from "react";
import { PAGE_ROUTES } from "./routeMeta.js";
import { navigate, preloadRoute, resolveRouteKey, routeHref } from "./router.js";

const CATEGORIES = [
  { key: "pokemon", label: "Pokémon" },
  ...PAGE_ROUTES.filter((route) => route.nav).map((route) => ({ key: route.key, label: route.nav })),
];

const isPlainLeftClick = (event) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

// Section tabs. Real links (crawlable, middle-click / open in new tab work); plain clicks are
// handled client-side, and the target page's code is preloaded on hover/focus/touch.
export default function CategoryToggle() {
  const [active, setActive] = useState(() => resolveRouteKey());
  const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 768 : false));

  useEffect(() => {
    const onChange = () => setActive(resolveRouteKey());
    window.addEventListener("popstate", onChange);
    window.addEventListener("locationchange", onChange);
    return () => {
      window.removeEventListener("popstate", onChange);
      window.removeEventListener("locationchange", onChange);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <nav className={`category-toggle-row${isMobile ? " is-mobile" : ""}`} aria-label="Pokedex sections">
      {CATEGORIES.map((cat) => {
        const isOn = active === cat.key;
        const href = routeHref(cat.key);
        const preload = () => {
          preloadRoute(cat.key).catch(() => {});
        };
        return (
          <a
            key={cat.key}
            href={href}
            aria-current={isOn ? "page" : undefined}
            className={`filter-chip${isOn ? " is-on" : ""}`}
            data-category={cat.key}
            onPointerEnter={preload}
            onFocus={preload}
            onTouchStart={preload}
            onClick={(event) => {
              if (!isPlainLeftClick(event)) return;
              event.preventDefault();
              // Re-clicking the current section returns to its start (e.g. clears a selected Pokémon)
              navigate(href);
            }}
          >
            {cat.label}
          </a>
        );
      })}
    </nav>
  );
}
