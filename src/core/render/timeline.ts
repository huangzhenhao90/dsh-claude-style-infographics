import type { TimelineSpec } from '../types.ts'
import { esc, measure, wrap } from '../text.ts'
import { MARGIN_X, WIDTH, line, txt, type Piece } from './common.ts'

const RIGHT = WIDTH - MARGIN_X

export function renderTimeline(spec: TimelineSpec, top: number, _prefix: string): Piece {
  const hasTimes = spec.items.some(item => item.time !== undefined)
  const timeWidth = hasTimes ? Math.min(150, Math.max(...spec.items.map(item => measure(item.time ?? '', 12)), 30)) : 0
  const dotX = MARGIN_X + (hasTimes ? timeWidth + 22 : 6)
  const textX = dotX + 22
  const textWidth = RIGHT - textX
  let y = top
  let body = ''
  const rows = spec.items.map(item => {
    const titleLines = wrap(item.title, textWidth, 14, 500, 2)
    const descLines = item.desc === undefined ? [] : wrap(item.desc, textWidth, 12, 400, 4)
    const height = titleLines.length * 19 + (descLines.length > 0 ? descLines.length * 17 + 4 : 0) + 22
    const row = { item, titleLines, descLines, y, height }
    y += height
    return row
  })
  const first = rows[0]
  const last = rows[rows.length - 1]
  if (first !== undefined && last !== undefined && rows.length > 1) {
    body += line(dotX, first.y + 10, dotX, last.y + 10, 'ig-axis')
  }
  for (const row of rows) {
    const centerY = row.y + 10
    body += `<g class="ig-r-${row.item.color}"><title>${esc(row.item.title)}</title><circle class="ig-mark" cx="${dotX}" cy="${centerY}" r="5"/></g>`
    if (row.item.time !== undefined) body += txt(MARGIN_X + timeWidth, centerY, row.item.time, { size: 12, cls: 'ig-t2', anchor: 'end' })
    row.titleLines.forEach((part, index) => {
      body += txt(textX, centerY + index * 19, part, { size: 14, weight: 500 })
    })
    const descTop = centerY + (row.titleLines.length - 1) * 19 + 21
    row.descLines.forEach((part, index) => {
      body += txt(textX, descTop + index * 17, part, { size: 12, cls: 'ig-t2' })
    })
  }
  return { body, bottom: y - 8 }
}
