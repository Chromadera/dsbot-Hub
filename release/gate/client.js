window.__ModuleLoader__.load({
  id: 'dsbot-mobile-desktop-gate',
  factory() {
    const exports = {}

    const GATE_ATTRIBUTE = 'data-dsbot-mobile-gate'
    const HIDDEN_ATTRIBUTE = 'data-dsbot-mobile-gate-hidden'
    const MOBILE = '(max-width: 1024px)'

    const CSS = `
      @media ${MOBILE} {
        html[${GATE_ATTRIBUTE}] [class*="VUpDDW_"],
        html[${GATE_ATTRIBUTE}] [class*="NazlmG_"],
        html[${GATE_ATTRIBUTE}] [class*="pixelPet"],
        html[${GATE_ATTRIBUTE}] [class*="pixelPaw"],
        html[${GATE_ATTRIBUTE}] [class*="pixelPalette"],
        html[${GATE_ATTRIBUTE}] [class*="pixelAction"],
        html[${GATE_ATTRIBUTE}] [class*="pixelBreed"],
        html[${GATE_ATTRIBUTE}] [class*="pixelCount"],
        html[${GATE_ATTRIBUTE}] [class*="nArs4W_"],
        html[${GATE_ATTRIBUTE}] [class*="bottomPanel"],
        html[${GATE_ATTRIBUTE}] [class*="bottomResize"],
        html[${GATE_ATTRIBUTE}] [class*="bottomClose"],
        html[${GATE_ATTRIBUTE}] [class*="toggleButton"],
        html[${GATE_ATTRIBUTE}] [${HIDDEN_ATTRIBUTE}] { display: none !important; }
      }
    `

    /** Hide the named desktop-only panel/settings entries on the mobile shell. */
    function syncLabels() {
      const mobile = window.matchMedia(MOBILE).matches
      const root = document.documentElement
      root.toggleAttribute(GATE_ATTRIBUTE, mobile)
      if (!mobile) {
        for (const element of document.querySelectorAll(`[${HIDDEN_ATTRIBUTE}]`)) {
          element.removeAttribute(HIDDEN_ATTRIBUTE)
        }
        return
      }
      for (const element of document.querySelectorAll('button, a, [role="button"], [role="tab"]')) {
        const label = (element.textContent ?? '').trim()
        if (label === 'Context Insights' || label === 'Plugin Market') {
          element.setAttribute(HIDDEN_ATTRIBUTE, '')
        }
      }
    }

    /** @param {import('@deepseek-ai/cordis').Context} ctx */
    function apply(ctx) {
      if (typeof document === 'undefined') return
      const style = document.createElement('style')
      style.dataset.dsbotMobileGate = ''
      style.textContent = CSS
      document.head.appendChild(style)
      const media = window.matchMedia(MOBILE)
      const sync = () => syncLabels()
      const observer = new MutationObserver(sync)
      observer.observe(document.body, { childList: true, subtree: true })
      media.addEventListener('change', sync)
      sync()
      ctx.effect(() => () => {
        observer.disconnect()
        media.removeEventListener('change', sync)
        style.remove()
        document.documentElement.removeAttribute(GATE_ATTRIBUTE)
        for (const element of document.querySelectorAll(`[${HIDDEN_ATTRIBUTE}]`)) {
          element.removeAttribute(HIDDEN_ATTRIBUTE)
        }
      }, 'dsbot-mobile-desktop-gate: mobile-only desktop UI')
    }

    exports.apply = apply
    return exports
  },
})
