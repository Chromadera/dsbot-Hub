import assert from 'node:assert/strict'
import test from 'node:test'
import { planServerUpdate } from '../src/host/settings.js'

const current = [
  { id: 'alpha', label: 'Alpha', endpoint: 'http://127.0.0.1:8080', origin: 'http://127.0.0.1:13090', cookieRef: 'DSBOT_ALPHA_COOKIE', devCookieFile: '/tmp/alpha.jar' },
  { id: 'beta', label: 'Beta', endpoint: 'http://127.0.0.1:8081', origin: 'http://127.0.0.1:13091', cookieRef: 'DSBOT_BETA_COOKIE' },
]

test('renames, reorders and adds servers while preserving hidden fields', () => {
  const { next, removed, errors } = planServerUpdate(current, [
    { id: 'beta', label: 'Beta Prime', endpoint: 'http://127.0.0.1:8081/', origin: 'http://127.0.0.1:13091/' },
    { id: 'alpha', label: 'Alpha', endpoint: 'http://127.0.0.1:8080', origin: 'http://127.0.0.1:13090' },
    { label: 'Gamma', endpoint: 'http://127.0.0.1:8082', origin: 'http://127.0.0.1:13092' },
  ])
  assert.deepEqual(errors, [])
  assert.deepEqual(next.map(server => server.id), ['beta', 'alpha', 'gamma'])
  assert.equal(next[0].label, 'Beta Prime')
  assert.equal(next[0].endpoint, 'http://127.0.0.1:8081')
  assert.equal(next[1].devCookieFile, '/tmp/alpha.jar')
  assert.equal(next[2].cookieRef, 'DSBOT_GAMMA_COOKIE')
  assert.deepEqual(removed, [])
})

test('removed servers are reported for credential cleanup', () => {
  const { next, removed } = planServerUpdate(current, [
    { id: 'alpha', label: 'Alpha', endpoint: 'http://127.0.0.1:8080', origin: 'http://127.0.0.1:13090' },
  ])
  assert.deepEqual(next.map(server => server.id), ['alpha'])
  assert.deepEqual(removed.map(server => server.id), ['beta'])
  assert.equal(removed[0].cookieRef, 'DSBOT_BETA_COOKIE')
})

test('rejects duplicate ids, duplicate origins and bad urls', () => {
  const duplicateId = planServerUpdate(current, [
    { id: 'alpha', label: 'One', endpoint: 'http://127.0.0.1:8080', origin: 'http://127.0.0.1:13090' },
    { id: 'alpha', label: 'Two', endpoint: 'http://127.0.0.1:8081', origin: 'http://127.0.0.1:13091' },
  ])
  assert.ok(duplicateId.errors.some(error => error.field === 'id'))
  const duplicateOrigin = planServerUpdate(current, [
    { id: 'one', label: 'One', endpoint: 'http://127.0.0.1:8080', origin: 'http://127.0.0.1:13090' },
    { id: 'two', label: 'Two', endpoint: 'http://127.0.0.1:8081', origin: 'http://127.0.0.1:13090' },
  ])
  assert.ok(duplicateOrigin.errors.some(error => error.field === 'origin'))
  const bad = planServerUpdate(current, [
    { id: 'one', label: 'One', endpoint: 'not-a-url', origin: 'ftp://example.com' },
  ])
  assert.ok(bad.errors.some(error => error.field === 'endpoint'))
  assert.ok(bad.errors.some(error => error.field === 'origin'))
})

test('blank id derives from the label and cookie ref stays valid', () => {
  const { next, errors } = planServerUpdate([], [{ label: 'Local PC!', endpoint: 'http://127.0.0.1:8080', origin: 'http://127.0.0.1:13090' }])
  assert.deepEqual(errors, [])
  assert.equal(next[0].id, 'local-pc')
  assert.equal(next[0].cookieRef, 'DSBOT_LOCAL_PC_COOKIE')
})

test('drops stale hostname when origin is edited', () => {
  const { next } = planServerUpdate([{ id: 'alpha', label: 'Alpha', endpoint: 'http://127.0.0.1:8080', hostname: 'old.example.com', origin: 'http://127.0.0.1:13090' }], [
    { id: 'alpha', label: 'Alpha', endpoint: 'http://127.0.0.1:8080', origin: 'http://127.0.0.1:13099' },
  ])
  assert.equal('hostname' in next[0], false)
  assert.equal(next[0].origin, 'http://127.0.0.1:13099')
})

test('allocates a private proxy origin when the form omits one', () => {
  const { next, errors } = planServerUpdate(current, [
    { id: 'beta', label: 'Beta', endpoint: 'http://127.0.0.1:8081' },
    { label: 'Gamma', endpoint: 'http://127.0.0.1:8082' },
    { label: 'Delta', endpoint: 'http://127.0.0.1:8083' },
  ])
  assert.deepEqual(errors, [])
  assert.equal(next[0].origin, 'http://127.0.0.1:13091')
  assert.equal(next[1].origin, 'http://127.0.0.1:13092')
  assert.equal(next[2].origin, 'http://127.0.0.1:13093')
})

test('reports when every proxy origin port is already taken', () => {
  const used = []
  for (let port = 13090; port <= 13199; port += 1) {
    used.push({ id: `s${port}`, label: `S${port}`, endpoint: 'http://127.0.0.1:8080', origin: `http://127.0.0.1:${port}` })
  }
  const { errors } = planServerUpdate(used, [{ label: 'Full', endpoint: 'http://127.0.0.1:9090' }])
  assert.ok(errors.some(error => error.field === 'origin'))
})

test('never allocates the shared listener port', () => {
  const { next } = planServerUpdate(current, [{ label: 'Gamma', endpoint: 'http://127.0.0.1:8082' }], { reservedPorts: ['13092'] })
  assert.equal(next[0].origin, 'http://127.0.0.1:13093')
})
