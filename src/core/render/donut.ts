import type { DonutSpec } from '../types.ts'
import { esc, formatNumber, measure, wrap } from '../text.ts'
import { MARGIN_X, rect, round, txt, type Piece } from './common.ts'

const OUTER = 92
const INNER = 60

function arc(cx: number, cy: number, start: number, end: number): string {
  const point = (radius: number, angle: number): string => `${round(cx + radius * Math.sin(angle))} ${round(cy - radius * Math.cos(angle))}`
  const large = end - start > Math.PI ? 1 : 0
  return `M${point(OUTER, start)}A${OUTER} ${OUTER} 0 ${large} 1 ${point(OUTER, end)}L${point(INNER, end)}A${INNER} ${INNER} 0 ${large} 0 ${point(INNER, start)}Z`
}

export function renderDonut(spec: DonutSpec, top: number, _prefix: string): Piece {
  const slices = spec.data.filter(slice => slice.value > 0)
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const unit = spec.unit ?? ''
  const cx = MARGIN_X + OUTER + 8
  const cy = top + OUTER + 10
  let body = ''
  if (slices.length === 1) {
    const slice = slices[0] as (typeof slices)[number]
    body += `<g class="ig-r-${slice.color}"><title>${esc(slice.label)}: ${esc(formatNumber(slice.value, unit))} (100%)</title><path class="ig-mark" fill-rule="evenodd" d="M${cx - OUTER} ${cy}A${OUTER} ${OUTER} 0 1 0 ${cx + OUTER} ${cy}A${OUTER} ${OUTER} 0 1 0 ${cx - OUTER} ${cy}ZM${cx - INNER} ${cy}A${INNER} ${INNER} 0 1 1 ${cx + INNER} ${cy}A${INNER} ${INNER} 0 1 1 ${cx - INNER} ${cy}Z"/></g>`
  } else {
    const gap = slices.length > 1 ? 0.02 : 0
    let angle = 0
    for (const slice of slices) {
      const span = (slice.value / total) * Math.PI * 2
      const start = angle + gap / 2
      const end = Math.max(start + 0.002, angle + span - gap / 2)
      body += `<g class="ig-r-${slice.color}"><title>${esc(slice.label)}: ${esc(formatNumber(slice.value, unit))} (${round((slice.value / total) * 100)}%)</title><path class="ig-mark" d="${arc(cx, cy, start, end)}"/></g>`
      angle += span
    }
  }
  const centerValue = spec.center?.value ?? formatNumber(total, unit)
  const centerLabel = spec.center?.label
  const centerLines = centerLabel === undefined ? [] : wrap(centerLabel, INNER * 1.6, 12, 400, 2)
  const shift = centerLines.length > 0 ? -((centerLines.length * 14) / 2) + 4 : 0
  body += txt(cx, cy + shift - 2, centerValue, { size: centerValue.length > 8 ? 18 : 24, weight: 500, anchor: 'middle' })
  centerLines.forEach((part, index) => {
    body += txt(cx, cy + shift + 20 + index * 14, part, { size: 12, cls: 'ig-t2', anchor: 'middle' })
  })

  const legendLeft = cx + OUTER + 40
  const legendWidth = MARGIN_X + 600 - legendLeft
  const rowHeight = 28
  const legendHeight = slices.length * rowHeight
  const legendTop = cy - legendHeight / 2 + rowHeight / 2
  slices.forEach((slice, index) => {
    const y = legendTop + index * rowHeight
    const percent = `${round((slice.value / total) * 100)}%`
    const valueText = `${formatNumber(slice.value, unit)}  ·  ${percent}`
    const labelRoom = Math.max(40, legendWidth - measure(valueText, 12) - 32)
    const label = wrap(slice.label, labelRoom, 13, 400, 1)[0] as string
    body += `<g class="ig-r-${slice.color}">${rect(legendLeft, y - 5, 10, 10, 2, 'ig-mark')}</g>`
    body += txt(legendLeft + 18, y, label, { size: 13, cls: 'ig-t1' })
    body += txt(legendLeft + legendWidth, y, valueText, { size: 12, cls: 'ig-t2', anchor: 'end' })
  })
  return { body, bottom: Math.max(cy + OUTER, legendTop + legendHeight) + 8 }
}

