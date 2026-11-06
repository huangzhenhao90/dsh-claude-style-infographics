import type { Ramp } from '../types.ts'
import { measure } from '../text.ts'
import { CONTENT_WIDTH, MARGIN_X, rect, txt } from './common.ts'

export interface LegendEntry {
  label: string
  color: Ramp
}

/** Wrapping row of swatch + label pairs. Returns its drawing and height. */
export function legend(entries: readonly LegendEntry[], top: number): { svg: string; height: number } {
  let x = MARGIN_X
  let y = top
  let svg = ''
  for (const entry of entries) {
    const width = 10 + 6 + measure(entry.label, 12) + 18
    if (x + width > MARGIN_X + CONTENT_WIDTH && x > MARGIN_X) {
      x = MARGIN_X
      y += 20
    }
    svg += `<g class="ig-r-${entry.color}">${rect(x, y - 5, 10, 10, 2, 'ig-mark')}</g>`
    svg += txt(x + 16, y, entry.label, { size: 12, cls: 'ig-t2' })
    x += width
  }
  return { svg, height: entries.length === 0 ? 0 : y - top + 14 }
}

/** Short, tab-free tooltip text for one data point. */
export function pointTitle(series: string, category: string, value: string): string {
  const parts = [series, category].filter(part => part !== '')
  return `${parts.join(' · ')}${parts.length > 0 ? ': ' : ''}${value}`
}
