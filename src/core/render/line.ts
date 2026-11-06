import type { LineSpec } from '../types.ts'
import { esc, formatNumber, measure, niceDomain } from '../text.ts'
import { MARGIN_X, WIDTH, line, round, txt, type Piece } from './common.ts'
import { legend, pointTitle } from './chart-parts.ts'

const RIGHT = WIDTH - MARGIN_X

export function renderLine(spec: LineSpec, top: number, _prefix: string): Piece {
  const unit = spec.unit ?? ''
  const values = spec.series.flatMap(series => series.data.filter((value): value is number => typeof value === 'number'))
  const low = Math.min(...values)
  const high = Math.max(...values)
  const includeZero = spec.area || low <= 0 || low < high * 0.4
  const domain = niceDomain(low, high, 4, includeZero)
  const tickLabels = domain.ticks.map(tick => formatNumber(tick, unit))

  let body = ''
  let y = top
  if (spec.series.length > 1) {
    const entries = legend(spec.series.map(series => ({ label: series.name, color: series.color })), y + 6)
    body += entries.svg
    y += entries.height + 10
  }
  const axisWidth = Math.max(...tickLabels.map(label => measure(label, 11)), 10) + 12
  const plotLeft = MARGIN_X + axisWidth
  const plotWidth = RIGHT - plotLeft
  const plotTop = y + 10
  const plotHeight = 240
  const plotBottom = plotTop + plotHeight
  const scale = (value: number): number => plotBottom - ((value - domain.min) / (domain.max - domain.min)) * plotHeight
  domain.ticks.forEach((tick, index) => {
    const position = scale(tick)
    body += line(plotLeft, position, RIGHT, position, tick === domain.min ? 'ig-axis' : 'ig-grid')
    body += txt(plotLeft - 8, position, tickLabels[index] as string, { size: 11, cls: 'ig-t3', anchor: 'end' })
  })

  const count = spec.categories.length
  const band = plotWidth / Math.max(1, count)
  const xAt = (index: number): number => plotLeft + band * index + band / 2
  const widest = Math.max(...spec.categories.map(category => measure(category, 12)), 1)
  const stride = Math.max(1, Math.ceil((widest + 10) / band))
  spec.categories.forEach((category, index) => {
    if (index % stride !== 0 && index !== count - 1) return
    if (index !== count - 1 && (count - 1 - index) < stride && stride > 1) return
    body += txt(xAt(index), plotBottom + 16, category, { size: 12, cls: 'ig-t2', anchor: 'middle' })
  })

  const showDots = count <= 24
  for (const series of spec.series) {
    const runs: { x: number; y: number; index: number; value: number }[][] = []
    let current: { x: number; y: number; index: number; value: number }[] = []
    series.data.forEach((value, index) => {
      if (typeof value !== 'number' || index >= count) {
        if (current.length > 0) runs.push(current)
        current = []
        return
      }
      current.push({ x: xAt(index), y: scale(value), index, value })
    })
    if (current.length > 0) runs.push(current)
    let drawing = ''
    for (const run of runs) {
      const path = run.map((point, index) => `${index === 0 ? 'M' : 'L'}${round(point.x)} ${round(point.y)}`).join('')
      if (spec.area && run.length > 1) {
        const first = run[0] as { x: number; y: number }
        const last = run[run.length - 1] as { x: number; y: number }
        const base = scale(Math.max(domain.min, Math.min(0, domain.max)))
        drawing += `<path class="ig-mark-area" d="${path}L${round(last.x)} ${round(base)}L${round(first.x)} ${round(base)}Z"/>`
      }
      drawing += `<path class="ig-mark-stroke" d="${path}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`
      if (showDots) {
        for (const point of run) {
          const category = spec.categories[point.index] ?? ''
          drawing += `<circle class="ig-mark" cx="${round(point.x)}" cy="${round(point.y)}" r="3.5"><title>${esc(pointTitle(series.name, category, formatNumber(point.value, unit)))}</title></circle>`
        }
      }
    }
    body += `<g class="ig-r-${series.color}">${drawing}</g>`
  }
  return { body, bottom: plotBottom + 28 }
}
