import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { normalizeSpec, renderSvg } from '../src/core/index.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const examples = join(root, 'examples')
const output = join(root, 'docs', 'gallery')
const check = process.argv.includes('--check')
mkdirSync(output, { recursive: true })

const dom = new JSDOM('')
const parser = new dom.window.DOMParser()
let failures = 0

for (const file of readdirSync(examples).filter(name => name.endsWith('.json')).sort()) {
  const name = basename(file, '.json')
  const result = normalizeSpec(JSON.parse(readFileSync(join(examples, file), 'utf8')))
  if (!result.ok || !result.renderable) {
    console.error(`${name}: not renderable`, result.ok ? '' : result.error)
    failures += 1
    continue
  }
  if (result.warnings.length > 0) console.warn(`${name}: ${result.warnings.join('; ')}`)
  for (const theme of ['auto', 'light', 'dark']) {
    const { svg } = renderSvg(result.spec, { theme, standalone: true, idPrefix: `ig-${name}` })
    const document = parser.parseFromString(svg, 'image/svg+xml')
    if (document.querySelector('parsererror') !== null) {
      console.error(`${name} (${theme}): invalid XML`)
      failures += 1
    }
    if (!check) writeFileSync(join(output, theme === 'auto' ? `${name}.svg` : `${name}.${theme}.svg`), svg)
  }
}
if (failures > 0) process.exit(1)
console.log(check ? 'examples ok' : `wrote gallery to ${output}`)
