import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeConfig } from '../src/host/config.js'
import { ProxyManager } from '../src/host/proxy.js'

const config = normalizeConfig({
  servers: [
    { id: 'alpha', label: 'Alpha', endpoint: 'http://127.0.0.1:8080', origin: 'http://127.0.0.1:13090' },
    { id: 'beta', label: 'Beta', endpoint: 'http://127.0.0.1:8081', origin: 'http://127.0.0.1:13091' },
  ],
  proxy: { grantTtlSeconds: 60, sessionHours: 1 },
})
const [alpha, beta] = config.servers
const proxy = new ProxyManager(config.servers, new Map(), config, () => {})

test('a grant verifies only for its own server', () => {
  const grant = proxy.grant(alpha, 60)
  assert.equal(proxy.verifyGrant(alpha, grant), true)
  assert.equal(proxy.verifyGrant(beta, grant), false)
})

test('an expired grant is rejected', () => {
  const grant = proxy.grant(alpha, -1)
  assert.equal(proxy.verifyGrant(alpha, grant), false)
})

test('a malformed grant is rejected without throwing', () => {
  assert.equal(proxy.verifyGrant(alpha, ''), false)
  assert.equal(proxy.verifyGrant(alpha, 'not-a-grant'), false)
  assert.equal(proxy.verifyGrant(alpha, 'a.b.c'), false)
})

test('a session verifies only for its own server', () => {
  const value = proxy.sessionValue(alpha)
  assert.equal(proxy.verifySession(alpha, value), true)
  assert.equal(proxy.verifySession(beta, value), false)
})

test('the grant URL uses the public origin', () => {
  const url = proxy.grantUrl(alpha, 60)
  assert.equal(url.startsWith('http://127.0.0.1:13090/__dsbot-hub/auth?grant='), true)
})

test('cookie names are sanitized and per-server', () => {
  assert.equal(proxy.cookieName(alpha), 'dbh_alpha')
  assert.equal(proxy.cookieName({ id: 'with space!' }), 'dbh_with_space_')
})

test('Location is rewritten from the upstream origin to the public origin', () => {
  assert.equal(
    proxy.rewriteLocation(alpha, 'http://127.0.0.1:8080/login?x=1'),
    'http://127.0.0.1:13090/login?x=1',
  )
  assert.equal(proxy.rewriteLocation(alpha, 'https://elsewhere.example/'), 'https://elsewhere.example/')
})

test('a grant and a session are different token kinds', () => {
  const grant = proxy.grant(alpha, 60)
  const session = proxy.sessionValue(alpha)
  assert.equal(proxy.verifyGrant(alpha, grant), true)
  assert.equal(proxy.verifySession(alpha, grant), false)
  assert.equal(proxy.verifyGrant(alpha, session), false)
  assert.equal(proxy.verifySession(alpha, session), true)
})

test('a loopback origin follows the request host so the iframe is same-site', () => {
  const request = { headers: { host: 'hub.example.com:3081' } }
  assert.equal(proxy.publicOrigin(alpha, request), 'http://hub.example.com:13090')
  assert.equal(
    proxy.grantUrlFor(alpha, 60, request).startsWith('http://hub.example.com:13090/__dsbot-hub/auth?grant='),
    true,
  )
})

test('a hostname origin keeps its configured origin', () => {
  const configured = { ...alpha, origin: 'https://alpha.example.com' }
  assert.equal(proxy.publicOrigin(configured, { headers: { host: 'hub.example.com:3081' } }), 'https://alpha.example.com')
})

test('Location rewrite uses the request origin for a loopback server', () => {
  assert.equal(
    proxy.rewriteLocation(alpha, 'http://127.0.0.1:8080/login?x=1', { headers: { host: 'hub.example.com:3081' } }),
    'http://hub.example.com:13090/login?x=1',
  )
  assert.equal(
    proxy.rewriteLocation(alpha, 'http://127.0.0.1:8080.evil.example/login', { headers: { host: 'hub.example.com:3081' } }),
    'http://127.0.0.1:8080.evil.example/login',
  )
})
