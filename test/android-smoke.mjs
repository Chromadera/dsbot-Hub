#!/usr/bin/env node
/**
 * Optional browser smoke test for the live hub. Not part of `npm test`.
 *
 *   AUDIT_BASE_URL=http://<host>:<port> AUDIT_TOKEN='<token>' \
 *     node test/android-smoke.mjs
 *
 * Chromium only; use a physical Android phone for the final release pass.
 */

const base = process.env.AUDIT_BASE_URL
const token = process.env.AUDIT_TOKEN
if (!base || !token) {
  console.error('Set AUDIT_BASE_URL and AUDIT_TOKEN.')
  process.exit(2)
}

let chromium
try { ({ chromium } = await import('playwright')) } catch {
  console.error('Install playwright in this checkout to run the smoke test: npm i -D playwright')
  process.exit(2)
}

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
)
const checks = []
function check(name, condition, detail = '') {
  checks.push({ name, ok: Boolean(condition), detail })
}

async function open(viewport, mobile) {
  const context = await browser.newContext({
    viewport,
    isMobile: mobile,
    hasTouch: mobile,
    deviceScaleFactor: mobile ? 3 : 1,
  })
  const page = await context.newPage()
  await page.goto(`${base}/?token=${encodeURIComponent(token)}`, { waitUntil: 'load' })
  await page.waitForTimeout(2500)
  const dialog = page.getByRole('dialog')
  if (await dialog.count()) {
    const close = dialog.first().getByRole('button', { name: /Close|Get started/i })
    if (await close.count()) await close.first().click().catch(() => {})
    else await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
  }
  return { context, page }
}

try {
  // Pixel 7 is the Android reference; 412x839 CSS viewport in Chromium.
  const phone = await open({ width: 412, height: 839 }, true)
  const mobile = await phone.page.evaluate(() => ({
    shell: document.querySelector('[data-shell]')?.getAttribute('data-shell'),
    nav: document.querySelector('[data-shell-mobile-nav]')?.innerText?.replace(/\n/g, ' '),
    gate: document.documentElement.hasAttribute('data-dsbot-mobile-gate'),
    dskin: [...document.querySelectorAll('[class*="VUpDDW_"]')].filter(e => e.getClientRects().length > 0).length,
    better: [...document.querySelectorAll('[class*="nArs4W_"]')].filter(e => e.getClientRects().length > 0).length,
    overflow: document.documentElement.scrollWidth > innerWidth,
  }))
  check('mobile shell', mobile.shell === 'mobile', JSON.stringify(mobile))
  check('bottom navigation', /Chat/.test(mobile.nav ?? '') && /Bots/.test(mobile.nav ?? ''), mobile.nav)
  check('no page horizontal overflow', mobile.overflow === false)
  check('desktop gate active', mobile.gate === true)
  check('dskin hidden on mobile', mobile.dskin === 0, String(mobile.dskin))
  check('better-sidebar hidden on mobile', mobile.better === 0, String(mobile.better))
  await phone.context.close()

  const desktop = await open({ width: 1280, height: 800 }, false)
  const laptop = await desktop.page.evaluate(() => ({
    mobileNav: Boolean(document.querySelector('[data-shell-mobile-nav]')),
    gate: document.documentElement.hasAttribute('data-dsbot-mobile-gate'),
    dskin: [...document.querySelectorAll('[class*="VUpDDW_"]')].filter(e => e.getClientRects().length > 0).length,
    better: [...document.querySelectorAll('[class*="nArs4W_"]')].filter(e => e.getClientRects().length > 0).length,
    overflow: document.documentElement.scrollWidth > innerWidth,
  }))
  check('desktop shell has no mobile nav', laptop.mobileNav === false)
  check('desktop gate inactive', laptop.gate === false)
  // dskin and the better-sidebar workbench appear only when installed and, for
  // the workbench, often only after a Session is open. Record them, don't fail.
  console.log('desktop plugin counts', JSON.stringify({ dskin: laptop.dskin, better: laptop.better }))
  check('desktop no page overflow', laptop.overflow === false)
  await desktop.context.close()
} finally {
  await browser.close()
}

for (const result of checks) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? `  ${result.detail}` : ''}`)
}
if (checks.some(result => !result.ok)) process.exit(1)
