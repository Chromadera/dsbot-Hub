#!/usr/bin/env node
/**
 * Release metadata checks that run before packaging and in CI.
 *
 * This file is published. Keep every rule generic: no maintainer home
 * directories, no tailnet addresses, no host-specific paths. Credential and
 * host-identity scanning lives in scripts/check-secrets.mjs.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const problems = []
const warnings = []
const exists = path => existsSync(join(root, path))
const text = path => readFileSync(join(root, path), 'utf8')

const expect = (condition, message) => {
  if (!condition) problems.push(message)
}

// A distribution tree must not carry symlinks or hardlinks. The release build
// also checks its staging directory, but catch it before it gets that far.
function auditLinks() {
  const symlinks = []
  const hardlinks = []
  const skip = new Set(['.git', 'node_modules', '.probe', '.backups', '.dsh-home', '.xdg'])
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      if (skip.has(name) || name.startsWith('.probe')) continue
      const path = join(dir, name)
      const stat = lstatSync(path)
      if (stat.isSymbolicLink()) { symlinks.push(relative(root, path)); continue }
      if (stat.isDirectory()) { walk(path); continue }
      if (stat.nlink > 1) hardlinks.push(relative(root, path))
    }
  }
  walk(root)
  expect(symlinks.length === 0, `tree: symlinks are not distributable (${symlinks.slice(0, 5).join(', ')})`)
  expect(hardlinks.length === 0, `tree: hardlinks are not distributable (${hardlinks.slice(0, 5).join(', ')})`)
}
auditLinks()

const version = pkg.version

// Package shape -------------------------------------------------------------
expect(pkg.private === false, 'package.json: `private` must be false to publish')
expect(pkg.license === 'Apache-2.0', 'package.json: license must be Apache-2.0')
expect(typeof pkg.engines?.node === 'string', 'package.json: engines.node is required')
// The hub's client needs shell.mobile.nav, which is 0.2.2+ only. DSH enforces
// engines.dsh on install and activation, so the range is the one place a new
// DSH floor is bumped.
expect(
  typeof pkg.engines?.dsh === 'string' && pkg.engines.dsh.trim() !== '',
  'package.json: engines.dsh is required (the hub needs DSH 0.2.2+ for shell.mobile.nav)',
)
for (const required of [
  'CHANGELOG.md', 'SECURITY.md', 'THIRD_PARTY.md', 'NOTICE', 'LICENSE',
  'README.md', 'SETUP.md', 'docs', 'src', 'index.js', 'client.js',
]) {
  expect(pkg.files?.includes(required), `package.json: files[] is missing ${required}`)
}
if (!pkg.repository) {
  warnings.push('package.json: no repository URL; `npm publish --provenance` will fail until one is set')
}

// Version consistency -------------------------------------------------------
if (exists('release/VERSIONS.md')) {
  expect(
    text('release/VERSIONS.md').includes(`| dsbot-hub | ${version} |`),
    'release/VERSIONS.md: hub version does not match package.json',
  )
}
if (exists('release/profile/package.json')) {
  const profile = JSON.parse(text('release/profile/package.json'))
  expect(
    profile.dependencies?.['dsbot-hub'] === version,
    'release/profile/package.json: dsbot-hub dependency does not match package.json',
  )
}
if (exists('release/RELEASE.json')) {
  const manifest = JSON.parse(text('release/RELEASE.json'))
  expect(manifest.version === version, 'release/RELEASE.json: version does not match package.json')
  expect(manifest.name === pkg.name, 'release/RELEASE.json: name does not match package.json')
}

// Release staging -----------------------------------------------------------
const staging = [
  'release/install.sh',
  'release/preflight.sh',
  'release/README.md',
  'release/VERSIONS.md',
  'release/server/compose.yml',
  'release/server/Dockerfile',
  'release/server/install-existing.sh',
  'release/server/.env.example',
  'release/profile/package.json',
  'release/profile/cordis.patch.yml',
  'release/examples/dsh-web.service',
]
for (const path of staging) expect(exists(path), `${path}: missing from the release staging`)

// The compose file must never hardcode a provider: it passes server/.env so
// any route the profile declares can be keyed.
if (exists('release/server/compose.yml')) {
  const compose = text('release/server/compose.yml')
  expect(
    compose.includes('env_file:'),
    'release/server/compose.yml: must pass server/.env into the container',
  )
  expect(
    !/OPENCODE_GO_API_KEY\s*:/.test(compose),
    'release/server/compose.yml: do not hardcode a provider key variable',
  )
}

// README relative links must resolve ---------------------------------------
function checkLinks(file) {
  if (!exists(file)) return
  const fileDir = dirname(join(root, file))
  const body = text(file)
  for (const match of body.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = match[1]
    if (/^(?:https?:|mailto:|#)/.test(target)) continue
    const clean = target.split('#')[0]
    if (clean === '') continue
    // Staging files (for example release/README.md) link to files that the
    // archive places at its root but the checkout keeps at the repo root.
    const resolved = [join(fileDir, clean), join(root, clean)]
    expect(resolved.some(candidate => existsSync(candidate)), `${file}: broken relative link -> ${target}`)
  }
}
for (const file of ['README.md', 'SETUP.md', 'release/README.md']) checkLinks(file)

// Artifacts, when present, must agree with the manifest --------------------
if (exists('release')) {
  const files = readdirSync(join(root, 'release'))
  // More than one fork tarball may sit in release/ (a previous version kept for
  // rollback); the manifest must describe the newest one, not directory order.
  const fork = files
    .filter(name => /^ds-bot-.*\.tgz$/.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .at(-1)
  if (fork !== undefined && exists('release/RELEASE.json')) {
    const manifest = JSON.parse(text('release/RELEASE.json'))
    expect(manifest.artifacts?.dsbot === fork, `release/RELEASE.json: dsbot artifact is ${fork}`)
  }
  const hub = `dsbot-hub-${version}.tgz`
  if (files.includes(hub) && exists('release/RELEASE.json')) {
    expect(
      JSON.parse(text('release/RELEASE.json')).artifacts?.hub === hub,
      `release/RELEASE.json: hub artifact should be ${hub}`,
    )
  }
}

if (warnings.length > 0) {
  for (const warning of warnings) console.warn(`warning: ${warning}`)
}
if (problems.length > 0) {
  console.error('release check failed:')
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}
console.log(`release check passed for ${pkg.name} ${version}`)
console.log(`  checked from ${relative(process.cwd(), root) || '.'}`)
