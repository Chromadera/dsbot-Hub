const ID_RE = /^[a-z0-9][a-z0-9_-]*$/i
const COOKIE_RE = /^[A-Za-z_][A-Za-z0-9_]*$/
const MAX_ID = 48
const ORIGIN_PORT_BASE = 13090
const ORIGIN_PORT_MAX = 13199

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function stripSlash(value) {
  return text(value).replace(/\/+$/, '')
}

function isHttpUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

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

function loopbackPort(value) {
  try {
    const url = new URL(value)
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]' || url.hostname === '::1'
      ? url.port
      : ''
  } catch {
    return ''
  }
}

/** Pick the first free loopback port; the UI never asks the user for one. */
function allocateOrigin(current, origins, reserved = new Set()) {
  const used = new Set(reserved)
  for (const server of current) {
    const port = loopbackPort(server.origin)
    if (port !== '') used.add(port)
  }
  for (const origin of origins.keys()) {
    const port = loopbackPort(origin)
    if (port !== '') used.add(port)
  }
  for (let port = ORIGIN_PORT_BASE; port <= ORIGIN_PORT_MAX; port += 1) {
    if (!used.has(String(port))) return `http://127.0.0.1:${port}`
  }
  return ''
}

function slugify(label) {
  return text(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_ID)
}

function defaultCookieRef(id) {
  return `DSBOT_${id.replace(/[^a-z0-9]/gi, '_').toUpperCase()}_COOKIE`
}

/**
 * Turn the settings form's server list into the next config list.
 * Preserves hidden per-server fields (dev cookie file, expected version) by id,
 * enforces ids/origins/cookie refs, and reports removals so the caller can
 * unset their stored cookies.
 */
export function planServerUpdate(currentServers, requestedServers, { reservedPorts = [] } = {}) {
  const reserved = new Set(reservedPorts.map(port => String(port)))
  const current = Array.isArray(currentServers)
    ? currentServers.filter(server => server !== null && typeof server === 'object' && text(server.id) !== '')
    : []
  const byId = new Map(current.map(server => [server.id, server]))
  const requested = Array.isArray(requestedServers) ? requestedServers : []
  const errors = []
  const next = []
  const taken = new Set()
  const origins = new Map()

  requested.forEach((raw, index) => {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push({ index, field: 'server', message: 'Not a server.' })
      return
    }
    const label = text(raw.label)
    let id = text(raw.id)
    if (id === '') id = slugify(label) || `server-${index + 1}`
    if (!ID_RE.test(id)) {
      errors.push({ index, field: 'id', message: 'Use letters, numbers, hyphens and underscores.' })
      return
    }
    if (taken.has(id)) {
      errors.push({ index, field: 'id', message: `The id "${id}" is already used.` })
      return
    }
    taken.add(id)

    const endpoint = stripSlash(raw.endpoint)
    const old = byId.get(id) ?? {}
    let origin = stripSlash(raw.origin) || stripSlash(old.origin)
    if (origin === '') {
      origin = allocateOrigin(current, origins, reserved)
      if (origin === '') {
        errors.push({ index, field: 'origin', message: 'No free proxy port is available.' })
        return
      }
    }
    const endpointOk = isHttpUrl(endpoint)
    const originOk = isOriginUrl(origin)
    if (!endpointOk) errors.push({ index, field: 'endpoint', message: 'An http(s) endpoint is required.' })
    if (!originOk) errors.push({ index, field: 'origin', message: 'An http(s) origin is required.' })
    if (originOk) {
      const key = origin.toLowerCase()
      if (origins.has(key)) errors.push({ index, field: 'origin', message: 'Every server needs its own browser origin.' })
      else origins.set(key, id)
    }

    const cookieRef = text(raw.cookieRef) || text(old.cookieRef) || defaultCookieRef(id)
    if (!COOKIE_RE.test(cookieRef)) {
      errors.push({ index, field: 'cookieRef', message: 'Use an environment-style name, e.g. DSBOT_ALPHA_COOKIE.' })
    }
    if (!endpointOk || !originOk || !COOKIE_RE.test(cookieRef)) return

    const server = {
      ...old,
      id,
      label: label || id,
      endpoint,
      origin,
      cookieRef,
      devCookieFile: text(old.devCookieFile),
    }
    if ('hostname' in server) delete server.hostname
    if (text(old.expectedVersion) !== '') server.expectedVersion = text(old.expectedVersion)
    next.push(server)
  })

  const nextIds = new Set(next.map(server => server.id))
  const removed = current.filter(server => !nextIds.has(server.id))
  return { next, removed, errors }
}

export { slugify, defaultCookieRef, allocateOrigin }
