import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import http from 'node:http'
import https from 'node:https'
import { brotliDecompressSync, gunzipSync, inflateSync, zstdDecompressSync } from 'node:zlib'

import { injectIframeHtml } from './path.js'

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade',
])

const AUTH_PATH = '/__dsbot-hub/auth'

function base64url(value) {
  return Buffer.from(value).toString('base64url')
}

function fromBase64url(value) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function parseCookies(header) {
  const out = new Map()
  if (typeof header !== 'string' || header === '') return out
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index <= 0) continue
    out.set(part.slice(0, index).trim(), part.slice(index + 1).trim())
  }
  return out
}

function parseListen(value) {
  const text = String(value ?? '').trim()
  const match = /^([^:]+):(\d+)$/.exec(text)
  if (match === null) return { host: '127.0.0.1', port: 13091 }
  return { host: match[1], port: Number(match[2]) }
}

function isLoopbackHost(hostname) {
  const host = hostname.toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1' || /^127\./.test(host)
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
}

/** Hostname from a Host header, including the brackets of an IPv6 literal. */
function requestHostname(req) {
  const raw = String(req?.headers?.host ?? '').trim()
  if (raw === '') return ''
  try {
    return new URL(`http://${raw}`).hostname
  } catch {
    return ''
  }
}

/** Strip the brackets Node's URL keeps on an IPv6 literal before dialing it. */
function dialHostname(hostname) {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname
}

function decodeBody(buffer, encoding) {
  const value = String(encoding ?? '').toLowerCase().trim()
  if (value === '' || value === 'identity') return buffer
  if (value === 'gzip' || value === 'x-gzip') return gunzipSync(buffer)
  if (value === 'br') return brotliDecompressSync(buffer)
  if (value === 'deflate') return inflateSync(buffer)
  if (value === 'zstd') return zstdDecompressSync(buffer)
  throw new Error(`unsupported content-encoding ${JSON.stringify(value)}`)
}

const PAGE_STYLE = 'margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f7f9;color:#1b1f24;font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;padding:24px'
const CARD_STYLE = 'max-width:420px;background:#fff;border:1px solid #d3d8de;border-radius:14px;padding:22px 24px;box-shadow:0 1px 2px rgba(0,0,0,.04)'

