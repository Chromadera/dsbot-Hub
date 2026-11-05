/**
 * The only document change the hub makes to a team's own UI: a small
 * mobile-width stylesheet and a clipboard fallback for plain-HTTP origins.
 *
 * The app is served at its own origin root, so no URL rewriting, no `<base>`
 * fix-up and no WebSocket/fetch shim are needed (or wanted).
 */

const IFRAME_CSS = `
/* The team's own responsive layout is left alone. These rules only fix the
   phone-width allocation the stock UI still gets wrong: a desktop-sized bot
   rail steals a third of the viewport and the chat bubble keeps a desktop
   avatar gutter. Keep selectors on the stable bt-* classes, never a build hash. */
/* Mobile platform tells (web-in-iframe): remove the browser tap flash, keep
   pull-to-refresh out of an app-like surface, make controls non-selectable,
   and let taps fire without the double-tap-zoom wait. */
html { -webkit-tap-highlight-color: transparent; }
html, body { overscroll-behavior: none; }
button, a, [role="button"] {
  touch-action: manipulation;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}
@media (pointer: coarse) {
  input, textarea, select { font-size: 16px !important; }
}
@media (hover: none), (pointer: coarse) {
  button:active, a:active, [role="button"]:active { filter: brightness(0.94); }
}
/* The app's own header rule outranks a single generated-class selector, so
   repeat it. From 701-1024px (landscape phones, tablets, Fold) the header
   would otherwise stay transparent and transcript text would paint through it. */
@media (max-width: 1024px) {
  header[class*="wSkVaW_header"][class*="wSkVaW_header"] {
    background-color: var(--bt-main, #141414) !important;
  }
}
@media (max-width: 700px) {
  /* The stock avatars are already object-avatars; the desktop rail is what
     makes them feel clunky. Compact the rail only at phone/sidecard widths;
     701-1024 keeps the stock tablet rail so it does not half-switch. */
  .bt-side.bt-rail, .bt-rail {
    flex: 0 0 64px !important;
    width: 64px !important;
    min-width: 64px !important;
    max-width: 64px !important;
  }
  .bt-rail .bt-rail-top { width: 44px !important; margin-left: 10px !important; }
  .bt-rail .bt-side-collapse { width: 32px !important; height: 32px !important; }
  .bt-rail .bt-list { width: 64px !important; gap: 4px !important; overscroll-behavior: contain; }
  .bt-rail .bt-row {
    width: 44px !important;
    height: 44px !important;
    min-height: 44px !important;
    max-height: 44px !important;
    margin: 0 10px !important;
    padding: 0 !important;
    border-radius: 14px !important;
  }
  .bt-rail .bt-row .bt-mark {
    width: 32px !important;
    height: 32px !important;
    --bt-size: 32px !important;
  }
  .bt-rail .bt-rail-sep { width: 20px !important; margin-left: 22px !important; }
  .bt-rail { overflow: hidden !important; }
  .bt-rail [class*="name"], .bt-rail [class*="label"] { display: none !important; }
  .bt-rail .bt-leftcol-foot-rail { width: 44px !important; margin-left: 10px !important; gap: 6px !important; }
  .bt-leftcol-foot-rail .bt-round, .bt-leftcol-foot-rail .bt-account { width: 44px !important; height: 44px !important; }
  /* Keep the utility chrome quiet so the bot marks are the only bright rail. */
  .bt-rail .bt-side-collapse,
  .bt-leftcol-foot-rail .bt-round,
  .bt-leftcol-foot-rail .bt-account {
    background: transparent !important;
    border-color: transparent !important;
    color: var(--bt-muted, #9aa3ac) !important;
    box-shadow: none !important;
  }
  .bt-rail .bt-badge {
    width: 8px !important;
    height: 8px !important;
    min-width: 8px !important;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 50% !important;
    font-size: 0 !important;
    box-shadow: none !important;
  }
  .bt-rail .bt-badge-alert { background: #7c9cff !important; }
  .bt-leftcol-foot-rail .bt-account .bt-you {
    background: transparent !important;
    box-shadow: none !important;
    color: var(--bt-muted, #9aa3ac) !important;
  }
  /* Pointer feedback and keyboard focus on the compact rail. */
  .bt-rail .bt-row {
    transition: transform 120ms cubic-bezier(0.23, 1, 0.32, 1),
      background-color 150ms ease !important;
  }
  .bt-rail .bt-row:active { transform: scale(0.96) !important; }
  .bt-rail .bt-row:focus-visible,
  .bt-rail .bt-side-collapse:focus-visible,
  .bt-rail .bt-leftcol-foot-rail .bt-round:focus-visible,
  .bt-rail .bt-leftcol-foot-rail .bt-account:focus-visible {
    outline: 2px solid var(--bt-accent, #6b8cff) !important;
    outline-offset: 2px;
  }
  /* Enlarge the hit area of the 32px utility controls without growing the rail. */
  .bt-side-collapse,
  .bt-leftcol-foot-rail .bt-round,
  .bt-leftcol-foot-rail .bt-account {
    position: relative;
  }
  .bt-side-collapse::after,
  .bt-leftcol-foot-rail .bt-round::after,
  .bt-leftcol-foot-rail .bt-account::after {
    content: "";
    position: absolute;
    inset: -6px;
    border-radius: inherit;
  }
}
@media (hover: none), (pointer: coarse) {
  [class*="themeCube"]:hover { transform: none !important; }
}
@media (prefers-reduced-motion: reduce) {
  .bt-rail .bt-row {
    transition: none !important;
  }
  .bt-rail .bt-row:active {
    transform: none !important;
  }
  .bt-mark svg,
  .bt-mark svg * {
    animation: none !important;
    transition: none !important;
  }
}
@media (max-width: 700px) {
  .bt-head {
    height: 44px !important;
    padding: 0 8px !important;
    /* The stock header is transparent; on a phone the scrolled transcript
       otherwise paints through the title pill. */
    background: var(--bt-main, #141414) !important;
    z-index: 3;
  }
  .bt-pill { height: 36px !important; max-width: 78% !important; padding: 5px 10px 5px 6px !important; }
  .bt-pill-name { font-size: 13px !important; }
  .bt-pill-mem, .bt-pill-mem-in { display: none !important; }
  .bt-msg { width: calc(100% - 16px) !important; max-width: calc(100% - 16px) !important; }
  .bt-msg-line { max-width: 100% !important; min-width: 0 !important; }
  .bt-bubble { max-width: 100% !important; padding: 8px 12px !important; }
  body { --bt-msg-w: 1 !important; }
  .bt-msg-line { font-size: 13.5px; line-height: 1.5; }
  .bt-model-dock { border-radius: 14px !important; }
  .bt-astack { padding: 8px !important; }
  .bt-composer, .bt-input, .bt-msg-input { font-size: 16px !important; }
  /* Cards and tool results must never push the viewport wide. */
  .bt-card, .bt-mw-card, .bt-us-card, .bt-bcard { min-width: 0 !important; max-width: 100% !important; overflow-wrap: anywhere; }
  .bt-fold-pre, .bt-mw-code, table { max-width: 100% !important; overflow-x: auto !important; }
  .bt-fold-pre { white-space: pre !important; }
  img, video { max-width: 100% !important; height: auto !important; }
}

/* DSH Harness settings is a desktop two-pane dialog: 188px nav + 154px
   content inside a 342px panel. On mobile it becomes a full-width sheet with
   the same four sections in a native picker. */
@media (max-width: 1024px) {
  [data-dsbot-harness-overlay] {
    padding: 0 !important;
    align-items: stretch !important;
    justify-content: stretch !important;
  }
  [data-dsbot-harness] {
    width: 100% !important;
    height: 100% !important;
    max-width: none !important;
    max-height: none !important;
    border-radius: 0 !important;
    flex-direction: column !important;
    overflow: hidden !important;
  }
  [data-dsbot-harness-nav] {
    width: 100% !important;
    height: auto !important;
    flex: 0 0 auto !important;
    padding: 4px 56px 4px 8px !important;
    border-right: 0 !important;
    border-bottom: 1px solid color-mix(in srgb, currentColor 12%, transparent) !important;
    overflow: visible !important;
  }
  [data-dsbot-harness-content] {
    width: 100% !important;
    min-width: 0 !important;
    flex: 1 1 auto !important;
    overflow: auto !important;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    padding-bottom: calc(8px + env(safe-area-inset-bottom)) !important;
  }
  [data-dsbot-harness-close] {
    position: fixed !important;
    top: 10px !important;
    right: 12px !important;
    width: 44px !important;
    height: 44px !important;
    z-index: 20 !important;
  }
  [data-dsbot-harness-content] > :first-child { margin-top: 0 !important; padding-top: 0 !important; }
  [data-dsbot-harness-nav] > div:first-child { display: none !important; }
  [data-dsbot-harness-nav] > div:nth-child(2) {
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    gap: 4px !important;
    width: 100% !important;
    height: 44px !important;
    overflow-x: auto !important;
    scrollbar-width: none;
  }
  [data-dsbot-harness-nav] > div:nth-child(2)::-webkit-scrollbar { display: none; }
  [data-dsbot-harness-nav] > div:nth-child(2) > button {
    flex: 0 0 auto !important;
    width: auto !important;
    min-width: 0 !important;
    height: 36px !important;
    padding: 0 10px !important;
    gap: 6px !important;
    border-radius: 10px !important;
    font-size: 13px !important;
  }
  [data-dsbot-harness-nav] > div:nth-child(2) > button svg { width: 14px !important; height: 14px !important; }
  [data-dsbot-harness-nav] > div:nth-child(2) > button[aria-current="true"] {
    background: color-mix(in srgb, currentColor 8%, transparent) !important;
  }
}

@media (max-width: 700px) and (hover: hover) and (pointer: fine) {
  .bt-rail .bt-side-collapse:hover,
  .bt-leftcol-foot-rail .bt-round:hover,
  .bt-leftcol-foot-rail .bt-account:hover {
    background: rgba(255, 255, 255, .06) !important;
    color: var(--bt-text, #f2f2f2) !important;
  }
  .bt-leftcol-foot-rail .bt-account:hover .bt-you { color: var(--bt-text, #f2f2f2) !important; }
}
@media (max-width: 700px) {
  .bt-rail .bt-side-collapse:active,
  .bt-leftcol-foot-rail .bt-round:active,
  .bt-leftcol-foot-rail .bt-account:active { background: rgba(255, 255, 255, .08) !important; }
}
`

