import assert from 'node:assert/strict'
import test from 'node:test'
import { Readable } from 'node:stream'
import { PanelApi } from '../src/host/routes.js'

function response() {
  const state = { status: 0, body: '' }
  return {
    state,
    writeHead(status) { state.status = status },
    end(body) { state.body = body },
  }
}

function request(payload) {
  return Readable.from([Buffer.from(JSON.stringify(payload))])
}

function makeApi({ entries = [], current = [], removed = [] } = {}) {
  let config = { servers: current, panel: { defaultServer: 'alpha' }, proxy: { listen: '127.0.0.1:13091' }, dev: {} }
  const entry = { options: { id: 'dsbot-hub', name: 'dsbot-hub', config } }
  const unset = []
  const configEditor = {
    entries: () => [...entries, entry],
    configuration: () => [{ entry, inherited: {}, override: config }],
    async edit(target, change) {
      config = change(config, {})
      target.options.config = config
    },
  }
  const ctx = {
    get(key) {
      if (key === 'configEditor') return configEditor
      if (key === 'credentials') return { async unset(ref) { unset.push(ref) } }
      return undefined
    },
  }
  const api = new PanelApi(ctx, [], new Map(), null, null, {}, () => {})
  return { api, getConfig: () => config, unset, entry }
}

test('PUT settings persists a rename/reorder and preserves hidden fields', async () => {
  const { api, getConfig, unset } = makeApi({
    current: [
      { id: 'alpha', label: 'Alpha', endpoint: 'http://127.0.0.1:8080', origin: 'http://127.0.0.1:13090', cookieRef: 'DSBOT_ALPHA_COOKIE', devCookieFile: '/tmp/alpha.jar' },
      { id: 'beta', label: 'Beta', endpoint: 'http://127.0.0.1:8081', origin: 'http://127.0.0.1:13091', cookieRef: 'DSBOT_BETA_COOKIE' },
    ],
  })
  const res = response()
  await api.updateServers(request({
    servers: [
      { id: 'beta', label: 'Beta Prime', endpoint: 'http://127.0.0.1:8081', origin: 'http://127.0.0.1:13091', cookieRef: 'DSBOT_BETA_COOKIE' },
      { id: 'alpha', label: 'Alpha', endpoint: 'http://127.0.0.1:8080', origin: 'http://127.0.0.1:13090', cookieRef: 'DSBOT_ALPHA_COOKIE' },
      { id: 'gamma', label: 'Gamma', endpoint: 'http://127.0.0.1:8082', origin: 'http://127.0.0.1:13092', cookieRef: 'DSBOT_GAMMA_COOKIE' },
    ],
  }), res)
  assert.equal(res.state.status, 200)
  const body = JSON.parse(res.state.body)
  assert.equal(body.ok, true)
  const config = getConfig()
  assert.deepEqual(config.servers.map(server => server.id), ['beta', 'alpha', 'gamma'])
  assert.equal(config.servers[0].label, 'Beta Prime')
  assert.equal(config.servers[1].devCookieFile, '/tmp/alpha.jar')
  assert.deepEqual(unset, [])
  assert.equal(config.panel.defaultServer, 'alpha')
})

test('deleting a server persists the list and unsets its cookie', async () => {
  const { api, getConfig, unset } = makeApi({
    current: [
      { id: 'alpha', label: 'Alpha', endpoint: 'http://127.0.0.1:8080', origin: 'http://127.0.0.1:13090', cookieRef: 'DSBOT_ALPHA_COOKIE' },
      { id: 'beta', label: 'Beta', endpoint: 'http://127.0.0.1:8081', origin: 'http://127.0.0.1:13091', cookieRef: 'DSBOT_BETA_COOKIE' },
    ],
  })
  const res = response()
  await api.updateServers(request({ servers: [{ id: 'alpha', label: 'Alpha', endpoint: 'http://127.0.0.1:8080', origin: 'http://127.0.0.1:13090', cookieRef: 'DSBOT_ALPHA_COOKIE' }] }), res)
  assert.equal(res.state.status, 200)
  assert.deepEqual(getConfig().servers.map(server => server.id), ['alpha'])
  assert.deepEqual(unset, ['DSBOT_BETA_COOKIE'])
})

