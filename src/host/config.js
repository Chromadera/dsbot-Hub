import { allocateOrigin } from './settings.js'

const DEFAULT_PROXY = {
  listen: '127.0.0.1:13091',
  bind: '127.0.0.1',
  grantTtlSeconds: 60,
  sessionHours: 12,
}

function str(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback
}

function stripSlash(value) {
  return str(value).replace(/\/+$/, '')
}

function isHttpUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** An origin is a scheme, host and port only; a path would break grant cookies. */
function isOriginUrl(value) {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:')
      && (url.pathname === '' || url.pathname === '/')
      && url.search === ''
      && url.hash === ''
  } catch {
    return false
  }
}

function normalizeServer(raw) {
  if (raw === null || typeof raw !== 'object') return null
  const id = str(raw.id)
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(id)) return null

  const endpoint = stripSlash(raw.endpoint)
  let origin = stripSlash(raw.origin)
  if (origin === '' && str(raw.hostname) !== '') origin = `https://${stripSlash(raw.hostname)}`
  if (!isHttpUrl(endpoint)) return null
  if (origin !== '' && !isOriginUrl(origin)) return null

  const cookieRef = str(raw.cookieRef)
  return {
    id,
    label: str(raw.label) || id,
    endpoint,
    origin,
    cookieRef: cookieRef !== '' ? cookieRef : `DSBOT_${id.replace(/[^a-z0-9]/gi, '_').toUpperCase()}_COOKIE`,
    devCookieFile: str(raw.devCookieFile),
    expectedVersion: str(raw.expectedVersion),
  }
}

export function normalizeConfig(raw) {
  const input = raw !== null && typeof raw === 'object' ? raw : {}
  const servers = []
  const seen = new Set()
  const seenOrigins = new Set()
  for (const entry of Array.isArray(input.servers) ? input.servers : []) {
    const server = normalizeServer(entry)
    if (server === null || seen.has(server.id)) continue
    if (server.origin !== '') {
      const originKey = server.origin.toLowerCase()
      if (seenOrigins.has(originKey)) continue
      seenOrigins.add(originKey)
    }
    seen.add(server.id)
    servers.push(server)
  }

  const panel = input.panel !== null && typeof input.panel === 'object' ? input.panel : {}
  const proxy = input.proxy !== null && typeof input.proxy === 'object' ? input.proxy : {}
  const dev = input.dev !== null && typeof input.dev === 'object' ? input.dev : {}

  const proxyConfig = {
    listen: str(proxy.listen) || DEFAULT_PROXY.listen,
    bind: str(proxy.bind) || DEFAULT_PROXY.bind,
    grantTtlSeconds: Number.isFinite(proxy.grantTtlSeconds) && proxy.grantTtlSeconds > 0 ? Math.min(600, proxy.grantTtlSeconds) : DEFAULT_PROXY.grantTtlSeconds,
    sessionHours: Number.isFinite(proxy.sessionHours) && proxy.sessionHours > 0 ? Math.min(24 * 30, proxy.sessionHours) : DEFAULT_PROXY.sessionHours,
  }
  // A hand-written YAML row may omit `origin`; assign one here so the easy
  // path does not require the user to invent a port. The settings editor
  // persists the assigned value on the first save.
  const listenPort = /(\d+)\s*$/.exec(proxyConfig.listen)?.[1]
  const reservedPorts = listenPort === undefined ? [] : [listenPort]
  const assigned = new Map()
  for (const server of servers) {
    if (server.origin === '') {
      server.origin = allocateOrigin(servers, assigned, reservedPorts)
      if (server.origin === '') continue
    }
    assigned.set(server.origin.toLowerCase(), server.id)
  }
  const usable = servers.filter(server => isOriginUrl(server.origin))
  const defaultServer = str(panel.defaultServer)
  return {
    servers: usable,
    panel: {
      defaultServer: usable.some(server => server.id === defaultServer) ? defaultServer : (usable[0]?.id ?? ''),
    },
    proxy: proxyConfig,
    dev: {
      grantFile: str(dev.grantFile),
      grantTtlSeconds: Number.isFinite(dev.grantTtlSeconds) && dev.grantTtlSeconds > 0 ? Math.min(3600, dev.grantTtlSeconds) : 600,
    },
  }
}
