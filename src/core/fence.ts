import { parseLoose } from './loose-json.ts'
import { normalizeSpec } from './normalize.ts'
import { isStyle, type StyleName } from './palettes.ts'
import type { InfographicSpec } from './types.ts'

export type FenceErrorCode = 'json' | 'kind' | 'empty'

export type FenceResult =
  | { status: 'ok'; spec: InfographicSpec; warnings: string[]; complete: boolean }
  | { status: 'pending' }
  | { status: 'error'; error: string; code: FenceErrorCode }

export interface ReadFenceOptions {
  /** The fence body is still being written by the model. */
  streaming?: boolean
  /**
   * Called with the style the spec itself names (if any); return the style to draw in.
   * Auto-colour assignment happens during normalisation, so a host that has its own preference
   * (a viewer's pick, a stored default) has to resolve it here rather than at render time.
   */
  resolveStyle?: (own: StyleName | undefined) => StyleName
}

/** The style a fence body names, if it names a valid one. */
function declaredStyle(value: unknown): StyleName | undefined {
  const raw = typeof value === 'object' && value !== null ? (value as Record<string, unknown>).style : undefined
  return isStyle(raw) ? raw : undefined
}

const SIGNATURE = /^\s*\{\s*"infographic"\s*:/

/** True when a code block's body is recognisably an infographic spec, whatever label the host gave the block. */
export function looksLikeInfographic(raw: string): boolean {
  return SIGNATURE.test(raw)
}

/** Turn the text of an ```infographic fence into a drawable spec. */
export function readFence(raw: string, options: ReadFenceOptions = {}): FenceResult {
  const streaming = options.streaming === true
  const parsed = parseLoose(raw)
  if (parsed === null) return streaming ? { status: 'pending' } : { status: 'error', error: 'The fence body is not valid JSON.', code: 'json' }
  const style = options.resolveStyle === undefined ? undefined : options.resolveStyle(declaredStyle(parsed.value))
  const partial = streaming || !parsed.complete
  const normalized = normalizeSpec(parsed.value, style === undefined ? { streaming: partial } : { streaming: partial, style })
  if (!normalized.ok) return streaming ? { status: 'pending' } : { status: 'error', error: normalized.error, code: normalized.code }
  if (!normalized.renderable) {
    return streaming ? { status: 'pending' } : { status: 'error', error: 'The spec has nothing to draw yet (check the required fields for this kind).', code: 'empty' }
  }
  return { status: 'ok', spec: normalized.spec, warnings: normalized.warnings, complete: parsed.complete }
}
