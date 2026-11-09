import { DEFAULT_STYLE, PALETTES, STYLES, isStyle, type StyleName } from './palettes.ts'
import { LINE_BREAK } from './text.ts'
import { isRamp } from './theme.ts'
import {
  KINDS,
  type BarSpec,
  type CardItem,
  type CardsSpec,
  type DonutSlice,
  type DonutSpec,
  type FlowEdge,
  type FlowNode,
  type FlowSpec,
  type InfographicSpec,
  type Kind,
  type Layer,
  type LayersSpec,
  type LineSpec,
  type NormalizeResult,
  type Ramp,
  type Series,
  type TimelineItem,
  type TimelineSpec,
} from './types.ts'

export const LIMITS = {
  text: 160,
  nodes: 40,
  edges: 80,
  categories: 24,
  series: 6,
  slices: 12,
  cards: 12,
  timeline: 16,
  layers: 8,
  layerItems: 8,
} as const

type Obj = Record<string, unknown>

function isObj(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function pick(source: Obj, ...keys: string[]): unknown {
  for (const key of keys) if (source[key] !== undefined && source[key] !== null) return source[key]
  return undefined
}

/** An author's `<br>` (or a literal newline) is a line break; everything else collapses to one space. */
const LINE_BREAK_TAG = /<br\s*\/?>/gi

function text(value: unknown, max: number = LIMITS.text): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) value = String(value)
  if (typeof value !== 'string') return undefined
  const clean = value
    .replace(LINE_BREAK_TAG, LINE_BREAK)
    .replace(/\r\n?/g, LINE_BREAK)
    .split(LINE_BREAK)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(line => line !== '')
    .join(LINE_BREAK)
  if (clean === '') return undefined
  return [...clean].length > max ? `${[...clean].slice(0, max - 1).join('')}…` : clean
}

function num(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const match = /^\s*[$¥€£]?\s*(-?[\d,]*\.?\d+)/.exec(value)
    if (match !== null) {
      const parsed = Number((match[1] as string).replace(/,/g, ''))
      return Number.isFinite(parsed) ? parsed : null
    }
  }
  return null
}

function ramp(value: unknown, fallback: Ramp): Ramp {
  return isRamp(value) ? value : fallback
}

function list(value: unknown, max: number, label: string, warnings: string[]): unknown[] {
  if (!Array.isArray(value)) return []
  if (value.length > max) warnings.push(`${label}: only the first ${max} of ${value.length} are shown`)
  return value.slice(0, max)
}

/** The style a spec asks for, without validating it — used to pick the auto-colour order. */
function styleOf(source: Obj): StyleName {
  const raw = pick(source, 'style', 'palette')
  return isStyle(raw) ? raw : DEFAULT_STYLE
}

/** Ramp names are resolved to real colours at render time, so each style cycles its own order. */
function cycleOf(source: Obj): readonly Ramp[] {
  return PALETTES[styleOf(source)].cycle
}

function base(source: Obj, warnings: string[]): { title?: string; subtitle?: string; note?: string; style?: StyleName } {
  const result: { title?: string; subtitle?: string; note?: string; style?: StyleName } = {}
  const title = text(pick(source, 'title', 'name'), 80)
  const subtitle = text(pick(source, 'subtitle', 'description'), 120)
  const note = text(pick(source, 'note', 'caption', 'source'), 160)
  if (title !== undefined) result.title = title
  if (subtitle !== undefined) result.subtitle = subtitle
  if (note !== undefined) result.note = note
  const rawStyle = pick(source, 'style', 'palette')
  if (rawStyle !== undefined && rawStyle !== null) {
    if (isStyle(rawStyle)) result.style = rawStyle
    else warnings.push(`style: "${String(rawStyle)}" is not one of ${STYLES.join(', ')} — using ${DEFAULT_STYLE}`)
  }
  return result
}

export interface NormalizeOptions {
  /** The spec may still be arriving: do not invent defaults for keys that have not streamed in. */
  streaming?: boolean
  /**
   * The style to draw in, when the caller has already resolved it — e.g. the viewer picked one.
   * It decides the auto-colour order, so it has to be known here rather than at render time.
   */
  style?: StyleName
}

