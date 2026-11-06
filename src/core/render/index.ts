import type { InfographicSpec, RenderOptions, RenderedSvg } from '../types.ts'
import { esc, wrap } from '../text.ts'
import { styleSheet } from '../theme.ts'
import { WIDTH, MARGIN_X, CONTENT_WIDTH, txt, type Piece } from './common.ts'
import { renderBar } from './bar.ts'
import { renderCards } from './cards.ts'
import { renderDonut } from './donut.ts'
import { renderFlow } from './flow.ts'
import { renderLayers } from './layers.ts'
import { renderLine } from './line.ts'
import { renderTimeline } from './timeline.ts'

function body(spec: InfographicSpec, top: number, prefix: string): Piece {
  switch (spec.infographic) {
    case 'flow':
      return renderFlow(spec, top, prefix)
    case 'bar':
      return renderBar(spec, top, prefix)
    case 'line':
      return renderLine(spec, top, prefix)
    case 'donut':
      return renderDonut(spec, top, prefix)
    case 'cards':
      return renderCards(spec, top, prefix)
    case 'timeline':
      return renderTimeline(spec, top, prefix)
    case 'layers':
      return renderLayers(spec, top, prefix)
  }
}

function summary(spec: InfographicSpec): string {
  return spec.title ?? spec.subtitle ?? spec.infographic
}

/** Draw a normalized spec as one self-contained `<svg>` string. Every piece of text is escaped; colors only come from the palette table. */
export function renderSvg(spec: InfographicSpec, options: RenderOptions = {}): RenderedSvg {
  const prefix = (options.idPrefix ?? 'ig').replace(/[^A-Za-z0-9_-]/g, '') || 'ig'
  const theme = options.theme ?? 'auto'
  let header = ''
  let top = 28
  if (spec.title !== undefined) {
    header += txt(MARGIN_X, 34, spec.title, { size: 16, weight: 500 })
    top = 58
    if (spec.subtitle !== undefined) {
      header += txt(MARGIN_X, 56, spec.subtitle, { size: 13, cls: 'ig-t2' })
      top = 82
    }
  } else if (spec.subtitle !== undefined) {
    header += txt(MARGIN_X, 34, spec.subtitle, { size: 13, cls: 'ig-t2' })
    top = 58
  }
  const piece = body(spec, top, prefix)
  let bottom = piece.bottom
  let footer = ''
  if (spec.note !== undefined) {
    const lines = wrap(spec.note, CONTENT_WIDTH, 11, 400, 2)
    lines.forEach((part, index) => {
      footer += txt(MARGIN_X, bottom + 24 + index * 15, part, { size: 11, cls: 'ig-t3' })
    })
    bottom += 24 + (lines.length - 1) * 15 + 8
  }
  const height = Math.ceil(bottom + 28)
  const label = esc(summary(spec))
  const size = options.standalone === true ? `width="${WIDTH}" height="${height}"` : 'width="100%"'
  const defs = piece.defs === undefined ? '' : `<defs>${piece.defs}</defs>`
  const prolog = options.standalone === true ? '<?xml version="1.0" encoding="UTF-8"?>\n' : ''
  const svg = `${prolog}<svg xmlns="http://www.w3.org/2000/svg" class="${prefix}" viewBox="0 0 ${WIDTH} ${height}" ${size} role="img" aria-label="${label}"><title>${label}</title><style>${styleSheet(prefix, theme)}</style>${defs}${header}${piece.body}${footer}</svg>`
  return { svg, width: WIDTH, height }
}
