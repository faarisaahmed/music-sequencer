import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import * as store from './state/store'
import * as actions from './state/actions'
import * as templates from './model/templates'
import * as audioStore from './audio/audioStore'
import * as collab from './collab/state'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Offline support & installable app (production builds only).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service worker registration failed', e));
  });
}

// Test hooks for automated browsers only (Playwright sets navigator.webdriver).
if (navigator.webdriver) {
  (window as unknown as Record<string, unknown>).__bf = { store, actions, templates, audioStore, collab, session: () => import('./collab/session'), engine: () => import('./audio/engine').then((m) => m.getEngine()) };
}
