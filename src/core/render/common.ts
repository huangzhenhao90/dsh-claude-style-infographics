import { esc } from '../text.ts'

/** Every infographic is drawn on a fixed 680px-wide canvas with a 40px safe margin. */
export const WIDTH = 680
export const MARGIN_X = 40
export const CONTENT_WIDTH = WIDTH - 2 * MARGIN_X

export interface Piece {
  body: string
  /** y of the lowest drawn pixel (before the bottom padding). */
  bottom: number
  defs?: string
}

export interface TextOptions {
  size?: number
  weight?: 400 | 500
  cls?: string
  anchor?: 'start' | 'middle' | 'end'
}

export function round(value: number): number {
  return Math.round(value * 10) / 10
}

export function txt(x: number, y: number, content: string, options: TextOptions = {}): string {
  const { size = 12, weight = 400, cls = 'ig-t1', anchor = 'start' } = options
  const anchorAttr = anchor === 'start' ? '' : ` text-anchor="${anchor}"`
  const weightAttr = weight === 400 ? '' : ` font-weight="${weight}"`
  return `<text class="${cls}" x="${round(x)}" y="${round(y)}"${anchorAttr} dominant-baseline="central" font-size="${size}"${weightAttr}>${esc(content)}</text>`
}

/** Draw pre-wrapped lines, vertically centred on `centerY`. */
export function textBlock(x: number, centerY: number, lines: readonly string[], lineHeight: number, options: TextOptions = {}): string {
  const start = centerY - ((lines.length - 1) * lineHeight) / 2
  return lines.map((line, index) => txt(x, start + index * lineHeight, line, options)).join('')
}

export function rect(x: number, y: number, width: number, height: number, radius: number, cls: string, extra = ''): string {
  return `<rect class="${cls}" x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" rx="${radius}"${extra}/>`
}

export function line(x1: number, y1: number, x2: number, y2: number, cls: string): string {
  return `<line class="${cls}" x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}"/>`
}

export function titleOf(label: string): string {
  return `<title>${esc(label)}</title>`
}

export interface Point {
  x: number
  y: number
}

/** Polyline with rounded corners (radius clipped to half of each adjoining segment). */
export function roundedPath(points: readonly Point[], radius: number): string {
  const clean: Point[] = []
  for (const point of points) {
    const last = clean[clean.length - 1]
    if (last !== undefined && Math.abs(last.x - point.x) < 0.01 && Math.abs(last.y - point.y) < 0.01) continue
    const before = clean[clean.length - 2]
    if (last !== undefined && before !== undefined) {
      const sameX = Math.abs(before.x - last.x) < 0.01 && Math.abs(last.x - point.x) < 0.01
      const sameY = Math.abs(before.y - last.y) < 0.01 && Math.abs(last.y - point.y) < 0.01
      if (sameX || sameY) clean[clean.length - 1] = point
      else clean.push(point)
    } else {
      clean.push(point)
    }
  }
  const first = clean[0]
  if (first === undefined) return ''
  let path = `M${round(first.x)} ${round(first.y)}`
  for (let index = 1; index < clean.length; index += 1) {
    const current = clean[index] as Point
    const next = clean[index + 1]
    const previous = clean[index - 1] as Point
    if (next === undefined) {
      path += `L${round(current.x)} ${round(current.y)}`
      continue
    }
    const inLength = Math.hypot(current.x - previous.x, current.y - previous.y)
    const outLength = Math.hypot(next.x - current.x, next.y - current.y)
    const r = Math.min(radius, inLength / 2, outLength / 2)
    const inX = current.x - ((current.x - previous.x) / inLength) * r
    const inY = current.y - ((current.y - previous.y) / inLength) * r
    const outX = current.x + ((next.x - current.x) / outLength) * r
    const outY = current.y + ((next.y - current.y) / outLength) * r
    path += `L${round(inX)} ${round(inY)}Q${round(current.x)} ${round(current.y)} ${round(outX)} ${round(outY)}`
  }
  return path
}
