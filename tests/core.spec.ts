import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'
import { looksLikeInfographic, normalizeSpec, parseLoose, readFence, renderInfographic, renderSvg } from '../src/core/index.ts'
import { measure } from '../src/core/text.ts'

const examplesDir = join(import.meta.dirname, '..', 'examples')
const examples = readdirSync(examplesDir).filter(name => name.endsWith('.json')).sort()
const parser = new (new JSDOM('').window.DOMParser)()

function wellFormed(svg: string): boolean {
  return parser.parseFromString(svg, 'image/svg+xml').querySelector('parsererror') === null
}

interface Box {
  left: number
  right: number
  top: number
  bottom: number
}

/** Wrapper <g> elements carry the offset and any downscale, so text and shapes only compare once both are applied. */
function transformOf(element: Element): { tx: number; ty: number; scale: number } {
  let tx = 0
  let ty = 0
  let scale = 1
  for (let node: Element | null = element; node; node = node.parentElement) {
    const transform = node.getAttribute?.('transform')
    if (transform === null || transform === undefined) continue
    const translate = /translate\(\s*([-\d.]+)[ ,]+([-\d.]+)\s*\)/.exec(transform)
    const zoom = /scale\(\s*([-\d.]+)\s*\)/.exec(transform)
    if (translate !== null) {
      tx += Number(translate[1]) * scale
      ty += Number(translate[2]) * scale
    }
    if (zoom !== null) scale *= Number(zoom[1])
  }
  return { tx, ty, scale }
}

