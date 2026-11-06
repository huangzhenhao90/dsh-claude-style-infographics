import type { LayersSpec } from '../types.ts'
import { esc, wrap } from '../text.ts'
import { CONTENT_WIDTH, MARGIN_X, rect, txt, type Piece } from './common.ts'

const PAD = 14
const GAP = 10

export function renderLayers(spec: LayersSpec, top: number, prefix: string): Piece {
  let y = top
  let body = ''
  const arrowGap = spec.arrows ? 30 : 14
  spec.layers.forEach((layer, layerIndex) => {
    const count = Math.max(1, layer.items.length)
    const perRow = Math.min(count, 4)
    const rows = Math.ceil(count / perRow)
    const itemWidth = (CONTENT_WIDTH - PAD * 2 - GAP * (perRow - 1)) / perRow
    const innerWidth = itemWidth - 20
    const measured = layer.items.map(item => ({
      item,
      label: wrap(item.label, innerWidth, 13, 500, 2),
      sub: item.sub === undefined ? [] : wrap(item.sub, innerWidth, 11, 400, 2),
    }))
    const itemHeight = Math.max(44, ...measured.map(entry => entry.label.length * 17 + (entry.sub.length > 0 ? entry.sub.length * 14 + 2 : 0) + 20))
    const labelHeight = 26
    const height = PAD + labelHeight + rows * itemHeight + (rows - 1) * GAP + PAD - 2
    body += `<g class="ig-r-${layer.color}"><title>${esc(layer.label)}</title>${rect(MARGIN_X, y, CONTENT_WIDTH, height, 10, 'ig-box')}`
    body += txt(MARGIN_X + PAD, y + PAD + 6, layer.label, { size: 12, weight: 500, cls: 'ig-sub-r' })
    measured.forEach((entry, index) => {
      const column = index % perRow
      const row = Math.floor(index / perRow)
      const x = MARGIN_X + PAD + column * (itemWidth + GAP)
      const itemTop = y + PAD + labelHeight + row * (itemHeight + GAP)
      body += rect(x, itemTop, itemWidth, itemHeight, 6, 'ig-surface')
      const textHeight = entry.label.length * 17 + (entry.sub.length > 0 ? entry.sub.length * 14 + 2 : 0)
      const start = itemTop + itemHeight / 2 - textHeight / 2
      entry.label.forEach((part, lineIndex) => {
        body += txt(x + itemWidth / 2, start + 8 + lineIndex * 17, part, { size: 13, weight: 500, cls: 'ig-title-r', anchor: 'middle' })
      })
      entry.sub.forEach((part, lineIndex) => {
        body += txt(x + itemWidth / 2, start + entry.label.length * 17 + 2 + 7 + lineIndex * 14, part, { size: 11, cls: 'ig-sub-r', anchor: 'middle' })
      })
    })
    body += '</g>'
    y += height
    if (spec.arrows && layerIndex < spec.layers.length - 1) {
      const x = MARGIN_X + CONTENT_WIDTH / 2
      body += `<path class="ig-edge" d="M${x} ${y + 4}L${x} ${y + arrowGap - 3}" marker-end="url(#${prefix}-arrow)"/>`
    }
    y += arrowGap
  })
  const defs = spec.arrows
    ? `<marker id="${prefix}-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path class="ig-arrowhead" d="M2 1.5L8 5L2 8.5"/></marker>`
    : undefined
  const piece: Piece = { body, bottom: y - arrowGap }
  if (defs !== undefined) piece.defs = defs
  return piece
}
