const POLL_MS = 5_000

function objectOf(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function elapsedOf(value) {
  const source = objectOf(value)
  const since = source.since ?? source.startedAt ?? source.started ?? source.at
  if (typeof since !== 'number' || !Number.isFinite(since)) return null
  return Math.max(0, Date.now() - since)
}

/** Per-server health, roster counts and live working/waiting state. */
export class Health {
  constructor(servers, sessions, logger) {
    this.servers = servers
    this.sessions = sessions
    this.log = logger
    this.entries = new Map()
    this.timer = null
    this.busy = false
    for (const server of servers) {
      this.entries.set(server.id, {
        status: server.id === servers[0]?.id ? 'checking' : 'checking',
        reason: '',
        bots: [],
        live: { working: 0, waiting: 0, current: null, elapsedMs: null },
        revision: 0,
        readOnly: null,
        checkedAt: 0,
      })
    }
  }

  start() {
    if (this.timer !== null) return
    void this.refreshAll()
    this.timer = setInterval(() => void this.refreshAll(), POLL_MS)
    this.timer.unref?.()
  }

  stop() {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  entry(id) {
    return this.entries.get(id)
  }

  async refreshAll() {
    if (this.busy) return
    this.busy = true
    try {
      await Promise.all(this.servers.map(server => this.refresh(server.id)))
    } finally {
      this.busy = false
    }
  }

  async refresh(id) {
    const server = this.servers.find(entry => entry.id === id)
    const session = this.sessions.get(id)
    const entry = this.entries.get(id)
    if (server === undefined || session === undefined || entry === undefined) return
    try {
      const state = await session.state()
      const bots = Array.isArray(state.bots) ? state.bots : []
      const work = objectOf(state.work)
      const workingMap = objectOf(work.bots)
      const questions = objectOf(state.questions)
      const workingKeys = Object.keys(workingMap).filter(key => workingMap[key] !== null && typeof workingMap[key] === 'object')
      const waitingKeys = Object.keys(questions)
      const currentKey = workingKeys[0]
      const currentBot = currentKey === undefined ? null : bots.find(bot => bot.id === currentKey)?.name ?? currentKey
      entry.bots = bots
      entry.revision = typeof state.revision === 'number' ? state.revision : 0
      entry.readOnly = typeof state.readOnly === 'boolean' ? state.readOnly : null
      entry.live = {
        working: workingKeys.length,
        waiting: waitingKeys.length,
        current: currentBot,
        elapsedMs: currentKey === undefined ? null : elapsedOf(workingMap[currentKey]),
      }
      entry.status = 'ok'
      entry.reason = ''
      entry.checkedAt = Date.now()
    } catch (error) {
      entry.status = error?.kind ?? 'error'
      entry.reason = String(error?.message ?? error)
      entry.checkedAt = Date.now()
      if (entry.status !== 'unreachable') this.log?.(`[dsbot-hub] ${server.id}: ${entry.status} — ${entry.reason}`)
    }
  }

  summary() {
    return this.servers.map(server => {
      const entry = this.entries.get(server.id)
      return {
        id: server.id,
        label: server.label,
        endpoint: server.endpoint,
        origin: server.origin,
        status: entry?.status ?? 'error',
        reason: entry?.reason ?? '',
        live: entry?.live ?? { working: 0, waiting: 0, current: null, elapsedMs: null },
        counts: { bots: entry?.bots?.length ?? 0 },
        revision: entry?.revision ?? 0,
        readOnly: entry?.readOnly ?? null,
        checkedAt: entry?.checkedAt ?? 0,
      }
    })
  }
}
