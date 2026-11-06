import type { InfographicSpec, RenderOptions, RenderedSvg } from '../types.ts'
import { esc, wrap } from '../text.ts'
import { DEFAULT_STYLE, styleSheet } from '../theme.ts'
import { PALETTES } from '../palettes.ts'
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
  // An explicit render option wins; otherwise the chart author's own choice; otherwise the default.
  const style = options.style ?? spec.style ?? DEFAULT_STYLE
  // A style with an accent ramp carries a masthead — the Economist's red rule and square tag. It is
  // the thing that makes the chart read as *that publication* rather than as "a chart in blue", so
  // it is drawn before anything else and everything below shifts down to clear it.
  const chrome = PALETTES[style].accent === undefined ? 0 : 30
  let header = ''
  let top = 28 + chrome
  if (chrome > 0) {
    header += `<rect class="ig-rule" x="${MARGIN_X}" y="16" width="${CONTENT_WIDTH}" height="3"/>`
    header += `<rect class="ig-tag" x="${MARGIN_X}" y="25" width="34" height="11"/>`
  }
  if (spec.title !== undefined) {
    header += txt(MARGIN_X, 34 + chrome, spec.title, { size: 16, weight: 500 })
    top = 58 + chrome
    if (spec.subtitle !== undefined) {
      header += txt(MARGIN_X, 56 + chrome, spec.subtitle, { size: 13, cls: 'ig-t2' })
      top = 82 + chrome
    }
  } else if (spec.subtitle !== undefined) {
    header += txt(MARGIN_X, 34 + chrome, spec.subtitle, { size: 13, cls: 'ig-t2' })
    top = 58 + chrome
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
  const svg = `${prolog}<svg xmlns="http://www.w3.org/2000/svg" class="${prefix}" viewBox="0 0 ${WIDTH} ${height}" ${size} role="img" aria-label="${label}"><title>${label}</title><style>${styleSheet(prefix, theme, style)}</style>${defs}${header}${piece.body}${footer}</svg>`
  return { svg, width: WIDTH, height }
}
