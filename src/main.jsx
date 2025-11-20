import React, { StrictMode, Component, useEffect, useState, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './design-system.css'
import App from './App.jsx'
import TestPage from './TestPage.jsx'

// Lazy load route components for code splitting
const ItemsPage = lazy(() => import('./ItemsPage.jsx'))
const MovesPage = lazy(() => import('./MovesPage.jsx'))
const AbilitiesPage = lazy(() => import('./AbilitiesPage.jsx'))
const MinigamePage = lazy(() => import('./MinigamePage.jsx'))
const HomePage = lazy(() => import('./HomePage.jsx'))
const EvTrainingPage = lazy(() => import('./EvTrainingPage'))
const SavPage = lazy(() => import('./SavPage.jsx'))

const pathSegments = window.location.pathname.toLowerCase().split('/').filter(Boolean)
const lastSegment = pathSegments[pathSegments.length - 1] || ''
const isTestPage = lastSegment === 'test'

class GlobalErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, info: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Global crash:', error, info)
    this.setState({ info })
  }
  handleReload = () => {
    window.location.reload()
  }
  handleClearAndReload = () => {
    try { localStorage.clear() } catch {}
    try { sessionStorage.clear() } catch {}
    this.handleReload()
  }
  render() {
    if (this.state.hasError) {
      const { error, info } = this.state
      const env = {
        url: window.location.href,
        userAgent: navigator.userAgent,
        time: new Date().toISOString(),
      }
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
          <h1 style={{ marginTop: 0 }}>Something went wrong</h1>
          <p>The app failed to load. Below are diagnostic details to help debug.</p>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 320px', minWidth: 320 }}>
              <h2>Error</h2>
              <pre style={{ whiteSpace: 'pre-wrap', background: '#111', color: '#f55', padding: 12, borderRadius: 8, overflow: 'auto' }}>
                {String(error?.message || error)}
                {'\n'}
                {String(error?.stack || '')}
              </pre>
            </div>
            <div style={{ flex: '1 1 320px', minWidth: 320 }}>
              <h2>Component Stack</h2>
              <pre style={{ whiteSpace: 'pre-wrap', background: '#111', color: '#ddd', padding: 12, borderRadius: 8, overflow: 'auto' }}>
                {String(info?.componentStack || '(not available)')}
              </pre>
            </div>
            <div style={{ flex: '1 1 320px', minWidth: 320 }}>
              <h2>Environment</h2>
              <pre style={{ whiteSpace: 'pre-wrap', background: '#111', color: '#ddd', padding: 12, borderRadius: 8, overflow: 'auto' }}>
                {JSON.stringify(env, null, 2)}
              </pre>
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={this.handleReload}>Reload</button>
            <button onClick={this.handleClearAndReload}>Clear cache and reload</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const LoadingFallback = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    minHeight: '50vh',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  }}>
    <div style={{ textAlign: 'center', color: '#cbd5f5' }}>
      <div style={{ marginBottom: 12 }}>Loading...</div>
      <div style={{ width: 40, height: 40, border: '3px solid #333', borderTopColor: '#5d8ed2', borderRadius: '50%', margin: '0 auto', animation: 'spin 0.8s linear infinite' }} />
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  </div>
)