function flow(source: Obj, warnings: string[], streaming: boolean): FlowSpec {
  const nodes: FlowNode[] = []
  const used = new Set<string>()
  for (const entry of list(pick(source, 'nodes', 'steps'), LIMITS.nodes, 'nodes', warnings)) {
    const item = isObj(entry) ? entry : { label: entry }
    const label = text(pick(item, 'label', 'name', 'title', 'text'), 80)
    if (label === undefined) continue
    let id = text(pick(item, 'id', 'key'), 40) ?? label
    for (let suffix = 2; used.has(id); suffix += 1) id = `${text(pick(item, 'id', 'key'), 40) ?? label}#${suffix}`
    used.add(id)
    const rawShape = pick(item, 'shape', 'kind')
    const shape = rawShape === 'pill' || rawShape === 'diamond' || rawShape === 'box' ? rawShape : rawShape === 'decision' ? 'diamond' : rawShape === 'start' || rawShape === 'end' ? 'pill' : 'box'
    const node: FlowNode = {
      id,
      label,
      color: ramp(pick(item, 'color', 'tone', 'ramp'), shape === 'pill' ? 'purple' : shape === 'diamond' ? 'amber' : 'teal'),
      shape,
    }
    const sub = text(pick(item, 'sub', 'desc', 'description', 'detail'), 100)
    if (sub !== undefined) node.sub = sub
    nodes.push(node)
  }
  const byLabel = new Map<string, string>()
  for (const node of nodes) if (!byLabel.has(node.label)) byLabel.set(node.label, node.id)
  const resolve = (ref: unknown): string | undefined => {
    if (typeof ref === 'number' && Number.isInteger(ref)) return nodes[ref]?.id
    const key = text(ref, 80)
    if (key === undefined) return undefined
    return used.has(key) ? key : byLabel.get(key)
  }
  const edges: FlowEdge[] = []
  const seen = new Set<string>()
  const rawEdges = pick(source, 'edges', 'links', 'connections')
  for (const entry of list(rawEdges, LIMITS.edges, 'edges', warnings)) {
    let from: unknown
    let to: unknown
    let label: unknown
    let dashed = false
    if (Array.isArray(entry)) {
      ;[from, to, label] = entry
    } else if (isObj(entry)) {
      from = pick(entry, 'from', 'source', 'src')
      to = pick(entry, 'to', 'target', 'dst')
      label = pick(entry, 'label', 'text')
      dashed = entry.dashed === true || entry.style === 'dashed'
    } else if (typeof entry === 'string') {
      const parts = /^(.+?)\s*(?:->|=>|→|>)\s*(.+)$/.exec(entry)
      if (parts !== null) [, from, to] = parts
    }
    const fromId = resolve(from)
    const toId = resolve(to)
    if (fromId === undefined || toId === undefined || fromId === toId) continue
    const key = `${fromId}\u0000${toId}`
    if (seen.has(key)) continue
    seen.add(key)
    const edge: FlowEdge = { from: fromId, to: toId, dashed }
    const edgeLabel = text(label, 40)
    if (edgeLabel !== undefined) edge.label = edgeLabel
    edges.push(edge)
  }
  if (rawEdges === undefined && !streaming) {
    for (let index = 1; index < nodes.length; index += 1) {
      edges.push({ from: (nodes[index - 1] as FlowNode).id, to: (nodes[index] as FlowNode).id, dashed: false })
    }
  }
  return {
    infographic: 'flow',
    ...base(source, warnings),
    direction: source.direction === 'right' || source.direction === 'horizontal' || source.direction === 'LR' ? 'right' : 'down',
    nodes,
    edges,
  }
}

