import { pageBackground, renderSvg } from '../core/index.ts'
import type { InfographicSpec, Theme } from '../core/index.ts'
import { DEFAULT_STYLE, type StyleName } from '../core/palettes.ts'

const PNG_SCALE = 2

/**
 * Stamp the resolved style onto the spec as well as passing it as a render option.
 * Core's cascade has flipped once already (`options.style` vs `spec.style`), so writing
 * the value into both places keeps an explicit viewer choice winning either way.
 */
export function withStyle<T extends InfographicSpec>(spec: T, style: StyleName): T {
  return spec.style === style ? spec : { ...spec, style }
}

export function exportSvg(spec: InfographicSpec, theme: Exclude<Theme, 'auto'>, style: StyleName = DEFAULT_STYLE): string {
  return renderSvg(withStyle(spec, style), { theme, style, standalone: true, idPrefix: 'ig-export' }).svg
}

export function fileStem(spec: InfographicSpec): string {
  const base = (spec.title ?? spec.infographic).trim().replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '')
  return (base === '' ? spec.infographic : base).slice(0, 48)
}

export function download(name: string, blob: Blob, doc: Document = document): void {
  const url = URL.createObjectURL(blob)
  const link = doc.createElement('a')
  link.href = url
  link.download = name
  link.rel = 'noopener'
  link.style.display = 'none'
  doc.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export async function svgToPngBlob(
  spec: InfographicSpec,
  theme: Exclude<Theme, 'auto'>,
  style: StyleName = DEFAULT_STYLE,
  doc: Document = document,
): Promise<Blob> {
  const { svg, width, height } = renderSvg(withStyle(spec, style), { theme, style, standalone: true, idPrefix: 'ig-export' })
  const image = new Image()
  image.decoding = 'async'
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('SVG could not be rasterised'))
  })
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await loaded
  const canvas = doc.createElement('canvas')
  canvas.width = width * PNG_SCALE
  canvas.height = height * PNG_SCALE
  const context = canvas.getContext('2d')
  if (context === null) throw new Error('Canvas is not available')
  context.fillStyle = pageBackground(theme, style)
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => (blob === null ? reject(new Error('PNG encoding failed')) : resolve(blob)), 'image/png')
  })
}

/** The slice of the async clipboard API this module needs. */
interface ImageClipboard {
  write?: (items: unknown[]) => Promise<void>
}

type ClipboardItemCtor = new (data: Record<string, Promise<Blob>>) => unknown

/**
 * Put a bitmap on the clipboard so pasting into a rich-text editor (Feishu, WeChat, …)
 * inserts a picture instead of SVG source text.
 *
 * The `ClipboardItem` is built synchronously, holding the *pending* rasterisation promise:
 * Safari only accepts a clipboard item created inside the user-gesture task. Environments
 * without `ClipboardItem` or without `navigator.clipboard.write` (insecure origin, jsdom)
 * fail fast, before any rasterising work, so the caller's `guarded()` shows its "failed"
 * flash instead of a dead button.
 */
export async function copyPng(
  spec: InfographicSpec,
  theme: Exclude<Theme, 'auto'>,
  style: StyleName = DEFAULT_STYLE,
  doc: Document = document,
): Promise<void> {
  const Item = (globalThis as { ClipboardItem?: ClipboardItemCtor }).ClipboardItem
  const clipboard = typeof navigator === 'undefined' ? undefined : (navigator.clipboard as ImageClipboard | undefined)
  if (typeof Item !== 'function' || clipboard?.write === undefined) {
    throw new Error('This browser cannot put images on the clipboard (needs a secure context and ClipboardItem support)')
  }
  await clipboard.write([new Item({ 'image/png': svgToPngBlob(spec, theme, style, doc) })])
}

export async function copyText(text: string, doc: Document = document): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText !== undefined) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      /* fall back to the selection API below */
    }
  }
  const area = doc.createElement('textarea')
  area.value = text
  area.style.position = 'fixed'
  area.style.opacity = '0'
  doc.body.append(area)
  area.select()
  const ok = doc.execCommand('copy')
  area.remove()
  if (!ok) throw new Error('Copy failed')
}