function RootRouter() {
  const [, setVersion] = useState(0)
  const [pathname, setPathname] = useState(() => window.location.pathname.toLowerCase())
  const [hash, setHash] = useState(() => String(window.location.hash || '').toLowerCase())
  
  useEffect(() => {
    const onChange = () => {
      setPathname(window.location.pathname.toLowerCase())
      setHash(String(window.location.hash || '').toLowerCase())
      setVersion(v => v + 1)
    }
    window.addEventListener('hashchange', onChange)
    window.addEventListener('popstate', onChange)
    // Also listen for custom navigation events
    window.addEventListener('locationchange', onChange)
    return () => {
      window.removeEventListener('hashchange', onChange)
      window.removeEventListener('popstate', onChange)
      window.removeEventListener('locationchange', onChange)
    }
  }, [])
  
  const basePath = (import.meta.env?.BASE_URL || '/').replace(/\/+$|^$/, '/')
  const normalizedPath = pathname.replace(basePath === '/' ? '' : basePath, '').replace(/^\//, '').toLowerCase()
  
  // Path-based routing (preferred)
  if (normalizedPath === 'save' || pathname.endsWith('/save')) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <SavPage />
      </Suspense>
    )
  }
  if (normalizedPath === 'moves' || pathname.endsWith('/moves')) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <MovesPage />
      </Suspense>
    )
  }
  if (normalizedPath === 'abilities' || pathname.endsWith('/abilities')) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <AbilitiesPage />
      </Suspense>
    )
  }
  if (normalizedPath === 'ev-training' || normalizedPath === 'ev' || pathname.endsWith('/ev-training') || pathname.endsWith('/ev')) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <EvTrainingPage />
      </Suspense>
    )
  }
  if (normalizedPath === 'whosthat' || pathname.endsWith('/whosthat')) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <MinigamePage />
      </Suspense>
    )
  }
  if (normalizedPath === 'items' || pathname.endsWith('/items')) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <ItemsPage />
      </Suspense>
    )
  }
  if (normalizedPath === 'home' || pathname.endsWith('/home')) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <HomePage />
      </Suspense>
    )
  }
  
  // Legacy hash-based routing (for backward compatibility and redirects)
  if (hash.startsWith('#/home')) {
    const newPath = basePath === '/' ? '/home' : `${basePath}home`
    window.history.replaceState({}, '', newPath)
    window.dispatchEvent(new Event('locationchange'))
    return (
      <Suspense fallback={<LoadingFallback />}>
        <HomePage />
      </Suspense>
    )
  }
  if (hash.startsWith('#/items')) {
    const newPath = basePath === '/' ? '/items' : `${basePath}items`
    window.history.replaceState({}, '', newPath)
    window.dispatchEvent(new Event('locationchange'))
    return (
      <Suspense fallback={<LoadingFallback />}>
        <ItemsPage />
      </Suspense>
    )
  }
  if (hash.startsWith('#/moves')) {
    const newPath = basePath === '/' ? '/moves' : `${basePath}moves`
    window.history.replaceState({}, '', newPath)
    window.dispatchEvent(new Event('locationchange'))
    return (
      <Suspense fallback={<LoadingFallback />}>
        <MovesPage />
      </Suspense>
    )
  }
  if (hash.startsWith('#/abilities')) {
    const newPath = basePath === '/' ? '/abilities' : `${basePath}abilities`
    window.history.replaceState({}, '', newPath)
    window.dispatchEvent(new Event('locationchange'))
    return (
      <Suspense fallback={<LoadingFallback />}>
        <AbilitiesPage />
      </Suspense>
    )
  }
  if (hash.startsWith('#/ev-training') || hash.startsWith('#/ev')) {
    const newPath = basePath === '/' ? '/ev-training' : `${basePath}ev-training`
    window.history.replaceState({}, '', newPath)
    window.dispatchEvent(new Event('locationchange'))
    return (
      <Suspense fallback={<LoadingFallback />}>
        <EvTrainingPage />
      </Suspense>
    )
  }
  if (hash.startsWith('#/whosthat')) {
    const newPath = basePath === '/' ? '/whosthat' : `${basePath}whosthat`
    window.history.replaceState({}, '', newPath)
    window.dispatchEvent(new Event('locationchange'))
    return (
      <Suspense fallback={<LoadingFallback />}>
        <MinigamePage />
      </Suspense>
    )
  }
  // Legacy hash-based /sav route - redirect to /save
  if (hash.startsWith('#/sav')) {
    const newPath = basePath === '/' ? '/save' : `${basePath}save`
    window.history.replaceState({}, '', newPath)
    window.dispatchEvent(new Event('locationchange'))
    return (
      <Suspense fallback={<LoadingFallback />}>
        <SavPage />
      </Suspense>
    )
  }
  return <App />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GlobalErrorBoundary>
      {isTestPage ? <TestPage /> : <RootRouter />}
    </GlobalErrorBoundary>
  </StrictMode>,
)