test('invalid settings return 400 with fields and do not persist', async () => {
  const { api, getConfig } = makeApi({ current: [{ id: 'alpha', label: 'Alpha', endpoint: 'http://127.0.0.1:8080', origin: 'http://127.0.0.1:13090' }] })
  const res = response()
  await api.updateServers(request({ servers: [{ id: 'alpha', label: 'Alpha', endpoint: 'bad', origin: 'http://127.0.0.1:13090' }] }), res)
  assert.equal(res.state.status, 400)
  const body = JSON.parse(res.state.body)
  assert.equal(body.ok, false)
  assert.ok(Array.isArray(body.fields))
  assert.deepEqual(getConfig().servers.map(server => server.id), ['alpha'])
})

test('missing config entry returns 503 with the entry ids', async () => {
  const entry = { options: { id: 'other-plugin', name: 'other' } }
  const configEditor = { entries: () => [entry], configuration: () => [], edit: async () => {} }
  const ctx = { get: key => key === 'configEditor' ? configEditor : undefined }
  const api = new PanelApi(ctx, [], new Map(), null, null, {}, () => {})
  const res = response()
  await api.updateServers(request({ servers: [] }), res)
  assert.equal(res.state.status, 503)
  const body = JSON.parse(res.state.body)
  assert.deepEqual(body.entries, ['other-plugin'])
})

function apiForServer() {
  const servers = [{ id: 'alpha', label: 'Alpha', endpoint: 'http://127.0.0.1:8080', origin: 'http://127.0.0.1:13090' }]
  const seen = []
  const proxy = {
    isActive: () => true,
    grantUrlFor(server, ttl, req) {
      seen.push({ id: server.id, ttl, host: req.headers.host })
      return `http://127.0.0.1:13090/__dsbot-hub/auth?grant=${encodeURIComponent(req.headers.host)}`
    },
    grantUrl() { throw new Error('grantUrl must not be used for a request') },
  }
  const ctx = {
    get(key) {
      if (key === 'connection') return { requestRejection: () => undefined }
      return undefined
    },
  }
  return { api: new PanelApi(ctx, servers, new Map(), null, proxy, { proxy: { grantTtlSeconds: 60 } }, () => {}), seen }
}

test('the /open route redirects to a request-derived grant URL', async () => {
  const { api, seen } = apiForServer()
  const res = response()
  const headers = {}
  res.writeHead = (status, values) => { res.state.status = status; Object.assign(headers, values) }
  await api.handle({ url: '/dsbot-hub/api/servers/alpha/open', method: 'GET', headers: { host: 'hub.tailnet:3081' } }, res)
  assert.equal(res.state.status, 302)
  assert.equal(headers.location, 'http://127.0.0.1:13090/__dsbot-hub/auth?grant=hub.tailnet%3A3081')
  assert.equal(seen[0].host, 'hub.tailnet:3081')
})

test('the grant JSON route uses the same request-derived origin', async () => {
  const { api } = apiForServer()
  const res = response()
  await api.handle({ url: '/dsbot-hub/api/servers/alpha/grant', method: 'GET', headers: { host: 'hub.tailnet:3081' } }, res)
  assert.equal(res.state.status, 200)
  const body = JSON.parse(res.state.body)
  assert.equal(body.ok, true)
  assert.equal(body.url, 'http://127.0.0.1:13090/__dsbot-hub/auth?grant=hub.tailnet%3A3081')
})

function apiWithEditor() {
  const entry = { options: { id: 'dsbot-hub', name: 'dsbot-hub', config: { servers: [] } } }
  const configEditor = {
    entries: () => [entry],
    configuration: () => [{ entry, override: { servers: [] }, inherited: {} }],
    async edit() {},
  }
  const ctx = {
    get(key) {
      if (key === 'connection') return { requestRejection: () => undefined }
      if (key === 'configEditor') return configEditor
      return undefined
    },
  }
  return new PanelApi(ctx, [], new Map(), null, null, { proxy: {} }, () => {})
}

test('malformed JSON returns 400 instead of 500', async () => {
  const api = apiWithEditor()
  const req = Readable.from([Buffer.from('{not json')])
  req.url = '/dsbot-hub/api/settings/servers'
  req.method = 'PUT'
  req.headers = { host: 'hub:3081' }
  const res = response()
  await api.handle(req, res)
  assert.equal(res.state.status, 400)
})

test('oversized bodies return 413 instead of 500', async () => {
  const api = apiWithEditor()
  const req = Readable.from([Buffer.alloc(70 * 1024)])
  req.url = '/dsbot-hub/api/settings/servers'
  req.method = 'PUT'
  req.headers = { host: 'hub:3081' }
  const res = response()
  await api.handle(req, res)
  assert.equal(res.state.status, 413)
})
