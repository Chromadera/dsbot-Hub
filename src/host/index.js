import { normalizeConfig } from './config.js'
import { Health } from './health.js'
import { PanelApi } from './routes.js'
import { ProxyManager } from './proxy.js'
import { ServerSession } from './session.js'
import { registerTools } from './tools.js'

export const inject = ['webServer']

export async function apply(ctx, rawConfig = {}) {
  const config = normalizeConfig(rawConfig)
  const log = (...args) => console.log(...args)
  const sessions = new Map()
  for (const server of config.servers) sessions.set(server.id, new ServerSession(server, ctx, log))

  const health = new Health(config.servers, sessions, log)
  const proxy = new ProxyManager(config.servers, sessions, config, log)
  const api = new PanelApi(ctx, config.servers, sessions, health, proxy, config, log)

  ctx.effect(() => {
    const dispose = ctx.webServer.register({
      kind: 'prefix',
      path: '/dsbot-hub/api',
      handler: (req, res) => void api.handle(req, res),
    })
    return () => dispose()
  })

  registerTools(ctx, config.servers, sessions, health, log)

  health.start()
  ctx.effect(() => () => health.stop())

  // Every team is served on its own origin (its own listener, or the shared
  // hostname listener). The panel API above is the only DSH route the hub adds:
  // the embedded app never shares the DSH origin.
  await proxy.start()
  ctx.effect(() => () => proxy.close())

  log(`[dsbot-hub] ${config.servers.length} server(s): ${config.servers.map(server => `${server.id} → ${server.endpoint} @ ${server.origin}`).join(' · ') || 'none configured'}`)
}
