import { useEffect, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import JumpSearch from "./JumpSearch.jsx";
import { PAGE_ROUTES } from "../routeMeta.js";
import { navigate, preloadRoute, routeHref } from "../router.js";
import "./shell.css";

const SECTIONS = [
  { key: "pokemon", label: "Pokédex" },
  ...PAGE_ROUTES.filter((route) => route.nav).map((route) => ({ key: route.key, label: route.nav })),
];

// Phone tab bar: the Pokédex and reference pages up front, the rest under "More"
const TAB_KEYS = ["pokemon", "moves", "abilities", "items"];
const TAB_ICONS = { pokemon: "ball", moves: "bolt", abilities: "star", items: "bag" };
const MORE_KEYS = SECTIONS.map((s) => s.key).filter((key) => !TAB_KEYS.includes(key));

const isPlainLeftClick = (event) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

function SectionLink({ section, active, className, onNavigate, icon = null }) {
  const href = routeHref(section.key);
  const preload = () => {
    preloadRoute(section.key).catch(() => {});
  };
  return (
    <a
      href={href}
      className={className}
      aria-current={active ? "page" : undefined}
      data-section={section.key}
      onPointerEnter={preload}
      onFocus={preload}
      onTouchStart={preload}
      onClick={(event) => {
        if (!isPlainLeftClick(event)) return;
        event.preventDefault();
        navigate(href);
        onNavigate?.();
      }}
    >
      {icon ? <Icon name={icon} /> : null}
      {section.label}
    </a>
  );
}

/** The Pokédex lens mark: a big blue lens and three status lights, drawn as pixels. */
function LensMark() {
  return (
    <svg className="wordmark__lens" viewBox="0 0 20 14" aria-hidden="true" focusable="false">
      <rect x="2" y="0" width="8" height="1" fill="var(--ink)" />
      <rect x="1" y="1" width="10" height="1" fill="var(--ink)" />
      <rect x="0" y="2" width="12" height="8" fill="var(--ink)" />
      <rect x="1" y="10" width="10" height="1" fill="var(--ink)" />
      <rect x="2" y="11" width="8" height="1" fill="var(--ink)" />
      <rect x="2" y="2" width="8" height="8" fill="var(--lens)" />
      <rect x="1" y="3" width="10" height="6" fill="var(--lens)" />
      <rect x="3" y="3" width="2" height="2" fill="#d6ebff" />
      <rect x="14" y="1" width="2" height="2" fill="var(--red)" />
      <rect x="17" y="1" width="2" height="2" fill="var(--warn)" />
    </svg>
  );
}

export default function SiteShell({ routeKey, children }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const desktopSearchRef = useRef(null);

  // "/" focuses the jump search from anywhere (unless typing in a field)
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName))) return;
      event.preventDefault();
      const input = desktopSearchRef.current?.querySelector("input");
      if (input && input.offsetParent !== null) input.focus();
      else setSearchOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setMoreOpen(false);
    setSearchOpen(false);
  }, [routeKey]);

  const moreActive = MORE_KEYS.includes(routeKey);

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="devicebar">
        <div className="devicebar__inner">
          <a
            className="wordmark"
            href={routeHref("pokemon")}
            onClick={(event) => {
              if (!isPlainLeftClick(event)) return;
              event.preventDefault();
              navigate(routeHref("pokemon"));
            }}
          >
            <LensMark />
            <span className="wordmark__text">
              Pokédex<span className="wordmark__db">DB</span>
            </span>
          </a>
          <nav className="devicebar__nav" aria-label="Sections">
            {SECTIONS.map((section) => (
              <SectionLink
                key={section.key}
                section={section}
                active={routeKey === section.key}
                className="devicebar__link"
              />
            ))}
          </nav>
          <div className="devicebar__search" ref={desktopSearchRef}>
            <JumpSearch />
          </div>
          <button
            type="button"
            className="btn btn--quiet btn--icon devicebar__search-toggle"
            aria-label="Jump to a Pokémon"
            onClick={() => setSearchOpen(true)}
          >
            <Icon name="search" className="icon--lg" />
          </button>
        </div>
      </header>

      {searchOpen ? (
        <>
          <div className="scrim" onClick={() => setSearchOpen(false)} />
          <div className="sheet search-sheet" role="dialog" aria-label="Jump to a Pokémon">
            <JumpSearch autoFocus onDone={() => setSearchOpen(false)} />
          </div>
        </>
      ) : null}

      <div className="shell__page" id="main">
        {children}
      </div>

      <nav className="tabbar" aria-label="Sections">
        {SECTIONS.filter((s) => TAB_KEYS.includes(s.key)).map((section) => (
          <SectionLink
            key={section.key}
            section={section}
            active={routeKey === section.key}
            className="tabbar__link"
            icon={TAB_ICONS[section.key]}
          />
        ))}
        <button
          type="button"
          className="tabbar__link"
          aria-expanded={moreOpen}
          aria-current={moreActive ? "page" : undefined}
          onClick={() => setMoreOpen((open) => !open)}
        >
          <Icon name="menu" />
          More
        </button>
      </nav>

      {moreOpen ? (
        <>
          <div className="scrim" onClick={() => setMoreOpen(false)} />
          <div className="sheet more-sheet" role="dialog" aria-label="More sections">
            <ul className="more-sheet__list">
              {SECTIONS.filter((s) => MORE_KEYS.includes(s.key)).map((section) => (
                <li key={section.key}>
                  <SectionLink
                    section={section}
                    active={routeKey === section.key}
                    className="more-sheet__link"
                    onNavigate={() => setMoreOpen(false)}
                  />
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}
