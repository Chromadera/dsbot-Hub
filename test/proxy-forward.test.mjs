import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import net from 'node:net'
import { normalizeConfig } from '../src/host/config.js'
import { ProxyManager } from '../src/host/proxy.js'

async function freePort() {
  const server = net.createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  return port
}

function rawUpgrade(port, path, headers) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1')
    let buffer = ''
    const timer = setTimeout(() => { socket.destroy(); reject(new Error('upgrade timeout')) }, 5000)
    socket.on('error', error => { clearTimeout(timer); reject(error) })
    socket.on('connect', () => {
      const lines = [`GET ${path} HTTP/1.1`, `Host: 127.0.0.1:${port}`, 'Connection: Upgrade', 'Upgrade: websocket']
      for (const [key, value] of Object.entries(headers)) lines.push(`${key}: ${value}`)
      socket.write(`${lines.join('\r\n')}\r\n\r\n`)
    })
    socket.on('data', chunk => {
      buffer += chunk.toString('latin1')
      if (buffer.includes('\r\n\r\n')) {
        clearTimeout(timer)
        const status = Number(buffer.split('\r\n')[0].split(' ')[1])
        socket.destroy()
        resolve(status)
      }
    })
  })
}

test('origin proxy gates sessions, strips cookies, and injects the iframe stylesheet', async () => {
  const upstreamPort = await freePort()
  const originPort = await freePort()
  const seen = []
  let upgraded
  const upstream = http.createServer((req, res) => {
    seen.push(req.headers)
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'set-cookie': 'leaked=1; Path=/',
    })
    res.end('<!doctype html><html><head></head><body><script src="/assets/app.js"></script></body></html>')
  })
  upstream.on('upgrade', (req, socket) => {
    upgraded = socket
    seen.push(req.headers)
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n')
  })
  await new Promise(resolve => upstream.listen(upstreamPort, '127.0.0.1', resolve))

  const config = normalizeConfig({
    servers: [{
      id: 'alpha',
      label: 'Alpha',
      endpoint: `http://127.0.0.1:${upstreamPort}`,
      origin: `http://127.0.0.1:${originPort}`,
    }],
    proxy: { listen: `127.0.0.1:${await freePort()}`, bind: '127.0.0.1' },
  })
  const sessions = new Map([['alpha', { async loadCookie() { return 'team=abc' } }]])
  const proxy = new ProxyManager(config.servers, sessions, config, () => {})
  await proxy.start()
  try {
    const origin = `http://127.0.0.1:${originPort}`
    const denied = await fetch(`${origin}/`)
    assert.equal(denied.status, 401)

    const grantUrl = proxy.grantUrlFor(config.servers[0], 60, { headers: { host: '127.0.0.1:3081' } })
    const grant = await fetch(grantUrl, { redirect: 'manual' })
    const session = (grant.headers.getSetCookie()[0] ?? '').split(';')[0]
    assert.notEqual(session, '')

    const allowed = await fetch(`${origin}/`, {
      headers: { cookie: `dsh-auth=SECRET; ${session}` },
    })
    assert.equal(allowed.status, 200)
    assert.equal(allowed.headers.get('set-cookie'), null)
    assert.equal(allowed.headers.get('x-content-type-options'), 'nosniff')
    const html = await allowed.text()
    assert.ok(html.includes('data-dsbot-iframe'))
    assert.ok(html.includes('src="/assets/app.js"'))
    assert.ok(!html.includes('dsh-auth=SECRET'))
    assert.equal(seen.at(-1).cookie, 'team=abc')

    assert.equal(await rawUpgrade(originPort, '/api/remote.mux', { cookie: session }), 101)
    assert.equal(seen.at(-1).cookie, 'team=abc')
    assert.equal(await rawUpgrade(originPort, '/api/remote.mux', {}), 401)
  } finally {
    await proxy.close()
    upgraded?.destroy()
    upstream.closeAllConnections?.()
    await new Promise(resolve => upstream.close(resolve))
  }
})
