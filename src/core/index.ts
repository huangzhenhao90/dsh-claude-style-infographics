export { RAMPS, KINDS } from './types.ts'
export type * from './types.ts'
export { STYLES, PALETTES, DEFAULT_STYLE, isStyle } from './palettes.ts'
export type { StyleName, StylePalette, Neutrals } from './palettes.ts'
export { parseLoose } from './loose-json.ts'
export { normalizeSpec, LIMITS } from './normalize.ts'
export { readFence, looksLikeInfographic } from './fence.ts'
export type { FenceErrorCode, FenceResult, ReadFenceOptions } from './fence.ts'
export { renderSvg } from './render/index.ts'
export { pageBackground, rampStops } from './theme.ts'

import { normalizeSpec } from './normalize.ts'
import { renderSvg } from './render/index.ts'
import type { RenderOptions } from './types.ts'

/** One-call helper: spec object → SVG string (throws on an invalid spec). */
export function renderInfographic(input: unknown, options: RenderOptions = {}): string {
  const result = normalizeSpec(input)
  if (!result.ok) throw new Error(result.error)
  if (!result.renderable) throw new Error('The spec has nothing to draw.')
  return renderSvg(result.spec, options).svg
}
