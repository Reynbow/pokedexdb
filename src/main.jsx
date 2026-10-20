/* eslint-disable react-refresh/only-export-components -- app entry point; nothing imports from it */
import { StrictMode, Component, useEffect, useRef, useState, Suspense, lazy, startTransition } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import './index.css'
import './design-system.css'
import App from './App.jsx'
import { getLoadedPage, getPageLoader, preloadRoute, redirectLegacyHashRoute, resolveRouteKey } from './router.js'
import { PAGE_ROUTE_BY_KEY } from './routeMeta.js'

// Route components are code-split; router.js preloads them before navigating.
const PAGES = {
  moves: lazy(getPageLoader('moves')),
  abilities: lazy(getPageLoader('abilities')),
  items: lazy(getPageLoader('items')),
  ev: lazy(getPageLoader('ev')),
  whosthat: lazy(getPageLoader('whosthat')),
  save: lazy(getPageLoader('save')),
  home: lazy(getPageLoader('home')),
  ...(import.meta.env.DEV ? { test: lazy(getPageLoader('test')) } : {}),
}

redirectLegacyHashRoute()

class GlobalErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error('Global crash:', error, info)
  }
  handleReload = () => {
    window.location.reload()
  }
  handleClearAndReload = () => {
    try { localStorage.clear() } catch { /* storage unavailable */ }
    try { sessionStorage.clear() } catch { /* storage unavailable */ }
    this.handleReload()
  }
  render() {
    if (this.state.hasError) {
      const { error } = this.state
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', color: '#e2e8f0' }}>
          <h1 style={{ marginTop: 0 }}>Something went wrong</h1>
          <p>The page failed to load. Reloading usually fixes it.</p>
          <div style={{ marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={this.handleReload}>Reload</button>
            <button onClick={this.handleClearAndReload}>Clear saved settings and reload</button>
          </div>
          {import.meta.env.DEV ? (
            <pre style={{ whiteSpace: 'pre-wrap', background: '#111', color: '#f55', padding: 12, borderRadius: 8, overflow: 'auto', marginTop: 16 }}>
              {String(error?.stack || error?.message || error)}
            </pre>
          ) : null}
        </div>
      )
    }
    return this.props.children
  }
}

// Only shown on a direct visit to a page whose code hasn't loaded yet; in-app navigation keeps
// the current page on screen until the next one is ready. Delayed so fast loads don't flash.
const LoadingFallback = () => {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 250)
    return () => clearTimeout(timer)
  }, [])
  if (!visible) return <div style={{ minHeight: '50vh' }} />
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <div className="route-loading__spinner" aria-hidden="true" />
      <span>Loading…</span>
    </div>
  )
}

const prefersReducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function RootRouter() {
  const [routeKey, setRouteKey] = useState(() => resolveRouteKey())
  const routeKeyRef = useRef(routeKey)
  const navigationIdRef = useRef(0)

  useEffect(() => {
    const onChange = (event) => {
      const nextKey = resolveRouteKey()
      // The URL is the source of truth: any change supersedes a page switch still in progress.
      const navigationId = ++navigationIdRef.current
      // Same page (e.g. selecting a Pokémon inside the Pokédex): that page handles it itself.
      if (nextKey === routeKeyRef.current) return
      const isPush = event?.type === 'locationchange' && event?.detail?.push !== false
      preloadRoute(nextKey)
        .catch(() => {})
        .then(() => {
          if (navigationId !== navigationIdRef.current) return // a newer navigation won
          const apply = () => {
            // Re-check: a newer location change may have happened while this was queued
            if (navigationId !== navigationIdRef.current) return
            routeKeyRef.current = nextKey
            setRouteKey(nextKey)
          }
          const canAnimate =
            typeof document.startViewTransition === 'function' &&
            document.visibilityState === 'visible' &&
            !prefersReducedMotion()
          if (canAnimate) {
            // The transition waits for the next rendered frame before swapping pages. If the page
            // isn't producing frames (some embedded/throttled contexts report "visible" anyway),
            // don't let navigation hang: swap without the animation after a short wait.
            let applied = false
            const applyOnce = () => {
              if (applied) return
              applied = true
              apply()
            }
            const transition = document.startViewTransition(() => flushSync(applyOnce))
            // A skipped/interrupted transition rejects these; that's expected, not an error
            transition.ready?.catch(() => {})
            transition.finished?.catch(() => {})
            setTimeout(() => {
              if (applied) return
              transition.skipTransition?.()
              startTransition(applyOnce)
            }, 250)
          } else {
            startTransition(apply)
          }
          if (isPush) window.scrollTo(0, 0)
        })
    }
    window.addEventListener('popstate', onChange)
    window.addEventListener('locationchange', onChange)
    return () => {
      window.removeEventListener('popstate', onChange)
      window.removeEventListener('locationchange', onChange)
    }
  }, [])

  // Page title for the tool pages (the Pokédex sets its own, per selected Pokémon)
  useEffect(() => {
    const route = PAGE_ROUTE_BY_KEY.get(routeKey)
    if (route?.title) document.title = route.title
  }, [routeKey])

  if (!PAGES[routeKey]) return <App />
  // After in-app navigation the code is already loaded, so render it directly (React.lazy would
  // still suspend for a tick and flash the fallback inside the view transition).
  const Page = getLoadedPage(routeKey) || PAGES[routeKey]
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Page />
    </Suspense>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <RootRouter />
    </GlobalErrorBoundary>
  </StrictMode>,
)