/* The app mounts its header stylesheet after this document's first paint, so a
   CSS rule inside the injected style can still lose the cascade. Set the
   computed page colour inline after mount; it is a paint-only fallback. */
const HEADER_FALLBACK = `<script data-dsbot-iframe>(function(){function apply(){var header=document.querySelector('header[class*="wSkVaW_header"]');if(!header||!document.body)return;var color=getComputedStyle(document.body).backgroundColor;if(!color||color==='rgba(0, 0, 0, 0)')color='#141414';header.style.setProperty('background-color',color,'important')}function schedule(){apply();setTimeout(apply,600);setTimeout(apply,2000)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule()})();</script>`

const CLIPBOARD_FALLBACK = `<script data-dsbot-iframe>(function(){if(navigator.clipboard&&typeof navigator.clipboard.writeText==='function')return;try{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:function(text){var area=document.createElement('textarea');area.value=String(text);area.setAttribute('readonly','');area.style.position='fixed';area.style.left='-9999px';document.body.appendChild(area);var selection=document.getSelection();var previous=selection&&selection.rangeCount?selection.getRangeAt(0):null;area.select();var copied=false;try{copied=document.execCommand('copy')}catch(error){}area.remove();if(previous&&selection){selection.removeAllRanges();selection.addRange(previous)}return copied?Promise.resolve():Promise.reject(new Error('copy failed'))},readText:function(){return Promise.reject(new Error('clipboard unavailable'))}}})}catch(error){}})();</script>`

