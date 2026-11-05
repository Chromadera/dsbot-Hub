import { ServerError } from './session.js'

const DEFAULT_TIMEOUT = 240
const MAX_TIMEOUT = 600
const POLL_MS = 1_500

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(new ServerError('timeout', 'The tool call was aborted.'))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener?.('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new ServerError('timeout', 'The tool call was aborted.'))
    }
    signal?.addEventListener?.('abort', onAbort, { once: true })
  })
}

function errorValue(error, server) {
  const code = error?.kind ?? 'error'
  const message = String(error?.message ?? error)
  return {
    ok: false,
    server: server.label,
    error: { code, message },
    text: `Error (${code}) — ${message}`,
  }
}

function textResult(value, text) {
  return { ...value, text }
}

function findBot(bots, wanted) {
  const needle = String(wanted ?? '').trim()
  if (needle === '') return null
  const lower = needle.toLowerCase()
  return bots.find(bot => bot.id === needle)
    ?? bots.find(bot => String(bot.name ?? '').toLowerCase() === lower)
    ?? bots.find(bot => String(bot.name ?? '').toLowerCase().startsWith(lower))
    ?? null
}

function otherServerWithBot(servers, health, current, name) {
  const lower = String(name ?? '').trim().toLowerCase()
  if (lower === '') return null
  for (const server of servers) {
    if (server.id === current.id) continue
    const bots = health.entry(server.id)?.bots ?? []
    if (bots.some(bot => String(bot.name ?? '').toLowerCase() === lower || bot.id === name)) return server
  }
  return null
}

async function resolveBot(server, servers, health, sessions, wanted) {
  const state = await sessions.get(server.id).state()
  const bots = Array.isArray(state.bots) ? state.bots : []
  const bot = findBot(bots, wanted)
  if (bot !== null) return { bot, bots }
  const other = otherServerWithBot(servers, health, server, wanted)
  if (other !== null) {
    throw new ServerError('wrong_server', `"${String(wanted)}" belongs to ${other.label}, not ${server.label}. Select ${other.label} and call its tool.`)
  }
  throw new ServerError('unknown_bot', `No bot "${String(wanted)}" on ${server.label}. Bots here: ${bots.map(item => item.name).join(', ')}`)
}

function toolName(server, suffix) {
  // Keep hyphens distinct from underscores so ids `a-b` and `a_b` cannot
  // collide, and lowercase so a provider's case rules cannot fold them.
  return `dsbot_${server.id.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}_${suffix}`
}

