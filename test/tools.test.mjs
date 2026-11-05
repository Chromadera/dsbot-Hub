import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeTools, findBot } from '../src/host/tools.js'

const alpha = { id: 'alpha', label: 'Alpha', endpoint: 'http://127.0.0.1:8080', origin: 'http://127.0.0.1:13090' }
const beta = { id: 'beta', label: 'Beta', endpoint: 'http://127.0.0.1:8081', origin: 'http://127.0.0.1:13091' }

const alphaSession = {
  async state() {
    return { bots: [{ id: 's1', name: 'Chief', role: 'Chief of Staff', sessionId: 's1' }] }
  },
  async chat() {
    return { items: [{ kind: 'bot', text: 'Egress is live.', seq: 3, turn: 2 }] }
  },
  async send() {
    return { turn: 7 }
  },
}

const sessions = new Map([
  ['alpha', alphaSession],
  ['beta', { async state() { return { bots: [{ id: 's2', name: 'Watcher', role: 'OPS' }] } } }],
])

const health = {
  entry(id) {
    return { bots: id === 'alpha' ? [{ id: 's1', name: 'Chief' }] : [{ id: 's2', name: 'Watcher' }] }
  },
}

const tools = makeTools(alpha, [alpha, beta], sessions, health, () => {})
const byName = suffix => tools.find(tool => tool.name.endsWith(suffix))

test('findBot matches id, exact name, and prefix', () => {
  const bots = [{ id: 's1', name: 'Chief' }, { id: 's2', name: 'Football' }]
  assert.equal(findBot(bots, 's1')?.name, 'Chief')
  assert.equal(findBot(bots, 'chief')?.name, 'Chief')
  assert.equal(findBot(bots, 'Foot')?.name, 'Football')
  assert.equal(findBot(bots, 'Nope'), null)
})

test('list_bots names the server and its roster', async () => {
  const value = await byName('_list_bots').execute({}, {})
  assert.equal(value.ok, true)
  assert.equal(value.server, 'Alpha')
  assert.equal(value.text.includes('Chief — Chief of Staff'), true)
})

test('read_chat returns the local chat', async () => {
  const value = await byName('_read_chat').execute({ bot: 'Chief', limit: 5 }, {})
  assert.equal(value.ok, true)
  assert.equal(value.text.includes('[bot] Egress is live.'), true)
})

test('a bot on another server is refused by name', async () => {
  const value = await byName('_read_chat').execute({ bot: 'Watcher' }, {})
  assert.equal(value.ok, false)
  assert.equal(value.error.code, 'wrong_server')
  assert.equal(value.text.includes('Beta'), true)
  assert.equal(value.text.includes('Alpha'), true)
})

test('an unknown bot lists the local roster', async () => {
  const value = await byName('_read_chat').execute({ bot: 'Nobody' }, {})
  assert.equal(value.ok, false)
  assert.equal(value.error.code, 'unknown_bot')
  assert.equal(value.text.includes('Chief'), true)
})

test('ask_bot reports a timeout with the turn id', async () => {
  const value = await byName('_ask_bot').execute({ bot: 'Chief', text: 'status?', timeout_seconds: 1 }, {})
  assert.equal(value.ok, false)
  assert.equal(value.error.code, 'timeout')
  assert.equal(value.turn, 7)
  assert.equal(value.text.includes('still running'), true)
})

test('ask_bot accepts only the turn returned by send', async () => {
  const gamma = { id: 'gamma', label: 'Gamma', endpoint: 'http://127.0.0.1:8082', origin: 'http://127.0.0.1:13092' }
  let calls = 0
  const gammaSession = {
    async state() { return { bots: [{ id: 's3', name: 'Chief', role: 'Chief', sessionId: 's3' }] } },
    async chat() {
      calls += 1
      return {
        items: [
          { kind: 'bot', text: 'previous', seq: 1, turn: 6 },
          ...(calls > 1 ? [{ kind: 'bot', text: 'this turn', seq: 3, turn: 7 }] : []),
        ],
      }
    },
    async send() { return { turn: 7 } },
  }
  const gammaTools = makeTools(gamma, [gamma], new Map([['gamma', gammaSession]]), { entry: () => ({ bots: [] }) }, () => {})
  const ask = gammaTools.find(tool => tool.name.endsWith('_ask_bot'))
  const value = await ask.execute({ bot: 'Chief', text: 'status?', timeout_seconds: 2 }, {})
  assert.equal(value.ok, true)
  assert.equal(value.turn, 7)
  assert.equal(value.text, 'this turn')
})
