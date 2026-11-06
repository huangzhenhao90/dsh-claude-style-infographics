import type { CardsSpec } from '../types.ts'
import { esc, measure, wrap } from '../text.ts'
import { CONTENT_WIDTH, MARGIN_X, rect, textBlock, type Piece } from './common.ts'

const GAP = 12

function deltaClass(delta: string): string {
  if (/^[-−–]/.test(delta)) return 'ig-neg'
  if (/^\+/.test(delta)) return 'ig-pos'
  return 'ig-t2'
}

interface Layout {
  label: string[]
  value: string[]
  delta: string[]
  note: string[]
  /** Baseline-centre y offsets (relative to the card top) of the first line of each block. */
  labelY: number
  valueY: number
  deltaY: number
  noteY: number
  /** Minimum card height that fits every line. */
  height: number
}

/** Wrap every text block of a card and work out where each one sits. Single-line cards keep the original geometry. */
function layoutCard(item: CardsSpec['items'][number], inner: number): Layout {
  const label = wrap(item.label, inner, 12, 400, 2)
  const value = wrap(item.value, inner, 26, 500, 2)
  const delta = item.delta === undefined ? [] : wrap(item.delta, inner, 12, 500, 2)
  const note = item.note === undefined ? [] : wrap(item.note, inner, 11, 400, 4)
  const labelY = 20
  const valueY = labelY + 16 * (label.length - 1) + 27
  let last = valueY + 32 * (value.length - 1)
  const deltaY = last + 23
  if (delta.length > 0) last = deltaY + 16 * (delta.length - 1)
  const noteY = last + (delta.length > 0 ? 20 : 23)
  if (note.length > 0) last = noteY + 15 * (note.length - 1)
  return { label, value, delta, note, labelY, valueY, deltaY, noteY, height: last + (note.length > 0 ? 14 : 16) }
}

/** Width a card would like if nothing were competing for space (notes are capped so they wrap instead of hogging a row). */
function desiredWidth(item: CardsSpec['items'][number]): number {
  const lines = [
    measure(item.label, 12),
    measure(item.value, 26, 500),
    item.delta === undefined ? 0 : measure(item.delta, 12, 500),
    item.note === undefined ? 0 : Math.min(measure(item.note, 11), 150),
  ]
  return Math.max(...lines) + 28
}

/** Share `available` px between the cards of one row in proportion to what they want, never below `floor`. */
function rowWidths(wants: readonly number[], available: number, floor: number): number[] {
  const widths = wants.map(() => 0)
  let open = wants.map((_, index) => index)
  let room = available
  while (open.length > 0) {
    const total = open.reduce((sum, index) => sum + (wants[index] as number), 0)
    const clamped = open.filter(index => (room * (wants[index] as number)) / total < floor)
    if (clamped.length === 0) {
      for (const index of open) widths[index] = (room * (wants[index] as number)) / total
      break
    }
    for (const index of clamped) widths[index] = floor
    room -= floor * clamped.length
    open = open.filter(index => !clamped.includes(index))
  }
  return widths
}

export function renderCards(spec: CardsSpec, top: number, _prefix: string): Piece {
  const count = spec.items.length
  const columns = count <= 4 ? count : count <= 6 ? 3 : 4
  const equal = (CONTENT_WIDTH - GAP * (columns - 1)) / columns
  const minHeight = spec.items.some(item => item.note !== undefined) ? 104 : 86
  const widths: number[] = []
  for (let start = 0; start < count; start += columns) {
    const items = spec.items.slice(start, start + columns)
    const available = CONTENT_WIDTH - GAP * (items.length - 1)
    widths.push(...rowWidths(items.map(desiredWidth), available, Math.min(equal, 120) * 0.85))
  }
  const layouts = spec.items.map((item, index) => layoutCard(item, (widths[index] as number) - 28))
  const rowHeights: number[] = []
  layouts.forEach((layout, index) => {
    const row = Math.floor(index / columns)
    rowHeights[row] = Math.max(rowHeights[row] ?? minHeight, layout.height)
  })
  const rowTops: number[] = []
  let cursor = top
  rowHeights.forEach((height, row) => {
    rowTops[row] = cursor
    cursor += height + GAP
  })
  let body = ''
  spec.items.forEach((item, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    const layout = layouts[index] as Layout
    const width = widths[index] as number
    let x = MARGIN_X
    for (let c = 0; c < column; c++) x += (widths[index - column + c] as number) + GAP
    const y = rowTops[row] as number
    const height = rowHeights[row] as number
    const colored = item.color !== undefined
    body += `<g${colored ? ` class="ig-r-${item.color}"` : ''}><title>${esc(`${item.label}: ${item.value}${item.delta === undefined ? '' : ` (${item.delta})`}${item.note === undefined ? '' : ` — ${item.note}`}`)}</title>`
    body += rect(x, y, width, height, 8, colored ? 'ig-card-r' : 'ig-card')
    body += textBlock(x + 14, y + layout.labelY + 8 * (layout.label.length - 1), layout.label, 16, { size: 12, cls: colored ? 'ig-sub-r' : 'ig-t2' })
    body += textBlock(x + 14, y + layout.valueY + 16 * (layout.value.length - 1), layout.value, 32, { size: 26, weight: 500, cls: colored ? 'ig-title-r' : 'ig-t1' })
    if (item.delta !== undefined) body += textBlock(x + 14, y + layout.deltaY + 8 * (layout.delta.length - 1), layout.delta, 16, { size: 12, weight: 500, cls: deltaClass(item.delta) })
    if (item.note !== undefined) body += textBlock(x + 14, y + layout.noteY + 7.5 * (layout.note.length - 1), layout.note, 15, { size: 11, cls: colored ? 'ig-sub-r' : 'ig-t3' })
    body += '</g>'
  })
  const bottom = (rowTops[rowTops.length - 1] as number) + (rowHeights[rowHeights.length - 1] as number)
  return { body, bottom }
}
