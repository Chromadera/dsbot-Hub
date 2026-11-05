import { readFileSync } from 'node:fs'

const TIMEOUT_MS = 12_000

export class ServerError extends Error {
  constructor(kind, message, status = 0) {
    super(message)
    this.name = 'ServerError'
    this.kind = kind
    this.status = status
  }
}

/** Read a Netscape cookie jar or a raw `name=value` cookie string. */
export function readCookieFile(path) {
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return null
  }
  const rows = []
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue
    if (line.startsWith('#HttpOnly_')) {
      const fields = line.slice('#HttpOnly_'.length).split('\t')
      if (fields.length >= 7) rows.push({ domain: fields[0], name: fields[5], value: fields[6] })
      continue
    }
    if (line.startsWith('#')) continue
    if (line.includes('\t')) {
      const fields = line.split('\t')
      if (fields.length >= 7) rows.push({ domain: fields[0], name: fields[5], value: fields[6] })
    }
  }
  if (rows.length > 0) return rows.map(row => `${row.name}=${row.value}`).join('; ')
  const raw = text.trim()
  return raw.includes('=') ? raw : null
}

function cookieFromResponse(response) {
  const values = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : (response.headers.get('set-cookie') ?? '').split(/,(?=[^;,]+=)/)
  const cookies = values.map(value => String(value).split(';')[0]?.trim() ?? '').filter(Boolean)
  return cookies.length > 0 ? cookies.join('; ') : null
}

function tokenFromInput(input) {
  const text = String(input ?? '').trim()
  if (text === '') return ''
  try {
    const url = new URL(text)
    return url.searchParams.get('token') ?? ''
  } catch {
    const match = /(?:^|[?&])token=([^&\s]+)/.exec(text)
    return match !== null ? decodeURIComponent(match[1]) : text
  }
}

/** One DS Bot server connection: cookie lifecycle plus the stock /api/bot calls. */
export class ServerSession {
  constructor(server, ctx, logger) {
    this.server = server
    this.ctx = ctx
    this.log = logger
    this.cookie = null
    this.endpointUrl = new URL(server.endpoint)
    this.authority = this.endpointUrl.host
    this.originHeader = `${this.endpointUrl.protocol}//${this.authority}`
  }

  async loadCookie() {
    if (this.cookie !== null) return this.cookie

    const credentials = this.ctx?.get?.('credentials')
    if (credentials !== undefined && typeof credentials.resolve === 'function') {
      try {
        const resolved = await credentials.resolve(this.server.cookieRef)
        if (resolved !== undefined && typeof resolved.value === 'string' && resolved.value.trim() !== '') {
          this.cookie = resolved.value.trim()
          return this.cookie
        }
      } catch (error) {
        this.log?.(`credentials.resolve(${this.server.cookieRef}) failed: ${error?.message ?? error}`)
      }
    }

    const fromEnv = process.env[this.server.cookieRef]
    if (typeof fromEnv === 'string' && fromEnv.trim() !== '') {
      this.cookie = fromEnv.trim()
      return this.cookie
    }

    if (this.server.devCookieFile !== '') {
      const fromFile = readCookieFile(this.server.devCookieFile)
      if (fromFile !== null && fromFile !== '') {
        this.cookie = fromFile
        return this.cookie
      }
    }

    return null
  }

  async storeCookie(cookie) {
    this.cookie = cookie
    const credentials = this.ctx?.get?.('credentials')
    if (credentials !== undefined && typeof credentials.set === 'function') {
      try {
        await credentials.set(this.server.cookieRef, cookie)
        return
      } catch (error) {
        this.log?.(`credentials.set(${this.server.cookieRef}) failed: ${error?.message ?? error}`)
      }
    }
  }

  async login(input) {
    const token = tokenFromInput(input)
    if (token === '') throw new ServerError('unauthorized', 'Paste the login token or the login URL printed by ds-bot.')
    const url = new URL(this.server.endpoint)
    url.searchParams.set('token', token)
    let response
    try {
      response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) })
    } catch (error) {
      throw new ServerError('unreachable', `Cannot reach ${this.server.label}: ${error?.message ?? error}`)
    }
    if (response.status === 401 || response.status === 403) {
      throw new ServerError('unauthorized', `The login token was rejected by ${this.server.label}.`, response.status)
    }
    if (response.status >= 400) {
      throw new ServerError('unauthorized', `${this.server.label} returned ${response.status} for the login token.`, response.status)
    }
    const cookie = cookieFromResponse(response)
    if (cookie === null) throw new ServerError('unauthorized', `${this.server.label} accepted the token but set no cookie.`, response.status)
    await this.storeCookie(cookie)
    return cookie
  }

  async call(endpoint, payload = {}) {
    const cookie = await this.loadCookie()
    if (cookie === null) throw new ServerError('unauthorized', `No cookie for ${this.server.label}. Paste its login token.`)
    let response
    try {
      response = await fetch(`${this.server.endpoint}/api/bot`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ endpoint, payload }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch (error) {
      throw new ServerError('unreachable', `Cannot reach ${this.server.label}: ${error?.message ?? error}`)
    }
    if (response.status === 401) throw new ServerError('unauthorized', `${this.server.label} rejected the cookie (401).`, 401)
    if (response.status === 403) {
      throw new ServerError('misconfigured', `${this.server.label} rejected the request authority (403). Check endpoint/origin.`, 403)
    }
    if (!response.ok) throw new ServerError('error', `${this.server.label} returned HTTP ${response.status}.`, response.status)

    let body
    try {
      body = await response.json()
    } catch {
      throw new ServerError('incompatible', `${this.server.label} returned a non-JSON body for ${endpoint}.`, response.status)
    }
    if (body === null || typeof body !== 'object' || body.ok !== true) {
      const error = body?.error ?? {}
      const code = typeof error.code === 'string' ? error.code : 'error'
      const message = typeof error.message === 'string' ? error.message : `Unknown ${endpoint} error`
      if (code === 'bot/not-found' && endpoint !== 'state') {
        throw new ServerError('incompatible', `${this.server.label} does not expose ${endpoint}: ${message}`)
      }
      throw new ServerError('error', `${this.server.label}: ${code} — ${message}`)
    }
    return body.value
  }

  async state() {
    const value = await this.call('state', {})
    if (value === null || typeof value !== 'object' || !Array.isArray(value.bots)) {
      throw new ServerError('incompatible', `${this.server.label} returned an unexpected state shape.`)
    }
    return value
  }

  chat(botId, cursor) {
    return this.call('chat', cursor === undefined || cursor === null || cursor === '' ? { botId } : { botId, cursor })
  }

  send(sessionId, text) {
    return this.call('send', { sessionId, text })
  }
}
