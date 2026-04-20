import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

function showBanner(msg: string, bg: string, top: string) {
  const el = document.createElement('div')
  el.style.cssText = `position:fixed;${top}:0;left:0;right:0;background:${bg};color:white;padding:0.75rem 1rem;z-index:99999;font-family:monospace;font-size:12px;word-break:break-all`
  el.textContent = msg
  document.body.appendChild(el)
}

window.onerror = (msg, src, line, col) => {
  showBanner(`JS Error: ${msg} at ${src}:${line}:${col}`, '#c00', 'top')
}

window.addEventListener('unhandledrejection', (e) => {
  showBanner(`Unhandled Promise Rejection: ${e.reason}`, '#b45309', 'top')
})

const _ce = console.error.bind(console)
console.error = (...args: unknown[]) => {
  _ce(...args)
  const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
  if (msg.includes('Error') || msg.includes('error') || msg.includes('Warning')) {
    showBanner(`[console.error] ${msg.slice(0, 300)}`, '#6d28d9', 'top')
  }
}

setTimeout(() => {
  const root = document.getElementById('root')
  const html = root ? root.innerHTML.slice(0, 200) : 'root not found'
  showBanner(`[Heartbeat 3s] root content: ${html || 'EMPTY'}`, '#065f46', 'bottom')
}, 3000)

const _wasUnloaded = sessionStorage.getItem('bkmng-unload-url')
if (_wasUnloaded) {
  showBanner(`[Diagnostic] Previous page navigated away from: ${_wasUnloaded}`, '#1d4ed8', 'bottom')
  sessionStorage.removeItem('bkmng-unload-url')
}

window.addEventListener('beforeunload', () => {
  sessionStorage.setItem('bkmng-unload-url', window.location.href)
})

const rootEl = document.getElementById('root')
if (!rootEl) {
  document.body.innerHTML = '<div style="padding:2rem;font-family:sans-serif;color:red">Error: #root element not found</div>'
} else {
  try {
    createRoot(rootEl).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  } catch (e) {
    showBanner(`React startup error: ${e}`, '#c00', 'top')
    rootEl.innerHTML = `<div style="padding:2rem;font-family:monospace;color:red"><strong>React startup error:</strong><br><pre>${e}</pre></div>`
  }
}
