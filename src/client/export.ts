import { pageBackground, renderSvg } from '../core/index.ts'
import type { InfographicSpec, Theme } from '../core/index.ts'

const PNG_SCALE = 2

export function exportSvg(spec: InfographicSpec, theme: Exclude<Theme, 'auto'>): string {
  return renderSvg(spec, { theme, standalone: true, idPrefix: 'ig-export' }).svg
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

export async function svgToPngBlob(spec: InfographicSpec, theme: Exclude<Theme, 'auto'>, doc: Document = document): Promise<Blob> {
  const { svg, width, height } = renderSvg(spec, { theme, standalone: true, idPrefix: 'ig-export' })
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
  context.fillStyle = pageBackground(theme)
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => (blob === null ? reject(new Error('PNG encoding failed')) : resolve(blob)), 'image/png')
  })
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