function seriesList(source: Obj, warnings: string[]): { categories: string[]; series: Series[] } {
  const cycle = cycleOf(source)
  let categories: string[] = []
  const rawCategories = pick(source, 'categories', 'labels', 'x')
  if (Array.isArray(rawCategories)) {
    categories = list(rawCategories, LIMITS.categories, 'categories', warnings).map(entry => text(entry, 24) ?? '')
  }
  const series: Series[] = []
  const rawSeries = pick(source, 'series')
  if (Array.isArray(rawSeries)) {
    for (const [index, entry] of list(rawSeries, LIMITS.series, 'series', warnings).entries()) {
      if (!isObj(entry)) continue
      const values = Array.isArray(entry.data ?? entry.values) ? (entry.data ?? entry.values) as unknown[] : []
      series.push({
        name: text(pick(entry, 'name', 'label', 'title'), 40) ?? `Series ${index + 1}`,
        data: values.slice(0, LIMITS.categories).map(num),
        color: ramp(pick(entry, 'color', 'tone', 'ramp'), cycle[index % cycle.length] as Ramp),
      })
    }
  } else if (Array.isArray(source.data)) {
    const labels: string[] = []
    const values: (number | null)[] = []
    for (const entry of list(source.data, LIMITS.categories, 'data', warnings)) {
      if (isObj(entry)) {
        labels.push(text(pick(entry, 'label', 'name', 'category', 'x'), 24) ?? '')
        values.push(num(pick(entry, 'value', 'y')))
      } else if (Array.isArray(entry)) {
        labels.push(text(entry[0], 24) ?? '')
        values.push(num(entry[1]))
      } else {
        values.push(num(entry))
        labels.push('')
      }
    }
    if (categories.length === 0) categories = labels
    series.push({
      name: text(pick(source, 'seriesName', 'unit'), 40) ?? '',
      data: values,
      color: ramp(pick(source, 'color'), 'purple'),
    })
  }
  const count = Math.max(categories.length, ...series.map(entry => entry.data.length), 0)
  if (categories.length < count) categories = [...categories, ...Array.from({ length: count - categories.length }, (_, index) => String(categories.length + index + 1))]
  return { categories: categories.slice(0, LIMITS.categories), series }
}

function bar(source: Obj, warnings: string[]): BarSpec {
  const spec: BarSpec = {
    infographic: 'bar',
    ...base(source, warnings),
    ...seriesList(source, warnings),
    horizontal: source.horizontal === true || source.orientation === 'horizontal',
    stacked: source.stacked === true,
  }
  const unit = text(source.unit, 8)
  if (unit !== undefined) spec.unit = unit
  return spec
}

function line(source: Obj, warnings: string[]): LineSpec {
  const spec: LineSpec = {
    infographic: 'line',
    ...base(source, warnings),
    ...seriesList(source, warnings),
    area: source.area === true,
  }
  const unit = text(source.unit, 8)
  if (unit !== undefined) spec.unit = unit
  return spec
}

function donut(source: Obj, warnings: string[]): DonutSpec {
  const cycle = cycleOf(source)
  const data: DonutSlice[] = []
  for (const [index, entry] of list(pick(source, 'data', 'slices', 'items'), LIMITS.slices, 'slices', warnings).entries()) {
    if (!isObj(entry)) continue
    const value = num(pick(entry, 'value', 'v', 'amount'))
    const label = text(pick(entry, 'label', 'name', 'title'), 40)
    if (value === null || value < 0 || label === undefined) continue
    data.push({ label, value, color: ramp(pick(entry, 'color', 'tone', 'ramp'), cycle[index % cycle.length] as Ramp) })
  }
  const spec: DonutSpec = { infographic: 'donut', ...base(source, warnings), data }
  const rawCenter = source.center
  if (isObj(rawCenter)) {
    const value = text(rawCenter.value, 14)
    if (value !== undefined) {
      spec.center = { value }
      const label = text(rawCenter.label, 24)
      if (label !== undefined) spec.center.label = label
    }
  }
  const unit = text(source.unit, 8)
  if (unit !== undefined) spec.unit = unit
  return spec
}

function cards(source: Obj, warnings: string[]): CardsSpec {
  const items: CardItem[] = []
  for (const entry of list(pick(source, 'items', 'cards', 'metrics'), LIMITS.cards, 'cards', warnings)) {
    if (!isObj(entry)) continue
    const label = text(pick(entry, 'label', 'name', 'title'), 60)
    const value = text(pick(entry, 'value', 'v'), 24)
    if (label === undefined || value === undefined) continue
    const item: CardItem = { label, value }
    const delta = text(entry.delta, 30)
    const note = text(pick(entry, 'note', 'desc', 'sub'), 120)
    if (delta !== undefined) item.delta = delta
    if (note !== undefined) item.note = note
    const color = pick(entry, 'color', 'tone', 'ramp')
    if (isRamp(color)) item.color = color
    items.push(item)
  }
  return { infographic: 'cards', ...base(source, warnings), items }
}

