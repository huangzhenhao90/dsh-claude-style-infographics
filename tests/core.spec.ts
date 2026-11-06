import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'
import { looksLikeInfographic, normalizeSpec, parseLoose, readFence, renderInfographic, renderSvg } from '../src/core/index.ts'

const examplesDir = join(import.meta.dirname, '..', 'examples')
const examples = readdirSync(examplesDir).filter(name => name.endsWith('.json')).sort()
const parser = new (new JSDOM('').window.DOMParser)()

function wellFormed(svg: string): boolean {
  return parser.parseFromString(svg, 'image/svg+xml').querySelector('parsererror') === null
}

describe('parseLoose', () => {
  it('parses complete JSON', () => {
    expect(parseLoose('{"a":[1,2,{"b":null}]}')).toEqual({ value: { a: [1, 2, { b: null }] }, complete: true })
  })

  it('keeps what is complete when the input is truncated', () => {
    const result = parseLoose('{"title":"Hi","data":[12,18,2')
    expect(result?.complete).toBe(false)
    expect(result?.value).toEqual({ title: 'Hi', data: [12, 18] })
  })

  it('drops an unfinished key, string or literal', () => {
    expect(parseLoose('{"a":1,"b')?.value).toEqual({ a: 1 })
    expect(parseLoose('{"a":1,"b":"unfinis')?.value).toEqual({ a: 1 })
    expect(parseLoose('{"a":1,"b":tr')?.value).toEqual({ a: 1 })
    expect(parseLoose('{"a":[1,2')?.value).toEqual({ a: [1] })
  })

  it('tolerates trailing commas, comments and junk after the root', () => {
    expect(parseLoose('{"a":1,/* c */"b":[1,2,],} trailing tool template')).toEqual({ value: { a: 1, b: [1, 2] }, complete: true })
  })

  it('rejects text that is not JSON', () => {
    expect(parseLoose('hello')).toBeNull()
    expect(parseLoose('')).toBeNull()
  })

  it('is bounded on deeply nested input', () => {
    expect(() => parseLoose('['.repeat(5000))).not.toThrow()
  })
})

describe('normalizeSpec', () => {
  it('rejects an unknown kind', () => {
    const result = normalizeSpec({ infographic: 'pie' })
    expect(result).toMatchObject({ ok: false, code: 'kind' })
  })

  it('accepts aliases for the kind key and for fields', () => {
    const result = normalizeSpec({ type: 'flow', steps: [{ name: 'A' }, { name: 'B' }], links: ['A->B'] })
    expect(result.ok && result.spec.infographic === 'flow' && result.spec.edges).toEqual([{ from: 'A', to: 'B', dashed: false }])
  })

  it('chains nodes when edges are absent, but not while streaming', () => {
    const body = { infographic: 'flow', nodes: [{ label: 'A' }, { label: 'B' }, { label: 'C' }] }
    const done = normalizeSpec(body)
    const streaming = normalizeSpec(body, { streaming: true })
    expect(done.ok && done.spec.infographic === 'flow' && done.spec.edges.length).toBe(2)
    expect(streaming.ok && streaming.spec.infographic === 'flow' && streaming.spec.edges.length).toBe(0)
  })

  it('resolves edge references by id, label and index', () => {
    const result = normalizeSpec({ infographic: 'flow', nodes: [{ id: 'x', label: 'First' }, { id: 'y', label: 'Second' }], edges: [['First', 'y'], [1, 0], ['x', 'nope']] })
    expect(result.ok && result.spec.infographic === 'flow' && result.spec.edges.map(edge => `${edge.from}>${edge.to}`)).toEqual(['x>y', 'y>x'])
  })

  it('caps list sizes and warns', () => {
    const categories = Array.from({ length: 40 }, (_, index) => `c${index}`)
    const result = normalizeSpec({ infographic: 'bar', categories, series: [{ name: 's', data: categories.map((_, index) => index) }] })
    expect(result.ok && result.spec.infographic === 'bar' && result.spec.categories.length).toBe(24)
    expect(result.ok && result.warnings.length).toBeGreaterThan(0)
  })

  it('ignores colours that are not palette names', () => {
    const result = normalizeSpec({ infographic: 'cards', items: [{ label: 'a', value: '1', color: 'url(javascript:alert(1))' }] })
    expect(result.ok && result.spec.infographic === 'cards' && result.spec.items[0]?.color).toBeUndefined()
  })

  it('marks specs without drawable content as not renderable', () => {
    expect(normalizeSpec({ infographic: 'bar', categories: [], series: [] })).toMatchObject({ ok: true, renderable: false })
    expect(normalizeSpec({ infographic: 'donut', data: [{ label: 'a', value: 0 }] })).toMatchObject({ ok: true, renderable: false })
  })
})