function makeTools(server, servers, sessions, health, log) {
  const list = toolName(server, 'list_bots')
  const ask = toolName(server, 'ask_bot')
  const read = toolName(server, 'read_chat')
  const label = server.label

  const output = {
    schema: { type: 'object', additionalProperties: true },
    render: (_args, value) => [{ type: 'text', text: value?.text ?? JSON.stringify(value) }],
  }

  return [
    {
      name: list,
      description: `List the bots on ${label}. This tool reaches ${label} only; bots on other servers are refused.`,
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      output,
      async execute() {
        try {
          const session = sessions.get(server.id)
          const state = await session.state()
          const bots = Array.isArray(state.bots) ? state.bots : []
          const lines = bots.map(bot => `- ${bot.name}${bot.role ? ` — ${bot.role}` : ''}`)
          const value = { ok: true, server: label, bots: bots.map(bot => ({ id: bot.id, name: bot.name, role: bot.role ?? '' })) }
          return textResult(value, `${label} — ${bots.length} bots:\n${lines.join('\n')}`)
        } catch (error) {
          return errorValue(error, server)
        }
      },
    },
    {
      name: ask,
      description: `Send a message to one bot on ${label} and wait for its reply. A bot that belongs to another server is refused by name. Returns the turn id so a timeout is distinguishable from a failure.`,
      parameters: {
        type: 'object',
        properties: {
          bot: { type: 'string', description: 'Bot name or id, from list_bots' },
          text: { type: 'string', description: 'The message to send' },
          timeout_seconds: { type: 'number', description: `How long to wait for a reply (default ${DEFAULT_TIMEOUT}, max ${MAX_TIMEOUT})` },
        },
        required: ['bot', 'text'],
        additionalProperties: false,
      },
      output,
      async execute(args, exec) {
        try {
          const session = sessions.get(server.id)
          const { bot } = await resolveBot(server, servers, health, sessions, args?.bot)
          const before = await session.chat(bot.id)
          const beforeItems = Array.isArray(before.items) ? before.items : []
          const baseline = beforeItems.reduce((max, item) => Math.max(max, Number(item.seq) || 0), 0)
          const sent = await session.send(bot.sessionId ?? bot.id, String(args?.text ?? ''))
          const seconds = Math.min(MAX_TIMEOUT, Math.max(1, Number(args?.timeout_seconds) || DEFAULT_TIMEOUT))
          const deadline = Date.now() + seconds * 1000
          let lastTurn = sent?.turn ?? beforeItems.at(-1)?.turn ?? null
          let lastSeq = baseline
          while (Date.now() < deadline) {
            await sleep(Math.min(POLL_MS, Math.max(250, deadline - Date.now())), exec?.signal)
            const page = await session.chat(bot.id)
            const items = Array.isArray(page.items) ? page.items : []
            const fresh = items.filter(item => Number(item.seq) > baseline && item.kind === 'bot' && String(item.text ?? '').trim() !== '')
            // The send response names the turn this call owns. If the server
            // provides it, accept only that turn so two concurrent callers on
            // the same bot cannot read each other's answers.
            const hasTurn = sent?.turn !== undefined && sent?.turn !== null
            const owned = hasTurn
              ? fresh.filter(item => item.turn === undefined || item.turn === null || String(item.turn) === String(sent.turn))
              : fresh
            const answer = owned
            if (answer.length > 0) {
              const turn = answer.at(-1)?.turn ?? lastTurn
              const value = {
                ok: true,
                server: label,
                bot: bot.name,
                turn: turn ?? null,
                seq: answer.at(-1)?.seq ?? null,
              }
              return textResult(value, answer.map(item => item.text).join('\n\n'))
            }
            // Only items after the baseline belong to this turn. The old tail is
            // the previous turn and must not overwrite the turn we just sent.
            const newest = items.filter(item => Number(item.seq) > baseline).at(-1)
            if (newest !== undefined) {
              lastSeq = Math.max(lastSeq, Number(newest.seq) || 0)
              lastTurn = newest.turn ?? lastTurn
            }
          }
          return {
            ok: false,
            server: label,
            bot: bot.name,
            turn: lastTurn ?? null,
            error: {
              code: 'timeout',
              message: `No reply on ${label} within ${seconds}s (turn ${lastTurn ?? 'unknown'}, last seq ${lastSeq}); it is still running.`,
            },
            text: `No reply on ${label} within ${seconds}s. Turn ${lastTurn ?? 'unknown'} is still running; read_chat will show the answer when it lands.`,
          }
        } catch (error) {
          return errorValue(error, server)
        }
      },
    },
    {
      name: read,
      description: `Read the most recent messages of one bot's chat on ${label}. This tool reaches ${label} only.`,
      parameters: {
        type: 'object',
        properties: {
          bot: { type: 'string', description: 'Bot name or id' },
          limit: { type: 'number', description: 'How many messages (default 20, max 100)' },
        },
        required: ['bot'],
        additionalProperties: false,
      },
      output,
      async execute(args) {
        try {
          const session = sessions.get(server.id)
          const { bot } = await resolveBot(server, servers, health, sessions, args?.bot)
          const limit = Math.min(100, Math.max(1, Number(args?.limit) || 20))
          const page = await session.chat(bot.id)
          const items = (Array.isArray(page.items) ? page.items : []).slice(-limit)
          const value = {
            ok: true,
            server: label,
            bot: bot.name,
            items: items.map(item => ({ kind: item.kind, text: item.text ?? '', seq: item.seq ?? null, turn: item.turn ?? null })),
          }
          const text = items.length === 0
            ? `${label} · ${bot.name}: no messages.`
            : `${label} · ${bot.name}:\n\n${items.map(item => `[${item.kind}] ${String(item.text ?? '').slice(0, 2000)}`).join('\n\n')}`
          return textResult(value, text)
        } catch (error) {
          return errorValue(error, server)
        }
      },
    },
  ]
}

/** Register one namespaced tool set per server when the Host tools service exists. */
export function registerTools(ctx, servers, sessions, health, log) {
  ctx.inject(['tools'], toolCtx => {
    toolCtx.effect(() => {
      const disposers = []
      for (const server of servers) {
        for (const definition of makeTools(server, servers, sessions, health, log)) {
          try {
            disposers.push(toolCtx.tools.register(definition))
          } catch (error) {
            log?.(`[dsbot-hub] tool ${definition.name} failed: ${error?.message ?? error}`)
          }
        }
      }
      return () => {
        for (const dispose of disposers) {
          try { dispose() } catch {}
        }
      }
    })
  })
}

export { makeTools, resolveBot, findBot }
