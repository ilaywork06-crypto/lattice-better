// Fails if a translation key used in the code is missing from a dictionary,
// or if the Hebrew dictionary is missing a key the English one has.
//   node --experimental-strip-types scripts/check-i18n.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const en = (await import('../src/i18n/en.ts')).default
const he = (await import('../src/i18n/he.ts')).default

const flat = (obj, prefix = '', out = new Set()) => {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object') flat(v, key, out)
    else out.add(key)
  }
  return out
}
const enKeys = flat(en)
const heKeys = flat(he)
const has = (keys, k) => keys.has(k) || keys.has(`${k}_one`) || keys.has(`${k}_other`)

const files = []
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) { if (f !== 'generated' && f !== 'i18n') walk(p) }
    else if (/\.tsx?$/.test(f)) files.push(p)
  }
}
walk('src')
const used = new Set()
for (const f of files) {
  for (const m of readFileSync(f, 'utf8').matchAll(/\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g)) used.add(m[1])
  for (const m of readFileSync(f, 'utf8').matchAll(/['"]((?:nav|common|items|workflow)\.[a-zA-Z0-9_.]+)['"]/g)) used.add(m[1])
}
let bad = 0
for (const k of used) {
  if (!has(enKeys, k) && !/^(nav|common|items|workflow)\.$/.test(k)) { console.log('missing in en:', k); bad++ }
}
for (const k of enKeys) {
  const base = k.replace(/_(one|other|two|many)$/, '')
  if (!has(heKeys, base)) { console.log('missing in he:', k); bad++ }
}
for (const k of heKeys) {
  const base = k.replace(/_(one|other|two|many)$/, '')
  if (!has(enKeys, base)) { console.log('extra in he:', k); bad++ }
}
console.log(`${used.size} keys used, ${enKeys.size} en, ${heKeys.size} he — ${bad ? `${bad} problem(s)` : 'ok'}`)
process.exit(bad ? 1 : 0)
