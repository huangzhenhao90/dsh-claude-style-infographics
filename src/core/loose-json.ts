/**
 * A forgiving JSON reader for model output that may still be streaming.
 *
 * - Truncated input yields everything that is *complete* so far: an unfinished
 *   trailing key, string, number or literal is dropped, never half-applied.
 * - Trailing commas, raw newlines inside strings, `//` and block comments, and
 *   text after the root value (a leaked tool template, say) are tolerated.
 * - It never executes anything and only builds plain data.
 */

export interface LooseResult {
  value: unknown
  /** False when the input ended before the root value was closed. */
  complete: boolean
}

const INCOMPLETE = Symbol('incomplete')
const MAX_DEPTH = 24

class LooseError extends Error {}

class Reader {
  pos = 0
  truncated = false
  private readonly text: string

  constructor(text: string) {
    this.text = text
  }

  private skip(): void {
    for (;;) {
      const char = this.text[this.pos]
      if (char === undefined) return
      if (char === ' ' || char === '\n' || char === '\r' || char === '\t' || char === '\ufeff') {
        this.pos += 1
      } else if (char === '/' && this.text[this.pos + 1] === '/') {
        const end = this.text.indexOf('\n', this.pos)
        this.pos = end < 0 ? this.text.length : end + 1
      } else if (char === '/' && this.text[this.pos + 1] === '*') {
        const end = this.text.indexOf('*/', this.pos + 2)
        this.pos = end < 0 ? this.text.length : end + 2
      } else {
        return
      }
    }
  }

  value(depth: number): unknown {
    if (depth > MAX_DEPTH) throw new LooseError('nesting too deep')
    this.skip()
    const char = this.text[this.pos]
    if (char === undefined) return INCOMPLETE
    if (char === '{') return this.object(depth)
    if (char === '[') return this.array(depth)
    if (char === '"') return this.string()
    if (char === '-' || (char >= '0' && char <= '9')) return this.number()
    if (char === 't' || char === 'f' || char === 'n') return this.literal()
    throw new LooseError(`unexpected "${char}" at ${this.pos}`)
  }

  private object(depth: number): Record<string, unknown> {
    this.pos += 1
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>
    for (;;) {
      this.skip()
      const char = this.text[this.pos]
      if (char === undefined) {
        this.truncated = true
        return result
      }
      if (char === '}') {
        this.pos += 1
        return result
      }
      if (char === ',') {
        this.pos += 1
        continue
      }
      if (char !== '"') throw new LooseError(`expected a key at ${this.pos}`)
      const key = this.string()
      if (key === INCOMPLETE) {
        this.truncated = true
        return result
      }
      this.skip()
      const colon = this.text[this.pos]
      if (colon === undefined) {
        this.truncated = true
        return result
      }
      if (colon !== ':') throw new LooseError(`expected ":" at ${this.pos}`)
      this.pos += 1
      const item = this.value(depth + 1)
      if (item === INCOMPLETE) {
        this.truncated = true
        this.pos = this.text.length
        return result
      }
      if (key !== '__proto__') result[key as string] = item
    }
  }

  private array(depth: number): unknown[] {
    this.pos += 1
    const result: unknown[] = []
    for (;;) {
      this.skip()
      const char = this.text[this.pos]
      if (char === undefined) {
        this.truncated = true
        return result
      }
      if (char === ']') {
        this.pos += 1
        return result
      }
      if (char === ',') {
        this.pos += 1
        continue
      }
      const item = this.value(depth + 1)
      if (item === INCOMPLETE) {
        this.truncated = true
        this.pos = this.text.length
        return result
      }
      result.push(item)
    }
  }

  private string(): string | typeof INCOMPLETE {
    this.pos += 1
    let out = ''
    for (;;) {
      const char = this.text[this.pos]
      if (char === undefined) return INCOMPLETE
      if (char === '"') {
        this.pos += 1
        return out
      }
      if (char === '\\') {
        const next = this.text[this.pos + 1]
        if (next === undefined) return INCOMPLETE
        if (next === 'u') {
          const hex = this.text.slice(this.pos + 2, this.pos + 6)
          if (hex.length < 4) return INCOMPLETE
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new LooseError(`bad unicode escape at ${this.pos}`)
          out += String.fromCharCode(Number.parseInt(hex, 16))
          this.pos += 6
          continue
        }
        const map: Record<string, string> = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '/': '/', '\\': '\\', '"': '"' }
        out += map[next] ?? next
        this.pos += 2
        continue
      }
      out += char
      this.pos += 1
    }
  }

  private number(): number | typeof INCOMPLETE {
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(this.text.slice(this.pos, this.pos + 40))
    if (match === null) {
      if (this.pos + 1 >= this.text.length) return INCOMPLETE
      throw new LooseError(`bad number at ${this.pos}`)
    }
    const end = this.pos + match[0].length
    if (end >= this.text.length) return INCOMPLETE
    const after = this.text[end] as string
    if (!/[\s,\]}/]/.test(after)) throw new LooseError(`bad number at ${this.pos}`)
    this.pos = end
    return Number(match[0])
  }

  private literal(): boolean | null | typeof INCOMPLETE {
    for (const [word, value] of [['true', true], ['false', false], ['null', null]] as const) {
      const slice = this.text.slice(this.pos, this.pos + word.length)
      if (slice === word) {
        this.pos += word.length
        return value
      }
      if (slice.length < word.length && word.startsWith(slice)) return INCOMPLETE
    }
    throw new LooseError(`unexpected token at ${this.pos}`)
  }
}

/** Parse `text`; returns null when it is not recoverable JSON. */
export function parseLoose(text: string): LooseResult | null {
  const reader = new Reader(text)
  try {
    const value = reader.value(0)
    if (value === INCOMPLETE) return null
    return { value, complete: !reader.truncated }
  } catch (error) {
    if (error instanceof LooseError) return null
    throw error
  }
}
