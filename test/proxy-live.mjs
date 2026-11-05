/**
 * Live proxy proof. Needs a reachable stock ds-bot and a cookie file:
 *
 *   DSBOT_LIVE_ENDPOINT=http://127.0.0.1:8081 \
 *   DSBOT_LIVE_COOKIE_FILE=/path/to/cookie.jar \
 *   DSBOT_LIVE_ORIGIN=http://127.0.0.1:13095 \
 *   DSBOT_LIVE_GRANT_FILE=/tmp/dsbot-hub-live-grant.txt \
 *   node test/proxy-live.mjs
 *
 * The cookie file is a Netscape jar or a raw `name=value` cookie string.
 * The script starts its own proxy listener; it does not touch the installed plugin.
 */
import { readFileSync } from 'node:fs'
import { connect } from 'node:net'
import { normalizeConfig } from '../src/host/config.js'
import { Health } from '../src/host/health.js'
import { ProxyManager } from '../src/host/proxy.js'
import { ServerSession } from '../src/host/session.js'

const endpoint = process.env.DSBOT_LIVE_ENDPOINT ?? ''
const cookieFile = process.env.DSBOT_LIVE_COOKIE_FILE ?? ''
if (endpoint === '' || cookieFile === '') {
  console.log('SKIP: set DSBOT_LIVE_ENDPOINT and DSBOT_LIVE_COOKIE_FILE to run the live proxy proof.')
  process.exit(0)
}

const id = process.env.DSBOT_LIVE_ID ?? 'live'
const label = process.env.DSBOT_LIVE_LABEL ?? 'Live DS Bot'
const origin = process.env.DSBOT_LIVE_ORIGIN ?? 'http://127.0.0.1:13095'
const grantFile = process.env.DSBOT_LIVE_GRANT_FILE ?? '/tmp/dsbot-hub-live-grant.txt'
const sharedListen = process.env.DSBOT_LIVE_SHARED_LISTEN ?? '127.0.0.1:13096'
const expectedBots = Number(process.env.DSBOT_LIVE_BOTS ?? '') || null
const originUrl = new URL(origin)

const config = normalizeConfig({
  servers: [{ id, label, endpoint, origin, cookieRef: `DSBOT_${id.toUpperCase()}_COOKIE`, devCookieFile: cookieFile }],
  proxy: { listen: sharedListen, grantTtlSeconds: 120, sessionHours: 1 },
  dev: { grantFile, grantTtlSeconds: 300 },
})

const ctx = { get: () => undefined }
const log = (...args) => console.log('[live]', ...args)
const sessions = new Map(config.servers.map(server => [server.id, new ServerSession(server, ctx, log)]))
const health = new Health(config.servers, sessions, log)
const proxy = new ProxyManager(config.servers, sessions, config, log)

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

try {
  await proxy.start()
  health.start()
  await sleep(1500)
  const summary = health.summary()
  console.log('HEALTH', JSON.stringify(summary, null, 2))
  if (summary[0]?.status !== 'ok') throw new Error(`health is ${summary[0]?.status}: ${summary[0]?.reason}`)
  if (expectedBots !== null && summary[0]?.counts?.bots !== expectedBots) {
    throw new Error(`expected ${expectedBots} bots, got ${summary[0]?.counts?.bots}`)
  }

  const line = readFileSync(grantFile, 'utf8').trim().split('\n').find(row => row.startsWith(`${id}\t`))
  if (line === undefined) throw new Error('no grant line was written')
  const grantUrl = line.split('\t')[1]

  const noCookie = await fetch(`${origin}/`)
  console.log('NO COOKIE', noCookie.status)
  if (noCookie.status !== 401) throw new Error('proxy did not reject an unauthenticated request')

  const auth = await fetch(grantUrl, { redirect: 'manual' })
  const setCookie = auth.headers.getSetCookie?.()[0] ?? ''
  console.log('AUTH', auth.status, setCookie.split(';')[0])
  if (auth.status !== 302 || setCookie === '') throw new Error('grant did not mint a session')
  const cookie = setCookie.split(';')[0]

  const root = await fetch(`${origin}/`, { headers: { cookie } })
  const html = await root.text()
  console.log('ROOT', root.status, html.length, /DeepSeek Harness/.test(html) ? 'UI OK' : 'UI MISSING')
  if (root.status !== 200 || !/DeepSeek Harness/.test(html)) throw new Error('real UI did not render through the proxy')

  const state = await fetch(`${origin}/api/bot`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json', origin },
    body: JSON.stringify({ endpoint: 'state', payload: {} }),
  })
  const stateBody = await state.json()
  const bots = stateBody.value?.bots ?? []
  console.log('POST state', state.status, stateBody.ok, bots.length)
  if (state.status !== 200 || stateBody.ok !== true) throw new Error('state through the proxy failed')
  if (expectedBots !== null && bots.length !== expectedBots) throw new Error(`expected ${expectedBots} bots through the proxy, got ${bots.length}`)

  const wsStatus = await new Promise(resolve => {
    const socket = connect(Number(originUrl.port), originUrl.hostname)
    let buffer = ''
    const done = value => { try { socket.destroy() } catch {} ; resolve(value) }
    socket.setTimeout(6000, () => done('timeout'))
    socket.on('connect', () => {
      socket.write([
        'GET /api/remote.mux HTTP/1.1',
        `Host: ${originUrl.host}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
        'Sec-WebSocket-Version: 13',
        `Origin: ${origin}`,
        `Cookie: ${cookie}`,
        '', '',
      ].join('\r\n'))
    })
    socket.on('data', chunk => {
      buffer += chunk.toString('latin1')
      if (buffer.includes('\r\n\r\n')) done(buffer.split('\r\n')[0])
    })
    socket.on('error', error => done(`error: ${error.message}`))
  })
  console.log('WS upgrade', wsStatus)
  if (!String(wsStatus).includes('101')) throw new Error(`websocket upgrade failed: ${wsStatus}`)

  console.log('PASS')
} finally {
  health.stop()
  await proxy.close()
}
