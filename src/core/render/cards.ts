import type { CardsSpec } from '../types.ts'
import { esc, ellipsize } from '../text.ts'
import { CONTENT_WIDTH, MARGIN_X, rect, txt, type Piece } from './common.ts'

const GAP = 12

function deltaClass(delta: string): string {
  if (/^[-−–]/.test(delta)) return 'ig-neg'
  if (/^\+/.test(delta)) return 'ig-pos'
  return 'ig-t2'
}

export function renderCards(spec: CardsSpec, top: number, _prefix: string): Piece {
  const count = spec.items.length
  const columns = count <= 4 ? count : count <= 6 ? 3 : 4
  const rows = Math.ceil(count / columns)
  const width = (CONTENT_WIDTH - GAP * (columns - 1)) / columns
  const rowHeight = spec.items.some(item => item.note !== undefined) ? 104 : 86
  let body = ''
  spec.items.forEach((item, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    const x = MARGIN_X + column * (width + GAP)
    const y = top + row * (rowHeight + GAP)
    const colored = item.color !== undefined
    const inner = width - 28
    body += `<g${colored ? ` class="ig-r-${item.color}"` : ''}><title>${esc(`${item.label}: ${item.value}${item.delta === undefined ? '' : ` (${item.delta})`}`)}</title>`
    body += rect(x, y, width, rowHeight, 8, colored ? 'ig-card-r' : 'ig-card')
    body += txt(x + 14, y + 20, ellipsize(item.label, inner, 12), { size: 12, cls: colored ? 'ig-sub-r' : 'ig-t2' })
    body += txt(x + 14, y + 47, ellipsize(item.value, inner, 26, 500), { size: 26, weight: 500, cls: colored ? 'ig-title-r' : 'ig-t1' })
    if (item.delta !== undefined) body += txt(x + 14, y + 70, ellipsize(item.delta, inner, 12, 500), { size: 12, weight: 500, cls: deltaClass(item.delta) })
    if (item.note !== undefined) body += txt(x + 14, y + (item.delta === undefined ? 70 : 90), ellipsize(item.note, inner, 11), { size: 11, cls: colored ? 'ig-sub-r' : 'ig-t3' })
    body += '</g>'
  })
  return { body, bottom: top + rows * rowHeight + (rows - 1) * GAP }
}
