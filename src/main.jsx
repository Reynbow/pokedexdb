import React, { StrictMode, Component, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './design-system.css'
import App from './App.jsx'
import TestPage from './TestPage.jsx'
import ItemsPage from './ItemsPage.jsx'
import MovesPage from './MovesPage.jsx'
import AbilitiesPage from './AbilitiesPage.jsx'

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

function RootRouter() {
  const [, setVersion] = useState(0)
  useEffect(() => {
    const onChange = () => setVersion(v => v + 1)
    window.addEventListener('hashchange', onChange)
    window.addEventListener('popstate', onChange)
    return () => {
      window.removeEventListener('hashchange', onChange)
      window.removeEventListener('popstate', onChange)
    }
  }, [])

  const hash = String(window.location.hash || '').toLowerCase()
  if (hash.startsWith('#/items')) return <ItemsPage />
  if (hash.startsWith('#/moves')) return <MovesPage />
  if (hash.startsWith('#/abilities')) return <AbilitiesPage />
  return <App />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GlobalErrorBoundary>
      {isTestPage ? <TestPage /> : <RootRouter />}
    </GlobalErrorBoundary>
  </StrictMode>,
)
