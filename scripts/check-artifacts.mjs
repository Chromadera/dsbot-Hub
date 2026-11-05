#!/usr/bin/env node
/**
 * Audits release tarballs for distribution hygiene, without extracting them:
 *
 *   - no local owner or group (every entry must be 0/0)
 *   - no symlink or hardlink entries
 *   - no private 600/700 modes
 *   - no absolute or parent-relative entry names
 *
 * Run after `npm run build:release`. It is a no-op when no tarballs exist, so it
 * is safe in CI and in a fresh checkout.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const dir = join(root, 'release')
const files = existsSync(dir)
  ? readdirSync(dir).filter(name => /\.(?:tgz|tar\.gz)$/.test(name)).sort()
  : []

if (files.length === 0) {
  console.log('artifact check: no tarballs to inspect')
  process.exit(0)
}

let problems = 0
for (const file of files) {
  const listing = execFileSync('tar', ['-tvzf', join(dir, file)], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  const bad = []
  let entries = 0
  for (const line of listing.split('\n')) {
    if (line.trim() === '') continue
    entries += 1
    const parts = line.split(/\s+/)
    const [mode, owner] = parts
    const name = parts.slice(5).join(' ')
    if (mode === undefined || owner === undefined || name === '') {
      bad.push(`unparsed entry: ${line.slice(0, 80)}`)
      continue
    }
    if (owner !== '0/0') bad.push(`${name}: owner ${owner}`)
    if (/^[lh]/.test(mode)) bad.push(`${name}: link entry (${mode})`)
    if (/^[d-][rwx-]{3}------$/.test(mode)) bad.push(`${name}: private mode ${mode}`)
    if (name.startsWith('/')) bad.push(`${name}: absolute entry name`)
    if (name.split('/').includes('..')) bad.push(`${name}: parent-relative entry name`)
  }
  if (entries === 0) bad.push('empty archive')
  if (bad.length > 0) {
    problems += bad.length
    console.error(`\n${file}:`)
    for (const line of bad.slice(0, 10)) console.error(`  ${line}`)
    if (bad.length > 10) console.error(`  ... and ${bad.length - 10} more`)
  } else {
    console.log(`ok: ${file} (${entries} entries)`)
  }
}

if (problems > 0) {
  console.error(`\nartifact check failed: ${problems} problem(s)`)
  process.exit(1)
}
console.log('artifact check passed')
