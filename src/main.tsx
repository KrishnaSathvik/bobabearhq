import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AuthGate from './AuthGate'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate><App /></AuthGate>
  </StrictMode>,
)

// Installed-app behaviour, and only on a real deploy. A service worker in front
// of the test build would serve one run's app shell to the next one, so the
// suite — which builds with `--mode test` — never gets one.
if (import.meta.env.MODE === 'production' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // What this page is running on, so a worker that installed after these were
    // fetched can still cache them. Otherwise the first visit leaves an app
    // that has a shell but no code to put in it.
    const appAssets = () => [
      ...document.querySelectorAll<HTMLScriptElement>('script[src]'),
      ...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
    ]
      .map(node => ('src' in node ? node.src : node.href))
      .filter(url => url.startsWith(`${location.origin}/assets/`))

    void navigator.serviceWorker.ready.then(registration => {
      registration.active?.postMessage({ type: 'cache-assets', urls: appAssets() })
    }).catch(() => undefined)

    void navigator.serviceWorker.register('/sw.js').then(registration => {
      // A new version that has finished downloading takes over straight away
      // rather than waiting for every tab to be closed. Two people share this
      // workspace on two phones; "quit the app completely" is not a step.
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing
        if (!installing) return
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            installing.postMessage('skip-waiting')
          }
        })
      })
    }).catch(() => undefined)
  })
}
