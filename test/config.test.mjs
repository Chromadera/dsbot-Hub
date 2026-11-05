import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeConfig } from '../src/host/config.js'

test('normalizes a server and keeps its origin', () => {
  const config = normalizeConfig({
    servers: [{ id: 'alpha', label: 'Alpha', endpoint: 'http://127.0.0.1:8080/', origin: 'http://127.0.0.1:13090/' }],
    panel: { defaultServer: 'alpha' },
  })
  assert.equal(config.servers.length, 1)
  assert.equal(config.servers[0].endpoint, 'http://127.0.0.1:8080')
  assert.equal(config.servers[0].origin, 'http://127.0.0.1:13090')
  assert.equal(config.servers[0].cookieRef, 'DSBOT_ALPHA_COOKIE')
  assert.equal(config.panel.defaultServer, 'alpha')
})

test('accepts hostname as an https origin', () => {
  const config = normalizeConfig({
    servers: [{ id: 'beta', endpoint: 'http://127.0.0.1:8081', hostname: 'beta.example.com' }],
  })
  assert.equal(config.servers[0].origin, 'https://beta.example.com')
})

test('drops invalid and duplicate servers', () => {
  const config = normalizeConfig({
    servers: [
      { id: 'Alpha!', endpoint: 'http://127.0.0.1:1', origin: 'http://127.0.0.1:2' },
      { id: 'a', endpoint: 'not a url', origin: 'http://127.0.0.1:2' },
      { id: 'a', endpoint: 'http://127.0.0.1:8080', origin: 'http://127.0.0.1:13090' },
      { id: 'a', endpoint: 'http://127.0.0.1:8081', origin: 'http://127.0.0.1:13091' },
    ],
  })
  assert.equal(config.servers.length, 1)
  assert.equal(config.servers[0].id, 'a')
  assert.equal(config.servers[0].endpoint, 'http://127.0.0.1:8080')
})

test('falls back to the first server when the default is unknown', () => {
  const config = normalizeConfig({
    servers: [
      { id: 'a', endpoint: 'http://127.0.0.1:8080', origin: 'http://127.0.0.1:13090' },
      { id: 'b', endpoint: 'http://127.0.0.1:8081', origin: 'http://127.0.0.1:13091' },
    ],
    panel: { defaultServer: 'missing' },
  })
  assert.equal(config.panel.defaultServer, 'a')
})

test('applies proxy defaults and caps', () => {
  const config = normalizeConfig({ proxy: { grantTtlSeconds: 10_000, sessionHours: 10_000 } })
  assert.equal(config.proxy.listen, '127.0.0.1:13091')
  assert.equal(config.proxy.grantTtlSeconds, 600)
  assert.equal(config.proxy.sessionHours, 24 * 30)
  assert.equal(config.proxy.sessionHours > 0, true)
})

test('an empty config is valid and has no servers', () => {
  const config = normalizeConfig({})
  assert.deepEqual(config.servers, [])
  assert.equal(config.panel.defaultServer, '')
})

test('defaults the proxy listener to loopback', () => {
  const config = normalizeConfig({})
  assert.equal(config.proxy.bind, '127.0.0.1')
})

test('drops duplicate origins and origins with a path', () => {
  const config = normalizeConfig({
    servers: [
      { id: 'a', endpoint: 'http://127.0.0.1:8080', origin: 'http://127.0.0.1:13090' },
      { id: 'b', endpoint: 'http://127.0.0.1:8081', origin: 'http://127.0.0.1:13090/' },
      { id: 'c', endpoint: 'http://127.0.0.1:8082', origin: 'http://127.0.0.1:13091/team' },
    ],
  })
  assert.deepEqual(config.servers.map(server => server.id), ['a'])
})

test('assigns a free origin to a hand-written server that omits it', () => {
  const config = normalizeConfig({
    servers: [
      { id: 'a', endpoint: 'http://127.0.0.1:8080', origin: 'http://127.0.0.1:13090' },
      { id: 'b', endpoint: 'http://127.0.0.1:8081' },
    ],
    proxy: { listen: '127.0.0.1:13091' },
  })
  assert.equal(config.servers[1].origin, 'http://127.0.0.1:13092')
})
