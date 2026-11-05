import { planServerUpdate } from './settings.js'
import { ServerSession } from './session.js'

const API_PREFIX = '/dsbot-hub/api'
const MAX_BODY = 64 * 1024

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function text(value) { return typeof value === 'string' ? value.trim() : '' }

function json(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  })
  res.end(body)
}

async function readBody(req) {
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) throw new HttpError(413, 'body too large')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  const text = Buffer.concat(chunks).toString('utf8')
  if (text.trim() === '') return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new HttpError(400, 'body must be valid JSON')
  }
}

/** Same-origin panel API: server summary, grant link, and one-time token login. */
export class PanelApi {
  constructor(ctx, servers, sessions, health, proxy, config, logger) {
    this.ctx = ctx
    this.servers = servers
    this.sessions = sessions
    this.health = health
    this.proxy = proxy
    this.config = config
    this.log = logger
  }

  admitted(req) {
    const connection = this.ctx.get?.('connection')
    if (connection === undefined || typeof connection.requestRejection !== 'function') return false
    try {
      return connection.requestRejection(req) === undefined
    } catch {
      return false
    }
  }

  findEntry(configEditor) {
    const entries = typeof configEditor.entries === 'function' ? configEditor.entries() : []
    const rows = Array.isArray(entries) ? entries : []
    return rows.find(row => row?.options?.id === 'dsbot-hub')
      ?? rows.find(row => row?.options?.name === 'dsbot-hub' && !String(row?.options?.id ?? '').startsWith('include:'))
      ?? rows.find(row => String(row?.options?.id ?? '').endsWith(':dsbot-hub'))
      ?? null
  }

  currentServers(entry, configEditor) {
    const rows = typeof configEditor.configuration === 'function' ? configEditor.configuration() : []
    const row = Array.isArray(rows) ? rows.find(item => item.entry === entry) : undefined
    const override = row?.override?.servers
    const inherited = row?.inherited?.servers
    const base = entry?.options?.config?.servers
    return Array.isArray(override) ? override : Array.isArray(inherited) ? inherited : Array.isArray(base) ? base : []
  }

  async updateServers(req, res) {
    const configEditor = this.ctx.get?.('configEditor')
    if (configEditor === undefined || typeof configEditor.edit !== 'function') {
      json(res, 503, { ok: false, error: 'configEditor is unavailable in this profile' })
      return
    }
    const entry = this.findEntry(configEditor)
    if (entry === null) {
      const entries = typeof configEditor.entries === 'function' ? configEditor.entries() : []
      json(res, 503, {
        ok: false,
        error: 'The dsbot-hub config entry was not found',
        entries: (Array.isArray(entries) ? entries : []).map(row => row?.options?.id).filter(Boolean),
      })
      return
    }
    const body = await readBody(req)
    if (!Array.isArray(body?.servers)) {
      json(res, 400, { ok: false, error: 'servers must be an array', fields: [{ field: 'servers', message: 'Expected an array.' }] })
      return
    }
    const current = this.currentServers(entry, configEditor)
    const listenPort = /(\d+)\s*$/.exec(String(this.config.proxy?.listen ?? ''))?.[1]
    const plan = planServerUpdate(current, body.servers, { reservedPorts: listenPort === undefined ? [] : [listenPort] })
    if (plan.errors.length > 0) {
      json(res, 400, { ok: false, error: 'Fix the highlighted fields.', fields: plan.errors })
      return
    }
    const tokens = body.tokens !== null && typeof body.tokens === 'object' ? body.tokens : {}
    const loginErrors = []
    for (const server of plan.next) {
      const token = typeof tokens[server.id] === 'string' ? tokens[server.id].trim() : ''
      if (token === '') continue
      // Reuse the live session so a re-login updates the cached cookie the
      // proxy and tools are already using. New servers get a temporary session;
      // the config reconciliation builds the permanent one.
      const session = this.sessions.get(server.id) ?? new ServerSession(server, this.ctx, this.log)
      try {
        await session.login(token)
      } catch (error) {
        loginErrors.push({ id: server.id, message: String(error?.message ?? error) })
      }
    }
    try {
      await configEditor.edit(entry, raw => {
        const rawServers = Array.isArray(raw?.servers) ? raw.servers : current
        const byId = new Map(rawServers.filter(server => server !== null && typeof server === 'object' && server.id).map(server => [server.id, server]))
        const next = plan.next.map(server => {
          const old = byId.get(server.id) ?? {}
          const hidden = {
            ...server,
            devCookieFile: text(old.devCookieFile) || server.devCookieFile || '',
          }
          if (text(old.expectedVersion) !== '') hidden.expectedVersion = text(old.expectedVersion)
          else if (text(server.expectedVersion) === '') delete hidden.expectedVersion
          return hidden
        })
        return { ...(raw ?? {}), servers: next }
      })
    } catch (error) {
      this.log?.(`[dsbot-hub] settings save failed: ${error?.message ?? error}`)
      json(res, 409, { ok: false, error: String(error?.message ?? error) })
      return
    }
    const credentials = this.ctx.get?.('credentials')
    for (const server of plan.removed) {
      if (text(server.cookieRef) === '' || typeof credentials?.unset !== 'function') continue
      try { await credentials.unset(server.cookieRef) } catch {}
    }
    json(res, 200, { ok: true, loginErrors })
  }

