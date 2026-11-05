// Emoji reactions: message-attached, server-owned, and visible to the model.
import { defineTool } from '@deepseek-ai/dsh-tools'
import { createUserMessage } from '@deepseek-ai/dsh-llm'

const QUICK = ['👍', '❤️', '😂', '😮', '🙏']
const SOURCE = 'ds-bot-reactions'
const MAX_USER = 2
const MAX_BOT = 1
const TARGET_MS = 3000
const TEXT_MAX = 180

const output = { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: String(value) }] }

function cleanEmoji(value) {
  const text = String(value ?? '').trim()
  if (text === '' || text.length > 16) return undefined
  try {
    const parts = [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(text)]
    if (parts.length !== 1) return undefined
  } catch {
    if ([...text].length !== 1) return undefined
  }
  return /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(text) ? text : undefined
}

function keyParts(key) {
  const text = String(key ?? '')
  const at = text.lastIndexOf(':')
  if (at <= 0) return undefined
  const sessionId = text.slice(0, at)
  const time = Number(text.slice(at + 1))
  return Number.isSafeInteger(time) && time > 0 ? { key: text, sessionId, time } : undefined
}

function contentText(event) {
  const content = Array.isArray(event?.data?.content) ? event.data.content : []
  return content.filter(block => block?.type === 'text' && typeof block.text === 'string')
    .map(block => block.text).join('\n').trim().replace(/\s+/g, ' ').slice(0, TEXT_MAX)
}

async function eventAt(rt, sessionId, time) {
  try {
    for await (const event of rt.eventsBackwards(sessionId, AbortSignal.timeout(TARGET_MS), Infinity)) {
      if (event.time === time) return event
    }
  } catch {}
  return undefined
}

async function latestUserEvent(rt, sessionId) {
  try {
    for await (const event of rt.eventsBackwards(sessionId, AbortSignal.timeout(TARGET_MS), Infinity)) {
      if (event.type === 'user/message' && event.data?.source?.kind === 'user') return event
    }
  } catch {}
  return undefined
}

function roleOf(event) {
  if (event?.type === 'assistant/message') return 'bot'
  if (event?.type === 'user/message') return 'user'
  return 'system'
}

function entryFor(rt, key, event) {
  const current = rt.state.reactions[key]
  const role = roleOf(event)
  return {
    key,
    sessionId: keyParts(key)?.sessionId,
    time: keyParts(key)?.time,
    role,
    text: contentText(event),
    actors: { ...(current?.actors ?? {}) },
    at: Date.now(),
  }
}

function actorList(entry, actor) {
  const list = Array.isArray(entry.actors[actor]) ? entry.actors[actor] : []
  return list.filter(emoji => cleanEmoji(emoji) !== undefined).slice(0, MAX_USER)
}

function replaceLast(list, emoji, max) {
  if (list.includes(emoji)) return list.filter(item => item !== emoji)
  if (list.length >= max) return [...list.slice(0, max - 1), emoji]
  return [...list, emoji]
}

function snapshot(rt, key) {
  const entry = rt.state.reactions[key]
  return {
    key,
    emojis: entry ? [...new Set(Object.values(entry.actors ?? {}).flat().map(cleanEmoji).filter(Boolean))] : [],
  }
}

export function install(rt) {
  const { ctx, state } = rt

  const map = () => Object.fromEntries(Object.entries(state.reactions ?? {}).map(([key, entry]) => [
    key,
    [...new Set(Object.values(entry.actors ?? {}).flat().map(cleanEmoji).filter(Boolean))],
  ]).filter(([, emojis]) => emojis.length > 0))

  const reactUser = async (key, emoji) => {
    const parsed = keyParts(key)
    const clean = cleanEmoji(emoji)
    if (!parsed) throw Object.assign(new Error('Unknown message'), { code: 'bot/invalid' })
    if (!clean) throw Object.assign(new Error('That is not a single emoji'), { code: 'bot/invalid' })
    await rt.load()
    const event = await eventAt(rt, parsed.sessionId, parsed.time)
    if (!event) throw Object.assign(new Error('This message is no longer available'), { code: 'bot/stale' })
    const entry = entryFor(rt, parsed.key, event)
    const list = actorList(entry, 'user')
    entry.actors.user = replaceLast(list, clean, MAX_USER)
    if (entry.actors.user.length === 0) delete entry.actors.user
    if (Object.keys(entry.actors).length === 0) delete state.reactions[parsed.key]
    else state.reactions[parsed.key] = entry
    await rt.save()
    return snapshot(rt, parsed.key)
  }

  const reactBot = async (sessionId, event, botId, emoji) => {
    const key = `${sessionId}:${event.time}`
    const clean = cleanEmoji(emoji)
    if (!clean) throw new Error('That is not a single emoji')
    const entry = entryFor(rt, key, event)
    entry.actors[botId] = [clean]
    state.reactions[key] = entry
    await rt.save()
    return snapshot(rt, key)
  }

  Object.assign(rt, { reactUser, reactBot, reactionMap: map })

  rt.teamTools.push(defineTool({
    name: 'react',
    description: 'Add one emoji reaction to the latest message from the user, only when the emoji genuinely adds meaning. Do not use a reaction instead of replying, do not react to every message, and do not react to your own messages. If nothing fits, do not call this tool.',
    parameters: {
      emoji: {
        type: 'string',
        required: true,
        enum: QUICK,
        description: 'The reaction: 👍 approval, ❤️ warmth, 😂 humor, 😮 surprise, or 🙏 thanks.',
      },
    },
    output,
    async execute(args, exec) {
      await rt.load()
      const self = rt.selfOf(exec.agent?.id)
      if (rt.botOf(self) === undefined) return 'Only Bots on the team can react.'
      const event = await latestUserEvent(rt, exec.agent.id)
      if (!event) return 'There is no user message to react to.'
      const clean = cleanEmoji(args.emoji)
      if (!clean) return 'Use one emoji from the allowed list.'
      await reactBot(exec.agent.id, event, self, clean)
      return `Reacted ${clean} to the user's message.`
    },
  }))

  // A reaction is a small, explicit event the next turn should see. It is a
  // snapshot message, not chat content, so the client never renders it.
  ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    if (decision.kind === 'reject') return decision
    const sessionId = payload.agent?.id
    if (!rt.isBotSession(sessionId)) return decision
    await rt.load()
    const entries = Object.values(state.reactions ?? {})
      .filter(entry => entry.sessionId === sessionId && entry.role === 'bot' && Array.isArray(entry.actors?.user) && entry.actors.user.length > 0)
      .sort((a, b) => (a.at ?? 0) - (b.at ?? 0))
      .slice(-6)
    if (entries.length === 0) return decision
    const lines = entries.map(entry => {
      const emojis = [...new Set(entry.actors.user)].join(' ')
      const quote = entry.text ? ` on "${entry.text}"` : ''
      return `- ${emojis}${quote}`
    })
    const text = `The user reacted to your messages:\n${lines.join('\n')}`
    return {
      ...decision,
      messages: [...decision.messages, createUserMessage({
        content: [{ type: 'text', text }],
        source: { kind: SOURCE, form: 'snapshot', sections: [{ name: SOURCE, text }] },
      })],
    }
  }, { prepend: true })
}
