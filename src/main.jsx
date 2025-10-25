import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import TestPage from './TestPage.jsx'

const pathSegments = window.location.pathname.toLowerCase().split('/').filter(Boolean)
const lastSegment = pathSegments[pathSegments.length - 1] || ''
const isTestPage = lastSegment === 'test'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isTestPage ? <TestPage /> : <App />}
  </StrictMode>,
)
