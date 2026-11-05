import { test } from 'node:test'
import assert from 'node:assert/strict'
import { injectIframeHtml } from '../src/host/path.js'

test('injects the mobile stylesheet and clipboard fallback without rewriting URLs', () => {
  const html = '<!doctype html><html><head><base href="./"></head><body><script src="/assets/app.js"></script></body></html>'
  const out = injectIframeHtml(html)
  assert.equal((out.match(/data-dsbot-iframe/g) ?? []).length, 5)
  assert.equal(out.includes('src="/assets/app.js"'), true)
  assert.equal(out.includes('header[class*="wSkVaW_header"][class*="wSkVaW_header"]'), true)
  assert.equal(out.includes('flex: 0 0 64px'), true)
  assert.equal(out.includes('.bt-row .bt-mark'), true)
  assert.equal(out.includes('-webkit-tap-highlight-color: transparent'), true)
  assert.equal(out.includes('touch-action: manipulation'), true)
  assert.equal(out.includes('data-dsbot-harness'), true)
  assert.equal(out.includes('dsbot-hub:ready'), true)
  assert.equal(out.includes('overscroll-behavior: none'), true)
  assert.equal(out.includes('@media (max-width: 1024px)'), true)
  assert.equal(out.includes('header.style.setProperty'), true)
  assert.equal(out.includes('href="/assets/app.js"'), false)
  assert.equal(out.includes('<base href="./">'), true)
})

test('injects into a document without a head', () => {
  const out = injectIframeHtml('<body>hello</body>')
  assert.equal(out.startsWith('<style data-dsbot-iframe>'), true)
  assert.equal(out.endsWith('<body>hello</body>'), true)
})