function timeline(source: Obj, warnings: string[]): TimelineSpec {
  const items: TimelineItem[] = []
  for (const entry of list(pick(source, 'items', 'events', 'steps'), LIMITS.timeline, 'timeline items', warnings)) {
    if (!isObj(entry)) continue
    const title = text(pick(entry, 'title', 'label', 'name'), 70)
    if (title === undefined) continue
    const item: TimelineItem = { title, color: ramp(pick(entry, 'color', 'tone', 'ramp'), 'purple') }
    const desc = text(pick(entry, 'desc', 'description', 'sub', 'detail'), 200)
    const time = text(pick(entry, 'time', 'date', 'when'), 20)
    if (desc !== undefined) item.desc = desc
    if (time !== undefined) item.time = time
    items.push(item)
  }
  return { infographic: 'timeline', ...base(source, warnings), items }
}

function layers(source: Obj, warnings: string[]): LayersSpec {
  const cycle = cycleOf(source)
  const result: Layer[] = []
  for (const [index, entry] of list(pick(source, 'layers', 'tiers'), LIMITS.layers, 'layers', warnings).entries()) {
    if (!isObj(entry)) continue
    const label = text(pick(entry, 'label', 'name', 'title'), 40)
    if (label === undefined) continue
    const items = list(entry.items, LIMITS.layerItems, `layer "${label}" items`, warnings).flatMap((raw): Layer['items'] => {
      const item = isObj(raw) ? raw : { label: raw }
      const itemLabel = text(pick(item, 'label', 'name', 'title'), 40)
      if (itemLabel === undefined) return []
      const sub = text(pick(item, 'sub', 'desc', 'description'), 60)
      return [sub === undefined ? { label: itemLabel } : { label: itemLabel, sub }]
    })
    result.push({ label, color: ramp(pick(entry, 'color', 'tone', 'ramp'), cycle[index % cycle.length] as Ramp), items })
  }
  return { infographic: 'layers', ...base(source, warnings), layers: result, arrows: source.arrows === true }
}

function hasData(series: Series[]): boolean {
  return series.some(entry => entry.data.some(value => value !== null))
}

/** Validate and complete a parsed spec. Unknown fields are ignored; bad entries are dropped with a warning. */
export function normalizeSpec(raw: unknown, options: NormalizeOptions = {}): NormalizeResult {
  if (!isObj(raw)) return { ok: false, error: 'The spec must be a JSON object.', code: 'json' }
  const kindValue = pick(raw, 'infographic', 'type', 'kind')
  if (typeof kindValue !== 'string' || !(KINDS as readonly string[]).includes(kindValue)) {
    return { ok: false, error: `"infographic" must be one of: ${KINDS.join(', ')}.`, code: 'kind' }
  }
  const kind = kindValue as Kind
  const warnings: string[] = []
  const streaming = options.streaming === true
  // The style decides the auto-colour order, so it has to be known before the kind builders run.
  const source: Obj = options.style === undefined ? raw : { ...raw, style: options.style }
  let spec: InfographicSpec
  let renderable: boolean
  switch (kind) {
    case 'flow': {
      const value = flow(source, warnings, streaming)
      spec = value
      renderable = value.nodes.length > 0
      break
    }
    case 'bar': {
      const value = bar(source, warnings)
      spec = value
      renderable = value.categories.length > 0 && hasData(value.series)
      break
    }
    case 'line': {
      const value = line(source, warnings)
      spec = value
      renderable = value.categories.length > 0 && hasData(value.series)
      break
    }
    case 'donut': {
      const value = donut(source, warnings)
      spec = value
      renderable = value.data.some(slice => slice.value > 0)
      break
    }
    case 'cards': {
      const value = cards(source, warnings)
      spec = value
      renderable = value.items.length > 0
      break
    }
    case 'timeline': {
      const value = timeline(source, warnings)
      spec = value
      renderable = value.items.length > 0
      break
    }
    case 'layers': {
      const value = layers(source, warnings)
      spec = value
      renderable = value.layers.length > 0
      break
    }
  }
  return { ok: true, spec, warnings, renderable }
}
