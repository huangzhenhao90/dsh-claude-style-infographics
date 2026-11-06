import type { BarSpec } from '../types.ts'
import { esc, formatNumber, measure, niceDomain, wrap } from '../text.ts'
import { MARGIN_X, WIDTH, line, rect, txt, type Piece } from './common.ts'
import { legend, pointTitle } from './chart-parts.ts'

const RIGHT = WIDTH - MARGIN_X

interface Domain {
  min: number
  max: number
  ticks: number[]
}

function domainOf(spec: BarSpec): Domain {
  let low = 0
  let high = 0
  for (let index = 0; index < spec.categories.length; index += 1) {
    if (spec.stacked) {
      let positive = 0
      let negative = 0
      for (const series of spec.series) {
        const value = series.data[index]
        if (typeof value !== 'number') continue
        if (value >= 0) positive += value
        else negative += value
      }
      high = Math.max(high, positive)
      low = Math.min(low, negative)
    } else {
      for (const series of spec.series) {
        const value = series.data[index]
        if (typeof value !== 'number') continue
        high = Math.max(high, value)
        low = Math.min(low, value)
      }
    }
  }
  const nice = niceDomain(low, high, spec.horizontal ? 4 : 4)
  return { min: nice.min, max: nice.max, ticks: nice.ticks }
}

