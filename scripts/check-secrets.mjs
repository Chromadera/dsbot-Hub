#!/usr/bin/env node
/**
 * Scans the working tree (and optionally git history) for credentials and
 * deployment-identifying strings that must not ship in a public release.
 *
 *   node scripts/check-secrets.mjs            # working tree
 *   node scripts/check-secrets.mjs --history  # working tree + the current
 *                                             # branch's commits (what a push
 *                                             # of this branch would send)
 *
 * Rules are deliberately generic: this file is published, so it must not name
 * the maintainer's home directory, tailnet address, or any host-specific path.
 * Matched values are masked in the output.
 *
 * Exit codes: 0 clean, 1 findings.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SELF = relative(ROOT, fileURLToPath(import.meta.url))
const HISTORY = process.argv.includes('--history')

const SKIP_DIRS = new Set([
  '.git', 'node_modules', '.backups', '.dsh-home', '.xdg',
  'dist', 'coverage', '.npm', '.cache', '.yarn',
])
const SKIP_FILE = /\.(tgz|tar\.gz|zip|png|jpe?g|gif|webp|ico|woff2?|ttf|otf|mp4|webm|pdf|node|sqlite)$/i
const MAX_BYTES = 2 * 1024 * 1024
const ALLOW_MARKER = 'secret-scan: allow'

const RULES = [
  { id: 'private-key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, credential: true },
  { id: 'aws-key', re: /\bAKIA[0-9A-Z]{16}\b/, credential: true },
  { id: 'github-token', re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/, credential: true },
  { id: 'provider-key', re: /\bsk-[A-Za-z0-9_-]{24,}\b/, credential: true },
  { id: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, credential: true },
  { id: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/, credential: true },
  { id: 'bearer-literal', re: /\bBearer[ \t]+[A-Za-z0-9._~+/=-]{20,}/, credential: true },
  { id: 'url-token', re: /[?&]token=[A-Za-z0-9._~-]{16,}/, credential: true },
  { id: 'assigned-secret', re: /\b[A-Z][A-Z0-9_]*(?:API_KEY|_TOKEN|_SECRET|PASSWORD|_COOKIE)[ \t]*[:=][ \t]*['"]?[A-Za-z0-9._~+/=-]{20,}/, credential: true },
  // Not credentials, but publishing either one identifies the operator's host.
  { id: 'home-path', re: /\/(?:home|Users)\/[A-Za-z0-9._-]+\//, credential: false },
  { id: 'private-ip', re: /\b(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01])|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7]))\.\d{1,3}\.\d{1,3}\b/, credential: false },
]

const FORBIDDEN_FILES = [
  { test: name => name === '.env' || (name.startsWith('.env.') && name !== '.env.example'), why: 'env file' },
  { test: name => /^(?:secrets|credentials)\.json$/i.test(name), why: 'secrets file' },
  { test: name => /\.(?:pem|key|p12|pfx|keystore|jks)$/i.test(name), why: 'private key material' },
  { test: name => /^id_(?:rsa|dsa|ecdsa|ed25519)(?:\.|$)/.test(name), why: 'ssh private key' },
  { test: name => /^cookies?[^/]*\.txt$/i.test(name), why: 'cookie jar' },
  { test: name => /(?:^|\/)\.npmrc$/.test(name), why: 'npm auth file' },
  { test: name => /(?:^|\/)\.netrc$/.test(name), why: 'netrc credentials' },
  { test: name => /(?:^|\/)auth\.json$/i.test(name), why: 'auth state' },
]

const mask = value => {
  if (value.length <= 6) return '*'.repeat(value.length)
  return `${value.slice(0, 4)}${'*'.repeat(Math.min(8, value.length - 4))}`
}

function findingsIn(text) {
  const found = []
  for (const rule of RULES) {
    const re = new RegExp(rule.re.source, rule.re.flags.includes('g') ? rule.re.flags : `${rule.re.flags}g`)
    let match
    while ((match = re.exec(text)) !== null) {
      found.push({ rule, value: match[0] })
      if (match.index === re.lastIndex) re.lastIndex += 1
    }
  }
  return found
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || name.startsWith('.probe')) continue
    const path = join(dir, name)
    let stat
    try { stat = statSync(path) } catch { continue }
    if (stat.isDirectory()) { yield* walk(path); continue }
    if (!stat.isFile() || stat.size > MAX_BYTES || SKIP_FILE.test(name)) continue
    yield path
  }
}

const tree = []
const history = []

for (const path of walk(ROOT)) {
  const rel = relative(ROOT, path)
  if (rel === SELF) continue
  const name = basename(path)
  const forbidden = FORBIDDEN_FILES.find(rule => rule.test(name))
  if (forbidden !== undefined) {
    tree.push({ rel, line: 0, rule: forbidden.why, value: name })
    continue
  }
  let text
  try { text = readFileSync(path, 'utf8') } catch { continue }
  text.split(/\r?\n/).forEach((line, index) => {
    if (line.includes(ALLOW_MARKER)) return
    for (const found of findingsIn(line)) {
      tree.push({ rel, line: index + 1, rule: found.rule.id, value: found.value, credential: found.rule.credential })
    }
  })
}

function scanHistory() {
  let revs
  try {
    // HEAD ancestry only. Other local branches are not what a push of this
    // branch sends, and an archived pre-release branch should not make the
    // release check fail forever.
    revs = execFileSync('git', ['rev-list', 'HEAD'], { cwd: ROOT, encoding: 'utf8' })
      .trim().split('\n').filter(Boolean)
  } catch {
    return
  }
  if (revs.length === 0) return
  // git grep uses POSIX ERE, which has no `(?:`, `\d`, `\t` or `\b`. The grep
  // is only a prefilter: every hit is re-checked with the JS rules below, so
  // dropping a word boundary (and matching more) is safe.
  const posix = source => source
    .replace(/\(\?:/g, '(')
    .replace(/\\d/g, '[0-9]')
    .replace(/\\t/g, '[[:space:]]')
    .replace(/\\b/g, '')
  const combined = RULES.map(rule => `(${posix(rule.re.source)})`).join('|')
  let output = ''
  try {
    output = execFileSync('git', ['grep', '-nI', '-E', '-e', combined, ...revs], {
      cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    })
  } catch (error) {
    const stderr = String(error.stderr ?? '')
    if (/fatal:|Invalid preceding|Not a git repository/i.test(stderr)) {
      throw new Error(`git grep could not scan history: ${stderr.trim()}`)
    }
    // Exit status 1 means "no matches".
    output = error.stdout?.toString() ?? ''
  }
  const seen = new Set()
  for (const row of output.split('\n')) {
    if (row === '') continue
    const match = /^([0-9a-f]{7,40}):([^:]+):(\d+):(.*)$/.exec(row)
    if (match === null) continue
    const [, rev, rel, line, content] = match
    const key = `${rel}:${content}`
    if (seen.has(key)) continue
    const found = findingsIn(content)
    if (found.length === 0) continue
    seen.add(key)
    for (const item of found) {
      history.push({ rev: rev.slice(0, 10), rel, line, rule: item.rule.id, value: item.value, credential: item.rule.credential })
    }
  }
}

const print = rows => {
  for (const row of rows) {
    const where = row.line === 0 ? row.rel : `${row.rel}:${row.line}`
    console.log(`  ${where}  [${row.rule}] ${mask(row.value)}`)
  }
}

const secretTree = tree.filter(row => row.credential === true)
const identifyTree = tree.filter(row => row.credential === false)

console.log(`scanning ${ROOT}`)
if (secretTree.length > 0) {
  console.error('\ncredential-shaped values in the working tree:')
  print(secretTree)
}
if (identifyTree.length > 0) {
  console.error('\nhost-identifying strings in the working tree:')
  print(identifyTree)
}

let secretHistory = []
if (HISTORY) {
  try {
    scanHistory()
  } catch (error) {
    console.error(`\nsecret check failed: ${error.message}`)
    process.exit(1)
  }
  secretHistory = history.filter(row => row.credential === true)
  const identifyHistory = history.filter(row => row.credential === false)
  if (identifyHistory.length > 0) {
    console.warn('\nwarning: host-identifying strings exist in git history.')
    console.warn('  They are not credentials, but publishing the history reveals them.')
    console.warn('  Either rewrite history, or publish a fresh repository with one commit.')
    print(identifyHistory.slice(0, 20))
    if (identifyHistory.length > 20) console.warn(`  ... and ${identifyHistory.length - 20} more`)
  }
  if (secretHistory.length > 0) {
    console.error('\ncredential-shaped values in git history:')
    print(secretHistory.slice(0, 40))
    if (secretHistory.length > 40) console.error(`  ... and ${secretHistory.length - 40} more`)
  }
}

const failed = secretTree.length + secretHistory.length
if (failed > 0) {
  console.error(`\nsecret check failed: ${failed} credential finding(s).`)
  console.error('Remove the value, rotate the credential if it was real, and re-run.')
  process.exit(1)
}
if (identifyTree.length > 0) {
  console.error(`\nsecret check failed: ${identifyTree.length} host-identifying string(s) in the tree.`)
  console.error('Replace host-specific paths, usernames and addresses with generic placeholders.')
  process.exit(1)
}
console.log(HISTORY ? '\nsecret check passed (tree and history).' : '\nsecret check passed (tree).')