/** Node shapes and every small text run, in absolute coordinates. */
function rectsOf(svg: string): { boxes: Box[]; labels: (Box & { text: string })[] } {
  const doc = parser.parseFromString(svg, 'image/svg+xml')
  const boxes: Box[] = []
  for (const group of doc.querySelectorAll('g[class^="ig-r-"]')) {
    const shape = group.querySelector('rect, polygon')
    if (shape === null) continue
    const { tx, ty, scale } = transformOf(shape)
    let left: number
    let top: number
    let right: number
    let bottom: number
    if (shape.tagName.toLowerCase() === 'rect') {
      left = Number(shape.getAttribute('x'))
      top = Number(shape.getAttribute('y'))
      right = left + Number(shape.getAttribute('width'))
      bottom = top + Number(shape.getAttribute('height'))
    } else {
      const points = (shape.getAttribute('points') ?? '').trim().split(/\s+/).map(point => point.split(',').map(Number))
      const xs = points.map(point => point[0] as number)
      const ys = points.map(point => point[1] as number)
      left = Math.min(...xs)
      right = Math.max(...xs)
      top = Math.min(...ys)
      bottom = Math.max(...ys)
    }
    boxes.push({ left: left * scale + tx, right: right * scale + tx, top: top * scale + ty, bottom: bottom * scale + ty })
  }
  const labels: (Box & { text: string })[] = []
  for (const text of doc.querySelectorAll('text')) {
    if (text.closest('g[class^="ig-r-"]') !== null) continue
    const size = Number(text.getAttribute('font-size') ?? 12)
    if (size > 13) continue
    const { tx, ty, scale } = transformOf(text)
    const width = measure(text.textContent ?? '', size, Number(text.getAttribute('font-weight') ?? 400)) * scale
    const anchor = text.getAttribute('text-anchor') ?? 'start'
    const x = Number(text.getAttribute('x')) * scale + tx
    const y = Number(text.getAttribute('y')) * scale + ty
    const height = size * 1.16 * scale
    const left = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x
    labels.push({ left, right: left + width, top: y - height / 2, bottom: y + height / 2, text: text.textContent ?? '' })
  }
  return { boxes, labels }
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

  it('keeps long flow-node text whole instead of ellipsizing it', () => {
    const leaf = (id: string, label: string, sub: string) => ({ id, label, sub })
    const svg = renderInfographic({
      infographic: 'flow',
      direction: 'down',
      nodes: [
        { id: 'r', label: 'LLM 实时检测', sub: '叠加轻量语义分类器给的对话上下文做判断', shape: 'diamond' },
        leaf('a', 'Treatment 1：确认探针', 'confirmation probe'),
        leaf('b', 'Treatment 2：细化 / 相关性探针', 'elaboration & relevance probe'),
        leaf('c', '相关但不具体 → 细化探针', 'You mentioned [concept]. Could you tell me more?'),
        leaf('d', '不相关 → 相关性探针', "I didn't understand how [concept] relates to the question."),
        leaf('e', '具体且相关 → 不追问', '直接进下一题'),
      ],
      edges: [['r', 'a'], ['r', 'b'], ['b', 'c'], ['b', 'd'], ['b', 'e']].map(([from, to]) => ({ from: from as string, to: to as string })),
    } as never)
    expect(svg).toContain('<svg')
    expect(svg).toContain('confirmation probe')
    expect(svg).not.toContain('…')
  })

  it('keeps left-to-right edge labels whole by widening the gap between layers', () => {
    const svg = renderInfographic({
      infographic: 'flow',
      direction: 'right',
      nodes: [{ id: 'a', label: '你' }, { id: 'b', label: '白名单' }, { id: 'c', label: 'subagent(prompt, model, ...)' }],
      edges: [{ from: 'a', to: 'b', label: '暴露成可选字段（enum）' }, { from: 'b', to: 'c', label: '本次调用临时决定' }],
    } as never)
    expect(svg).toContain('暴露成可选字段（enum）')
    expect(svg).toContain('本次调用临时决定')
    expect(svg).not.toContain('…')
  })

  it('turns an author-typed <br> into a real line break', () => {
    const svg = renderInfographic({
      infographic: 'bar',
      title: '年阅读量',
      unit: '本/年',
      categories: ['普通大众<br>金融资产<1亿韩元', '超级富豪<br>金融资产≥100亿韩元'],
      series: [{ name: '2024', data: [6, 20] }],
    } as never)
    expect(svg).not.toContain('<br')
    expect(svg).not.toContain('&lt;br')
    // The halves land on their own lines; the angle bracket that is real content stays escaped.
    expect(svg).toContain('>普通大众</text>')
    expect(svg).toContain('>金融资产&lt;1亿韩元</text>')
  })

  it('keeps edge labels off each other and off the node boxes', () => {
    // Two arrows leave one diamond for the same layer, so both labels want the same midpoint.
    const svg = renderInfographic({
      infographic: 'flow',
      direction: 'down',
      nodes: [
        { id: 'q1', label: '存在互斥的状态吗？', sub: '“在做”和“做完了”不能同时为真', shape: 'diamond' },
        { id: 'q2', label: '有明确事件推动转移吗？', sub: '提交、确认、超时、取消', shape: 'diamond' },
        { id: 'yes', label: '值得显式化', sub: '写下来、给状态起名、定转移规则', shape: 'pill' },
        { id: 'no', label: '继续隐式，够用', sub: '小、单人、可逆、代价低', shape: 'pill' },
      ],
      edges: [
        { from: 'q1', to: 'q2', label: '是' },
        { from: 'q1', to: 'no', label: '否' },
        { from: 'q2', to: 'yes', label: '是' },
        { from: 'q2', to: 'no', label: '否' },
      ],
    } as never)
    const { boxes, labels } = rectsOf(svg)
    expect(labels.map(entry => entry.text)).toEqual(['是', '否', '是', '否'])
    const collide = (a: Box, b: Box): boolean => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
    for (const [index, label] of labels.entries()) {
      for (const other of labels.slice(index + 1)) expect(`${label.text}×${other.text}: ${collide(label, other)}`).toBe(`${label.text}×${other.text}: false`)
      for (const box of boxes) expect(`${label.text}: ${collide(label, box)}`).toBe(`${label.text}: false`)
    }
  })

  it('never starts a wrapped line with closing punctuation', async () => {
    const { wrap } = await import('../src/core/text.ts')
    for (const width of [60, 80, 100, 120]) {
      for (const line of wrap('Treatment 1：确认探针，细化；相关性探针。是吗？', width, 14, 500, 9)) expect(line).not.toMatch(/^[：，；。？]/u)
    }
  })

  it('wraps long card text and grows the card instead of truncating', () => {
    const note = '每人先接受机器人主持的访谈，再接受人类主持的访谈（交叉设计），全程录音转写后逐轮编码，并由两位研究者独立复核全部编码结果；出现分歧时通过讨论达成一致，必要时请第三位研究者仲裁'
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