/** Insert the mobile stylesheet, header paint fallback and clipboard fallback once, before `</head>`. */
const READY_SIGNAL = `<script data-dsbot-iframe>(function(){if(window.parent===window)return;if(window.__dsbotHubReadySent)return;function send(){if(window.__dsbotHubReadySent)return;window.__dsbotHubReadySent=true;try{window.parent.postMessage({type:'dsbot-hub:ready'},'*')}catch(error){}}function ready(){if(!document.querySelector('.bt-rail'))return false;return !!document.querySelector('.bt-msg')}function check(){if(ready())send()}new MutationObserver(check).observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('load',function(){setTimeout(function(){if(!ready()&&document.querySelector('.bt-rail'))send()},4000)},{once:true});check()})();</script>`

const HARNESS_PICKER = `<script data-dsbot-iframe>(function(){if(window.__dsbotHubHarnessPicker)return;window.__dsbotHubHarnessPicker=true;var mq=window.matchMedia('(max-width: 1024px)');function teardown(){var panel=document.querySelector('[data-dsbot-harness]');if(!panel)return;panel.removeAttribute('data-dsbot-harness');var ov=panel.parentElement;if(ov)ov.removeAttribute('data-dsbot-harness-overlay');var nav=panel.querySelector('[data-dsbot-harness-nav]');if(nav)nav.removeAttribute('data-dsbot-harness-nav');var c=panel.querySelector('[data-dsbot-harness-content]');if(c)c.removeAttribute('data-dsbot-harness-content');var close=panel.querySelector('[data-dsbot-harness-close]');if(close)close.removeAttribute('data-dsbot-harness-close')}function init(){if(!mq.matches)return;var panel=document.querySelector('[data-shortcut-modal="settings"]');if(!panel)return;if(panel.getAttribute('data-dsbot-harness'))return;var nav=panel.querySelector(':scope > nav');if(!nav)return;var content=[].slice.call(panel.children).find(function(c){return c!==nav});if(!content)return;var close=panel.querySelector('[aria-label*="Close"]')||[].slice.call(panel.querySelectorAll('button')).find(function(b){return (b.textContent||'').trim()==='Close'});if(close)close.setAttribute('data-dsbot-harness-close','1');panel.setAttribute('data-dsbot-harness','1');nav.setAttribute('data-dsbot-harness-nav','1');content.setAttribute('data-dsbot-harness-content','1');var ov=panel.parentElement;if(ov)ov.setAttribute('data-dsbot-harness-overlay','1')}mq.addEventListener('change',function(){if(mq.matches)init();else teardown()});new MutationObserver(init).observe(document.documentElement,{childList:true,subtree:true});init()})();</script>`


export function injectIframeHtml(html) {
  const out = String(html)
  const injection = `<style data-dsbot-iframe>${IFRAME_CSS}</style>${HEADER_FALLBACK}${CLIPBOARD_FALLBACK}${HARNESS_PICKER}${READY_SIGNAL}`
  if (out.includes('</head>')) return out.replace('</head>', `${injection}</head>`)
  return `${injection}${out}`
}

export { IFRAME_CSS }