describe('renderSvg', () => {
  it.each(examples)('%s renders well-formed SVG in every theme', name => {
    const result = normalizeSpec(JSON.parse(readFileSync(join(examplesDir, name), 'utf8')))
    expect(result).toMatchObject({ ok: true, renderable: true })
    if (!result.ok) return
    for (const theme of ['auto', 'light', 'dark'] as const) {
      const { svg, width, height } = renderSvg(result.spec, { theme, standalone: true, idPrefix: 'test' })
      expect(wellFormed(svg), `${name} ${theme}`).toBe(true)
      expect(width).toBe(680)
      expect(height).toBeGreaterThan(60)
      expect(svg).not.toMatch(/<script|javascript:|onload=|onerror=/i)
    }
  })

  it('escapes every piece of model text', () => {
    const svg = renderInfographic({
      infographic: 'flow',
      title: '<img src=x onerror=alert(1)> & "q"',
      nodes: [{ label: '</text><script>alert(1)</script>', sub: '"><svg onload=1>' }, { label: 'b' }],
    })
    expect(wellFormed(svg)).toBe(true)
    expect(svg).not.toContain('<script')
    expect(svg).not.toContain('<img')
    expect(svg).toContain('&lt;img')
  })

  it('wraps long card text and grows the card instead of truncating', () => {
    const note = '每人先接受机器人主持的访谈，再接受人类主持的访谈（交叉设计）全程录音转写后逐轮编码'
    const svg = renderInfographic({ infographic: 'cards', items: [{ label: '参与者', value: '15', note }, { label: 'b', value: '2' }] })
    expect(svg).not.toContain('…')
    const heights = [...svg.matchAll(/<rect class="ig-card" [^>]*height="([\d.]+)"/g)].map(m => Number(m[1]))
    expect(heights).toHaveLength(2)
    expect(heights[0]).toBeGreaterThan(104)
    expect(heights[1]).toBe(heights[0])
  })

  it('scopes every css rule to the instance prefix', () => {
    const svg = renderInfographic({ infographic: 'cards', items: [{ label: 'a', value: '1', color: 'teal' }] }, { idPrefix: 'scope-1' })
    const css = /<style>(.*?)<\/style>/s.exec(svg)?.[1] ?? ''
    const { document } = new JSDOM(`<style>${css}</style>`).window
    const selectors: string[] = []
    const walk = (rules: CSSRuleList): void => {
      for (const rule of Array.from(rules)) {
        if ('selectorText' in rule) selectors.push(...(rule as CSSStyleRule).selectorText.split(',').map(entry => entry.trim()))
        else if ('cssRules' in rule) walk((rule as CSSGroupingRule).cssRules)
      }
    }
    walk((document.querySelector('style') as HTMLStyleElement).sheet?.cssRules as CSSRuleList)
    expect(selectors.length).toBeGreaterThan(10)
    expect(selectors.filter(selector => !selector.startsWith('.scope-1'))).toEqual([])
  })

  it('gives two renders different ids so inline svgs never collide', () => {
    const spec = { infographic: 'flow', nodes: [{ label: 'a' }, { label: 'b' }] }
    expect(renderInfographic(spec, { idPrefix: 'one' })).toContain('one-arrow')
    expect(renderInfographic(spec, { idPrefix: 'two' })).toContain('two-arrow')
  })

  it('bakes a single theme for export', () => {
    const spec = { infographic: 'donut', data: [{ label: 'a', value: 1 }] }
    expect(renderInfographic(spec, { theme: 'light' })).not.toContain('prefers-color-scheme')
    expect(renderInfographic(spec, { theme: 'auto' })).toContain('prefers-color-scheme')
    expect(renderInfographic(spec, { theme: 'dark' })).not.toContain('data-theme')
  })

  it('draws a back edge on a downward flow without crashing', () => {
    const svg = renderInfographic({
      infographic: 'flow',
      nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }],
      edges: [['a', 'b'], ['b', 'c'], { from: 'c', to: 'a', dashed: true }, ['b', 'a']],
    })
    expect(wellFormed(svg)).toBe(true)
    expect((svg.match(/class="ig-edge/g) ?? []).length).toBe(4)
  })

  it('handles a single node, a self loop and empty labels', () => {
    expect(() => renderInfographic({ infographic: 'flow', nodes: [{ label: 'only' }], edges: [['only', 'only']] })).not.toThrow()
    expect(() => renderInfographic({ infographic: 'bar', categories: ['a'], series: [{ name: '', data: [null] }, { name: 'x', data: [-3] }] })).not.toThrow()
  })

  it('supports negative values and stacked bars', () => {
    const svg = renderInfographic({ infographic: 'bar', stacked: true, categories: ['a', 'b'], series: [{ name: 'p', data: [3, -2] }, { name: 'q', data: [4, 1] }] })
    expect(wellFormed(svg)).toBe(true)
  })
})

describe('readFence', () => {
  const full = '{"infographic":"bar","categories":["a","b"],"series":[{"name":"s","data":[1,2]}]}'

  it('reads a complete fence', () => {
    expect(readFence(full)).toMatchObject({ status: 'ok', complete: true })
  })

  it('renders a partial fence while streaming and is pending before anything is drawable', () => {
    expect(readFence(full.slice(0, -3), { streaming: true }).status).toBe('ok')
    expect(readFence('{"infographic":"ba', { streaming: true }).status).toBe('pending')
    expect(readFence('{"infographic":"bar","title":"x"', { streaming: true }).status).toBe('pending')
  })

  it('reports errors with a code once the fence has settled', () => {
    expect(readFence('not json')).toMatchObject({ status: 'error', code: 'json' })
    expect(readFence('{"infographic":"pie"}')).toMatchObject({ status: 'error', code: 'kind' })
    expect(readFence('{"infographic":"flow","nodes":[]}')).toMatchObject({ status: 'error', code: 'empty' })
  })

  it('recognises an infographic by content', () => {
    expect(looksLikeInfographic(' {"infographic":"flow"}')).toBe(true)
    expect(looksLikeInfographic('{"title":"x"}')).toBe(false)
    expect(looksLikeInfographic('print("hi")')).toBe(false)
  })
})
