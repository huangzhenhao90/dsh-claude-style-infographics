/** Text helpers. SVG `<text>` never wraps or measures itself, so layout estimates widths here. */

const XML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function esc(value: string): string {
  return value.replace(/[&<>"']/g, char => XML_ESCAPES[char] as string)
}

const NARROW = new Set("iljtfI.,:;|!'`()[]/\\ ".split(''))
const WIDE = new Set('mwMW@%'.split(''))

function isWide(code: number): boolean {
  return (code >= 0x1100 && code <= 0x115f)
    || (code >= 0x2e80 && code <= 0xa4cf)
    || (code >= 0xac00 && code <= 0xd7a3)
    || (code >= 0xf900 && code <= 0xfaff)
    || (code >= 0xfe30 && code <= 0xfe6f)
    || (code >= 0xff00 && code <= 0xff60)
    || (code >= 0xffe0 && code <= 0xffe6)
    || (code >= 0x1f300 && code <= 0x1faff)
    || (code >= 0x20000 && code <= 0x3fffd)
}

/** The line-break character an author's `<br>` (or a literal newline) is normalised to. */
export const LINE_BREAK = '\n'

/** Estimated rendered width in px of `text` at `size` (system-ui; CJK counted as one em). */
export function measure(text: string, size: number, weight = 400): number {
  const bold = weight >= 500 ? 1.04 : 1
  let widest = 0
  // A hard-broken label is as wide as its widest line, never the sum of its lines.
  for (const line of text.split(LINE_BREAK)) {
    let em = 0
    for (const char of line) {
      const code = char.codePointAt(0) as number
      if (isWide(code)) em += 1
      else if (NARROW.has(char)) em += 0.32
      else if (WIDE.has(char)) em += 0.86
      else if (char >= '0' && char <= '9') em += 0.58
      else if (char >= 'A' && char <= 'Z') em += 0.68
      else em += 0.56
    }
    widest = Math.max(widest, em)
  }
  return widest * size * bold
}

function fits(text: string, width: number, size: number, weight: number): boolean {
  return measure(text, size, weight) <= width
}

export function ellipsize(text: string, width: number, size: number, weight = 400): string {
  if (fits(text, width, size, weight)) return text
  const chars = [...text]
  while (chars.length > 1 && !fits(`${chars.join('')}…`, width, size, weight)) chars.pop()
  return `${chars.join('').trimEnd()}…`
}

const NO_LINE_START = /^[，。、：；！？）」』》】〉…,.:;!?)\]}%]/u

/** Greedy wrap into at most `maxLines` lines no wider than `width`; the last line is ellipsized. */
export function wrap(text: string, width: number, size: number, weight = 400, maxLines = 3): string[] {
  // An explicit line break is a promise, not a hint: never re-flow across one.
  const lines = text.split(LINE_BREAK).flatMap(paragraph => wrapParagraph(paragraph, width, size, weight))
  if (lines.length === 0) return ['']
  const shown = lines.slice(0, maxLines).map(line => ellipsize(line, width, size, weight))
  if (lines.length > maxLines) shown[maxLines - 1] = ellipsize(`${shown[maxLines - 1] as string}…`, width, size, weight)
  return shown
}

function wrapParagraph(text: string, width: number, size: number, weight: number): string[] {
  const raw = text.match(/[\u2e80-\u9fff\uac00-\ud7a3\uff00-\uffef]|[^\s\u2e80-\u9fff\uac00-\ud7a3\uff00-\uffef]+\s*|\s+/g) ?? []
  // Closing punctuation must not start a line: glue it to the character before it.
  const tokens: string[] = []
  for (const token of raw) {
    if (tokens.length > 0 && NO_LINE_START.test(token)) tokens[tokens.length - 1] += token
    else if (!fits(token.trimEnd(), width, size, weight)) {
      // A single word wider than the line (an identifier, a URL) is broken per character rather than cut off.
      for (const char of token) {
        if (tokens.length > 0 && NO_LINE_START.test(char)) tokens[tokens.length - 1] += char
        else tokens.push(char)
      }
    } else tokens.push(token)
  }
  const lines: string[] = []
  let current = ''
  for (const token of tokens) {
    const candidate = current + token
    if (current === '' || fits(candidate.trimEnd(), width, size, weight)) {
      current = candidate
      continue
    }
    lines.push(current.trimEnd())
    current = token.trimStart()
  }
  if (current.trim() !== '') lines.push(current.trimEnd())
  return lines.length === 0 ? [''] : lines
}

/** Round up to a "nice" axis step (1, 2, 2.5, 5 × 10^k). */
export function niceStep(range: number, targetTicks: number): number {
  if (!(range > 0)) return 1
  const rough = range / Math.max(1, targetTicks)
  const power = 10 ** Math.floor(Math.log10(rough))
  const fraction = rough / power
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return nice * power
}

export function niceDomain(min: number, max: number, targetTicks = 4, includeZero = true): { min: number; max: number; step: number; ticks: number[] } {
  let low = includeZero ? Math.min(0, min) : min
  let high = includeZero ? Math.max(0, max) : max
  if (high === low) high = low + 1
  const step = niceStep(high - low, targetTicks)
  low = Math.floor(low / step) * step
  high = Math.ceil(high / step) * step
  const ticks: number[] = []
  for (let value = low; value <= high + step / 1e6; value += step) ticks.push(Math.round(value / step) * step)
  return { min: low, max: high, step, ticks }
}

/** Compact number for axes and labels: 1,200 → 1.2k only when it keeps the label short. */
export function formatNumber(value: number, unit = ''): string {
  const abs = Math.abs(value)
  let text: string
  if (abs >= 1e9) text = `${trim(value / 1e9)}B`
  else if (abs >= 1e6) text = `${trim(value / 1e6)}M`
  else if (abs >= 1e4) text = `${trim(value / 1e3)}k`
  else text = trim(value)
  if (/^[$¥€£]$/.test(unit)) return value < 0 ? `-${unit}${text.slice(1)}` : `${unit}${text}`
  return `${text}${unit}`
}

function trim(value: number): string {
  const rounded = Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 100) / 100
  return String(rounded)
}