function authPage(title, message) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body style="${PAGE_STYLE}"><main style="${CARD_STYLE}"><h1 style="margin:0 0 8px;font-size:17px">${escapeHtml(title)}</h1><p style="margin:0;color:#5b6570">${escapeHtml(message)}</p></main></body></html>`
}

/**
 * The grant and session cookies are HMACs keyed by this secret. A fresh random
 * key per start would invalidate every open panel on every restart — the server
 * iframes then answer "Sign in through DSH" until each server is chosen again.
 * Persist it under DSH_HOME so a restart keeps existing sessions valid.
 * @returns the signing key, read from disk or generated once and saved (0600).
 */
export function loadSessionSecret() {
  const home = typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME !== '' ? process.env.DSH_HOME : join(homedir(), '.dsh')
  const file = join(home, 'dsbot-hub-session.key')
  const readKey = () => {
    try {
      const saved = readFileSync(file, 'utf8').trim()
      // A short or corrupt file would silently weaken the HMAC, so require the
      // decoded key to be exactly the 32 bytes we generate.
      if (!/^[A-Za-z0-9+/=_-]{40,}$/.test(saved)) return null
      const key = Buffer.from(saved, 'base64')
      return key.length === 32 ? key : null
    } catch {
      return null
    }
  }
  const stored = readKey()
  if (stored !== null) return stored
  const fresh = randomBytes(32)
  try {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, fresh.toString('base64'), { mode: 0o600 })
  } catch {
    // A racing start may have written the file first; prefer its key so the two
    // processes agree. Otherwise the write is non-fatal: sessions just do not
    // survive a restart.
    const raced = readKey()
    if (raced !== null) return raced
  }
  return fresh
}

/** One listener per loopback origin, one host-routed listener for hostname origins. */
export class ProxyManager {
  constructor(servers, sessions, config, logger) {
    this.servers = servers
    this.sessions = sessions
    this.config = config
    this.log = logger
    this.secret = loadSessionSecret()
    this.listeners = []
    this.active = new Set()
    this.hostMap = new Map()
    this.started = false
    this.httpAgent = new http.Agent({ keepAlive: true, maxSockets: 32 })
    this.httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 32 })
    this.sockets = new Set()
    this.upstreamSockets = new Set()
  }

  async start() {
    if (this.started) return
    this.started = true
    const shared = []
    for (const server of this.servers) {
      const origin = new URL(server.origin)
      if (isLoopbackHost(origin.hostname)) {
        const port = origin.port === '' ? (origin.protocol === 'https:' ? 443 : 80) : Number(origin.port)
        const active = await this.bindLoopback(port, (req, res) => this.handle(server, req, res), (req, socket, head) => this.handleUpgrade(server, req, socket, head))
        if (active) this.active.add(server.id)
      } else {
        shared.push(server)
        this.hostMap.set(origin.hostname.toLowerCase(), server)
      }
    }
    if (shared.length > 0) {
      const listen = parseListen(this.config.proxy.listen)
      const active = await this.bind(listen.host, listen.port,
        (req, res) => this.handleShared(req, res),
        (req, socket, head) => this.handleSharedUpgrade(req, socket, head),
        'shared hostname listener')
      if (active) for (const server of shared) this.active.add(server.id)
    }
    this.writeDevGrants()
  }

  writeDevGrants() {
    const file = this.config.dev?.grantFile
    if (typeof file !== 'string' || file === '') return
    try {
      const lines = this.servers
        .filter(server => this.active.has(server.id))
        .map(server => `${server.id}\t${this.grantUrl(server, this.config.dev.grantTtlSeconds)}`)
        .join('\n')
      writeFileSync(file, `${lines}\n`, { mode: 0o600 })
      this.log?.(`[dsbot-hub] dev grant file written: ${file}`)
    } catch (error) {
      this.log?.(`[dsbot-hub] cannot write dev grant file: ${error?.message ?? error}`)
    }
  }

  async bind(host, port, onRequest, onUpgrade, label, attempts = 3) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const server = http.createServer(onRequest)
      server.on('upgrade', onUpgrade)
      server.on('connection', socket => {
        this.sockets.add(socket)
        socket.on('close', () => this.sockets.delete(socket))
      })
      server.on('clientError', (_error, socket) => {
        if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
      })
      const outcome = await new Promise(resolve => {
        server.once('error', error => resolve(error))
        server.listen(port, host, () => resolve(null))
      })
      if (outcome === null) {
        this.listeners.push(server)
        this.log?.(`[dsbot-hub] ${label} on ${host}:${port}`)
        return true
      }
      try { server.close() } catch {}
      if (outcome?.code === 'EADDRINUSE' && attempt + 1 < attempts) {
        await new Promise(resolve => setTimeout(resolve, 300))
        continue
      }
      this.log?.(`[dsbot-hub] ${label} ${host}:${port} failed: ${outcome?.message ?? outcome}`)
      return false
    }
    return false
  }

  async bindLoopback(port, onRequest, onUpgrade) {
    // Bind loopback by default. A tailnet/LAN deployment opts in explicitly
    // through proxy.bind; the per-server session gate still protects it.
    const host = this.config.proxy.bind
    const bound = await this.bind(host, port, onRequest, onUpgrade, 'proxy listener')
    if (host === '127.0.0.1' || host === '0.0.0.0') {
      // A browser may resolve `localhost` to ::1 first.
      await this.bind('::1', port, onRequest, onUpgrade, 'proxy listener (ipv6)')
    }
    return bound
  }

  async close() {
    for (const socket of this.sockets) {
      try { socket.destroy() } catch {}
    }
    this.sockets.clear()
    for (const socket of this.upstreamSockets) {
      try { socket.destroy() } catch {}
    }
    this.upstreamSockets.clear()
    const servers = this.listeners.splice(0)
    await Promise.all(servers.map(server => new Promise(resolve => {
      try {
        server.closeAllConnections?.()
        server.close(() => resolve())
        setTimeout(resolve, 1500)
      } catch {
        resolve()
      }
    })))
    this.httpAgent.destroy()
    this.httpsAgent.destroy()
    this.active.clear()
  }

  handleShared(req, res) {
    const host = requestHostname(req).toLowerCase()
    const server = this.hostMap.get(host)
    if (server === undefined) {
      res.writeHead(421, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('Unknown DS Bot Hub origin')
      return
    }
    this.handle(server, req, res)
  }

  handleSharedUpgrade(req, socket, head) {
    const host = requestHostname(req).toLowerCase()
    const server = this.hostMap.get(host)
    if (server === undefined) {
      socket.end('HTTP/1.1 421 Misdirected Request\r\n\r\n')
      return
    }
    this.handleUpgrade(server, req, socket, head)
  }

  isActive(serverId) {
    return this.active.has(serverId)
  }

  cookieName(server) {
    return `dbh_${server.id.replace(/[^a-z0-9_-]/gi, '_')}`
  }

  grant(server, ttlSeconds) {
    const exp = Date.now() + ttlSeconds * 1000
    const payload = base64url(JSON.stringify({
      s: server.id, e: exp, t: 'grant', n: randomBytes(8).toString('hex'),
    }))
    const sig = createHmac('sha256', this.secret).update(payload).digest('base64url')
    return `${payload}.${sig}`
  }

  verifyGrant(server, value) {
    return this.verifyToken(server, value, 'grant')
  }

  /** The origin the browser should use for this server on this request. */
  publicOrigin(server, req) {
    const origin = new URL(server.origin)
    if (!isLoopbackHost(origin.hostname)) return origin.origin
    const hostname = requestHostname(req)
    if (hostname === '') return origin.origin
    const scheme = this.isSecure(req) ? 'https:' : 'http:'
    const port = origin.port === '' ? '' : `:${origin.port}`
    return `${scheme}//${hostname}${port}`
  }

  grantUrl(server, ttlSeconds) {
    return `${server.origin}${AUTH_PATH}?grant=${encodeURIComponent(this.grant(server, ttlSeconds))}`
  }

  grantUrlFor(server, ttlSeconds, req) {
    return `${this.publicOrigin(server, req)}${AUTH_PATH}?grant=${encodeURIComponent(this.grant(server, ttlSeconds))}`
  }

  sessionValue(server) {
    const exp = Date.now() + this.config.proxy.sessionHours * 3600 * 1000
    const payload = base64url(JSON.stringify({ s: server.id, e: exp, t: 'session' }))
    const sig = createHmac('sha256', this.secret).update(payload).digest('base64url')
    return `${payload}.${sig}`
  }

  verifySession(server, value) {
    return this.verifyToken(server, value, 'session')
  }

  /** Check the HMAC and the token kind, so a grant never validates as a session. */
  verifyToken(server, value, kind) {
    const [payload, sig] = String(value ?? '').split('.')
    if (payload === undefined || sig === undefined) return false
    const expected = createHmac('sha256', this.secret).update(payload).digest('base64url')
    if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return false
    try {
      const data = JSON.parse(fromBase64url(payload))
      return data.s === server.id && data.t === kind && typeof data.e === 'number' && data.e > Date.now()
    } catch {
      return false
    }
  }

  hasSession(server, req) {
    const cookies = parseCookies(req.headers.cookie)
    return this.verifySession(server, cookies.get(this.cookieName(server)))
  }

  isSecure(req) {
    if (req.socket?.encrypted === true) return true
    const proto = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim().toLowerCase()
    return proto === 'https'
  }

  handle(server, req, res) {
    const url = req.url ?? '/'
    if (url === AUTH_PATH || url.startsWith(`${AUTH_PATH}?`)) {
      this.handleAuth(server, req, res)
      return
    }
    if (!this.hasSession(server, req)) {
      res.writeHead(401, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
      })
      res.end(authPage('Sign in through DSH', `Open DS Bot Hub in your DSH, then choose ${server.label}.`))
      return
    }
    this.forward(server, req, res)
  }

  handleAuth(server, req, res) {
    const url = new URL(req.url ?? '/', 'http://proxy.local')
    if (!this.verifyGrant(server, url.searchParams.get('grant'))) {
      res.writeHead(403, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
      })
      res.end(authPage('Link expired', 'Open DS Bot Hub and choose the server again.'))
      return
    }
    const maxAge = Math.floor(this.config.proxy.sessionHours * 3600)
    const attributes = [`${this.cookieName(server)}=${this.sessionValue(server)}`, 'Path=/', `Max-Age=${maxAge}`, 'HttpOnly', 'SameSite=Lax']
    if (this.isSecure(req)) attributes.push('Secure')
    res.writeHead(302, {
      location: '/',
      'set-cookie': attributes.join('; '),
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    })
    res.end()
  }

  rewriteLocation(server, location, req) {
    const text = String(location)
    const endpoint = server.endpoint
    if (text === endpoint || text.startsWith(`${endpoint}/`)) {
      return `${this.publicOrigin(server, req)}${text.slice(endpoint.length)}`
    }
    return text
  }

  async forward(server, req, res) {
    const target = new URL(server.endpoint)
    const basePath = target.pathname === '/' ? '' : target.pathname.replace(/\/+$/, '')
    const transport = target.protocol === 'https:' ? https : http
    const agent = target.protocol === 'https:' ? this.httpsAgent : this.httpAgent
    const session = this.sessions.get(server.id)
    let cookie = null
    try {
      cookie = await session?.loadCookie?.() ?? null
    } catch {
      cookie = null
    }

    const headers = { ...req.headers }
    for (const name of HOP_BY_HOP) delete headers[name]
    // The browser's cookies belong to the hub and must never reach a team
    // server; only the team cookie the hub holds is injected below.
    delete headers.cookie
    delete headers.origin
    delete headers.referer
    headers.host = target.host
    if (cookie !== null) headers.cookie = cookie
    if (typeof req.headers.origin === 'string') headers.origin = `${target.protocol}//${target.host}`
    if (typeof req.headers.referer === 'string') headers.referer = `${target.protocol}//${target.host}/`

    const upstream = transport.request({
      protocol: target.protocol,
      hostname: dialHostname(target.hostname),
      port: target.port === '' ? (target.protocol === 'https:' ? 443 : 80) : Number(target.port),
      method: req.method,
      path: `${basePath}${req.url.startsWith('/') ? req.url : `/${req.url}`}`,
      headers,
      agent,
    }, response => {
      const outHeaders = { ...response.headers }
      for (const name of HOP_BY_HOP) delete outHeaders[name]
      // A team server must never set a cookie on the hub or the DSH origin.
      delete outHeaders['set-cookie']
      outHeaders['x-content-type-options'] = 'nosniff'
      outHeaders['referrer-policy'] = 'no-referrer'
      if (typeof outHeaders.location === 'string') outHeaders.location = this.rewriteLocation(server, outHeaders.location, req)

      const html = String(outHeaders['content-type'] ?? '').includes('text/html')
      if (html) {
        const chunks = []
        response.on('data', chunk => chunks.push(chunk))
        response.on('end', () => {
          let body
          try {
            const decoded = decodeBody(Buffer.concat(chunks), outHeaders['content-encoding'])
            body = injectIframeHtml(decoded.toString('utf8'))
          } catch (error) {
            this.log?.(`[dsbot-hub] cannot rewrite ${server.label}: ${error?.message ?? error}`)
            if (!res.headersSent) {
              res.writeHead(502, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
              res.end(authPage('Server page unavailable', `${server.label} returned a page the hub could not read.`))
            } else {
              res.destroy()
            }
            return
          }
          delete outHeaders['content-encoding']
          outHeaders['content-length'] = String(Buffer.byteLength(body))
          outHeaders['cache-control'] = 'no-store'
          res.writeHead(response.statusCode ?? 502, outHeaders)
          res.end(body)
        })
        response.on('error', () => {
          if (!res.headersSent) { res.writeHead(502); res.end() } else res.destroy()
        })
        return
      }
      res.writeHead(response.statusCode ?? 502, outHeaders)
      response.pipe(res)
    })

    upstream.setTimeout(20_000, () => {
      upstream.destroy(Object.assign(new Error('upstream timeout'), { code: 'ETIMEDOUT' }))
    })
    upstream.on('error', error => {
      if (res.headersSent) {
        res.destroy()
        return
      }
      res.writeHead(502, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      res.end(authPage('Server unreachable', `${server.label}: ${error?.message ?? error}`))
    })
    res.on('close', () => {
      if (!res.writableEnded) upstream.destroy()
    })
    req.on('aborted', () => upstream.destroy())
    req.pipe(upstream)
  }

  handleUpgrade(server, req, socket, head) {
    const upstreamPath = req.url
    if (!this.hasSession(server, req)) {
      socket.end('HTTP/1.1 401 Unauthorized\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\n\r\n')
      return
    }
    const target = new URL(server.endpoint)
    const basePath = target.pathname === '/' ? '' : target.pathname.replace(/\/+$/, '')
    const transport = target.protocol === 'https:' ? https : http
    const session = this.sessions.get(server.id)
    const send = cookie => {
      const headers = { ...req.headers }
      for (const name of HOP_BY_HOP) delete headers[name]
      delete headers.cookie
      delete headers.origin
      delete headers.referer
      headers.host = target.host
      headers.connection = 'Upgrade'
      headers.upgrade = req.headers.upgrade ?? 'websocket'
      if (cookie !== null) headers.cookie = cookie
      if (typeof req.headers.origin === 'string') headers.origin = `${target.protocol}//${target.host}`
      const upstream = transport.request({
        protocol: target.protocol,
        hostname: dialHostname(target.hostname),
        port: target.port === '' ? (target.protocol === 'https:' ? 443 : 80) : Number(target.port),
        method: 'GET',
        path: `${basePath}${upstreamPath.startsWith('/') ? upstreamPath : `/${upstreamPath}`}`,
        headers,
        agent: false,
      })
      upstream.on('upgrade', (response, upstreamSocket, upstreamHead) => {
        this.upstreamSockets.add(upstreamSocket)
        upstreamSocket.on('close', () => this.upstreamSockets.delete(upstreamSocket))
        const lines = [`HTTP/1.1 ${response.statusCode ?? 101} ${response.statusMessage ?? 'Switching Protocols'}`]
        for (const [key, value] of Object.entries(response.headers)) {
          if (Array.isArray(value)) for (const item of value) lines.push(`${key}: ${item}`)
          else if (value !== undefined) lines.push(`${key}: ${value}`)
        }
        socket.write(`${lines.join('\r\n')}\r\n\r\n`)
        if (upstreamHead.length > 0) socket.write(upstreamHead)
        if (head.length > 0) upstreamSocket.write(head)
        upstreamSocket.pipe(socket)
        socket.pipe(upstreamSocket)
        upstreamSocket.on('error', () => socket.destroy())
        socket.on('error', () => upstreamSocket.destroy())
        socket.on('close', () => upstreamSocket.destroy())
      })
      upstream.on('response', response => {
        this.log?.(`[dsbot-hub] upgrade answered ${response.statusCode ?? 502} for ${upstreamPath}`)
        const lines = [`HTTP/1.1 ${response.statusCode ?? 502} ${response.statusMessage ?? ''}`]
        for (const [key, value] of Object.entries(response.headers)) {
          if (Array.isArray(value)) for (const item of value) lines.push(`${key}: ${item}`)
          else if (value !== undefined) lines.push(`${key}: ${value}`)
        }
        socket.write(`${lines.join('\r\n')}\r\n\r\n`)
        response.pipe(socket)
      })
      upstream.on('error', (error) => { this.log?.(`[dsbot-hub] upgrade upstream error: ${error?.message ?? error}`); socket.destroy() })
      upstream.end()
    }
    Promise.resolve(session?.loadCookie?.() ?? null).then(send).catch((error) => {
      this.log?.(`[dsbot-hub] upgrade failed: ${error?.message ?? error}`)
      socket.destroy()
    })
  }
}