  async handle(req, res) {
    if (!this.admitted(req)) {
      json(res, 401, { ok: false, error: 'DSH authentication required' })
      return
    }
    try {
      const url = new URL(req.url ?? '/', 'http://hub.local')
      const path = url.pathname
      if (path === `${API_PREFIX}/settings/servers` && req.method === 'PUT') {
        await this.updateServers(req, res)
        return
      }
      if (path === `${API_PREFIX}/servers` && req.method === 'GET') {
        json(res, 200, { ok: true, servers: this.health.summary(), defaultServer: this.config.panel.defaultServer })
        return
      }
      const match = /^\/dsbot-hub\/api\/servers\/([a-z0-9_-]+)(?:\/(grant|open|login|state))?$/i.exec(path)
      if (match === null) {
        json(res, 404, { ok: false, error: 'not found' })
        return
      }
      const server = this.servers.find(entry => entry.id === match[1])
      if (server === undefined) {
        json(res, 404, { ok: false, error: 'unknown server' })
        return
      }
      const action = match[2] ?? ''
      if (action === 'grant' && req.method === 'GET') {
        if (typeof this.proxy.isActive === 'function' && !this.proxy.isActive(server.id)) {
          json(res, 503, { ok: false, error: 'proxy listener is starting; retry in a moment' })
          return
        }
        json(res, 200, { ok: true, url: this.proxy.grantUrlFor(server, this.config.proxy.grantTtlSeconds, req) })
        return
      }
      if (action === 'open' && req.method === 'GET') {
        if (typeof this.proxy.isActive === 'function' && !this.proxy.isActive(server.id)) {
          json(res, 503, { ok: false, error: 'proxy listener is starting; retry in a moment' })
          return
        }
        res.writeHead(302, {
          location: this.proxy.grantUrlFor(server, this.config.proxy.grantTtlSeconds, req),
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
          'referrer-policy': 'no-referrer',
        })
        res.end()
        return
      }
      if (action === 'state' && req.method === 'GET') {
        const entry = this.health.entry(server.id)
        json(res, 200, {
          ok: true,
          server: { id: server.id, label: server.label, origin: server.origin },
          status: entry?.status ?? 'error',
          reason: entry?.reason ?? '',
          bots: entry?.bots ?? [],
          live: entry?.live ?? { working: 0, waiting: 0, current: null, elapsedMs: null },
          revision: entry?.revision ?? 0,
          readOnly: entry?.readOnly ?? null,
        })
        return
      }
      if (action === 'login' && req.method === 'POST') {
        const body = await readBody(req)
        const session = this.sessions.get(server.id)
        if (session === undefined) {
          json(res, 500, { ok: false, error: 'server session unavailable' })
          return
        }
        try {
          await session.login(body?.token ?? '')
          await this.health.refresh(server.id)
          json(res, 200, { ok: true, server: this.health.summary().find(entry => entry.id === server.id) })
        } catch (error) {
          json(res, 401, { ok: false, error: String(error?.message ?? error), kind: error?.kind ?? 'unauthorized' })
        }
        return
      }
      json(res, 405, { ok: false, error: 'method not allowed' })
    } catch (error) {
      if (error instanceof HttpError) {
        json(res, error.status, { ok: false, error: error.message })
        return
      }
      this.log?.(`[dsbot-hub] api error: ${error?.message ?? error}`)
      json(res, 500, { ok: false, error: 'internal error' })
    }
  }
}

export { API_PREFIX }
