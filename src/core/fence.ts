import { parseLoose } from './loose-json.ts'
import { normalizeSpec } from './normalize.ts'
import type { InfographicSpec } from './types.ts'

export type FenceErrorCode = 'json' | 'kind' | 'empty'

export type FenceResult =
  | { status: 'ok'; spec: InfographicSpec; warnings: string[]; complete: boolean }
  | { status: 'pending' }
  | { status: 'error'; error: string; code: FenceErrorCode }

export interface ReadFenceOptions {
  /** The fence body is still being written by the model. */
  streaming?: boolean
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
  const normalized = normalizeSpec(parsed.value, { streaming: streaming || !parsed.complete })
  if (!normalized.ok) return streaming ? { status: 'pending' } : { status: 'error', error: normalized.error, code: normalized.code }
  if (!normalized.renderable) {
    return streaming ? { status: 'pending' } : { status: 'error', error: 'The spec has nothing to draw yet (check the required fields for this kind).', code: 'empty' }
  }
  return { status: 'ok', spec: normalized.spec, warnings: normalized.warnings, complete: parsed.complete }
}