export function renderBar(spec: BarSpec, top: number, _prefix: string): Piece {
  const domain = domainOf(spec)
  const unit = spec.unit ?? ''
  const showLegend = spec.series.length > 1
  let body = ''
  let y = top
  if (showLegend) {
    const entries = legend(spec.series.map(series => ({ label: series.name, color: series.color })), y + 6)
    body += entries.svg
    y += entries.height + 10
  }
  const categories = spec.categories
  const count = categories.length
  const seriesCount = spec.series.length
  const tickLabels = domain.ticks.map(tick => formatNumber(tick, unit))

  if (spec.horizontal) {
    const labelWidth = Math.min(170, Math.max(...categories.map(category => measure(category, 12)), 20) + 14)
    const plotLeft = MARGIN_X + labelWidth
    const plotWidth = RIGHT - plotLeft - 36
    const slot = spec.stacked || seriesCount === 1 ? 32 : seriesCount * 17 + 14
    const barHeight = spec.stacked || seriesCount === 1 ? 20 : 14
    const plotTop = y + 4
    const plotHeight = count * slot
    const scale = (value: number): number => plotLeft + ((value - domain.min) / (domain.max - domain.min)) * plotWidth
    domain.ticks.forEach((tick, index) => {
      const x = scale(tick)
      body += line(x, plotTop, x, plotTop + plotHeight, tick === 0 ? 'ig-axis' : 'ig-grid')
      body += txt(x, plotTop + plotHeight + 14, tickLabels[index] as string, { size: 11, cls: 'ig-t3', anchor: 'middle' })
    })
    categories.forEach((category, index) => {
      const center = plotTop + index * slot + slot / 2
      const label = wrap(category, labelWidth - 12, 12, 400, 2)
      body += label.map((part, row) => txt(plotLeft - 8, center + (row - (label.length - 1) / 2) * 14, part, { size: 12, cls: 'ig-t2', anchor: 'end' })).join('')
      if (spec.stacked) {
        let positive = 0
        let negative = 0
        spec.series.forEach(series => {
          const value = series.data[index]
          if (typeof value !== 'number' || value === 0) return
          const from = value >= 0 ? positive : negative
          const to = from + value
          if (value >= 0) positive = to
          else negative = to
          const x1 = scale(Math.min(from, to))
          const x2 = scale(Math.max(from, to))
          body += `<g class="ig-r-${series.color}"><title>${esc(pointTitle(series.name, category, formatNumber(value, unit)))}</title>${rect(x1, center - barHeight / 2, Math.max(1, x2 - x1), barHeight, 2, 'ig-mark')}</g>`
        })
        if (positive > 0) body += txt(scale(positive) + 6, center, formatNumber(positive, unit), { size: 11, cls: 'ig-t2' })
      } else {
        const group = seriesCount * barHeight + (seriesCount - 1) * 3
        spec.series.forEach((series, seriesIndex) => {
          const value = series.data[index]
          if (typeof value !== 'number') return
          const barTop = center - group / 2 + seriesIndex * (barHeight + 3)
          const zero = scale(0)
          const end = scale(value)
          body += `<g class="ig-r-${series.color}"><title>${esc(pointTitle(series.name, category, formatNumber(value, unit)))}</title>${rect(Math.min(zero, end), barTop, Math.max(1, Math.abs(end - zero)), barHeight, 3, 'ig-mark')}</g>`
          const anchor = value >= 0 ? 'start' : 'end'
          body += txt(value >= 0 ? end + 6 : end - 6, barTop + barHeight / 2, formatNumber(value, unit), { size: 11, cls: 'ig-t2', anchor })
        })
      }
    })
    return { body, bottom: plotTop + plotHeight + 24 }
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
    body += line(plotLeft, position, RIGHT, position, tick === 0 ? 'ig-axis' : 'ig-grid')
    body += txt(plotLeft - 8, position, tickLabels[index] as string, { size: 11, cls: 'ig-t3', anchor: 'end' })
  })
  if (!domain.ticks.includes(0)) body += line(plotLeft, plotBottom, RIGHT, plotBottom, 'ig-axis')
  const band = plotWidth / Math.max(1, count)
  const slotCount = spec.stacked ? 1 : Math.max(1, seriesCount)
  const gap = 4
  const barWidth = Math.max(6, Math.min(46, (band * 0.72 - gap * (slotCount - 1)) / slotCount))
  const groupWidth = slotCount * barWidth + (slotCount - 1) * gap
  const labelWidthLimit = band / slotCount
  const showValues = !spec.stacked && count * seriesCount <= 24
    && spec.series.every(series => series.data.every(value => value === null || measure(formatNumber(value, unit), 11) <= Math.max(labelWidthLimit, barWidth + 14)))
  categories.forEach((category, index) => {
    const center = plotLeft + band * index + band / 2
    const wrapped = wrap(category, band - 6, 12, 400, 2)
    body += wrapped.map((part, row) => txt(center, plotBottom + 16 + row * 14, part, { size: 12, cls: 'ig-t2', anchor: 'middle' })).join('')
    const left = center - groupWidth / 2
    if (spec.stacked) {
      let positive = 0
      let negative = 0
      spec.series.forEach(series => {
        const value = series.data[index]
        if (typeof value !== 'number' || value === 0) return
        const from = value >= 0 ? positive : negative
        const to = from + value
        if (value >= 0) positive = to
        else negative = to
        const y1 = scale(Math.max(from, to))
        const y2 = scale(Math.min(from, to))
        body += `<g class="ig-r-${series.color}"><title>${esc(pointTitle(series.name, category, formatNumber(value, unit)))}</title>${rect(left, y1, barWidth, Math.max(1, y2 - y1), 2, 'ig-mark')}</g>`
      })
      if (positive > 0) body += txt(center, scale(positive) - 9, formatNumber(positive, unit), { size: 11, cls: 'ig-t2', anchor: 'middle' })
    } else {
      spec.series.forEach((series, seriesIndex) => {
        const value = series.data[index]
        if (typeof value !== 'number') return
        const x = left + seriesIndex * (barWidth + gap)
        const zero = scale(0)
        const end = scale(value)
        body += `<g class="ig-r-${series.color}"><title>${esc(pointTitle(series.name, category, formatNumber(value, unit)))}</title>${rect(x, Math.min(zero, end), barWidth, Math.max(1, Math.abs(end - zero)), 3, 'ig-mark')}</g>`
        if (showValues) body += txt(x + barWidth / 2, value >= 0 ? end - 9 : end + 9, formatNumber(value, unit), { size: 11, cls: 'ig-t2', anchor: 'middle' })
      })
    }
  })
  const labelRows = Math.max(1, ...categories.map(category => wrap(category, band - 6, 12, 400, 2).length))
  return { body, bottom: plotBottom + 8 + labelRows * 14 + 6 }
}
