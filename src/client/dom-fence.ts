/**
 * DOM fence channel. The stock DSH host renders every fenced block through its own
 * code-block surface; this channel finds the `infographic` ones, hides the host block
 * and mounts a plugin-owned container with the rendered SVG next to it.
 *
 * The discovery heuristics (surface selectors, "one pre + no block content", banner label
 * as a leaf outside the pre, streaming marker, repair after host re-renders) follow the
 * approach of dsh-genui's dom-fence (MIT) — see THIRD_PARTY_NOTICES.md.
 */
import { looksLikeInfographic, readFence, renderSvg } from '../core/index.ts'
import type { InfographicSpec } from '../core/index.ts'
import { DEFAULT_STYLE, STYLES, isStyle, type StyleName } from '../core/palettes.ts'
import { copyPng, copyText, download, exportSvg, fileStem, svgToPngBlob, withStyle } from './export.ts'
import { detectLocale, label, styleLabel, type LabelKey, type Locale } from './i18n.ts'
import { CSS, STYLE_ID } from './styles.ts'

const SURFACES = '.md-code-block, .code-block, .code-block-small'
const STREAMING = '[data-streaming]'
const HOST_ATTR = 'data-infographic-host'
const DIAG_ATTR = 'data-infographic-diagnostic'
const TAKEN_ATTR = 'data-infographic-taken'
const EXCLUDES = [
  `[${HOST_ATTR}]`,
  `[${DIAG_ATTR}]`,
  '[data-chat-group-part="reasoning"]',
  '[data-tool]',
  '[data-sidebar-chat]',
  '[data-sidebar-right-session]',
  '[data-sidebar-right-panel]',
  '[data-panel-conversation]',
  '[data-plugin-panel]',
].join(', ')
const BLOCK_CONTENT = 'p, ul, ol, dl, table, h1, h2, h3, h4, h5, h6, blockquote, hr, img, figure'
const SURFACE_HOPS = 4
const CHROME_TEXT_LIMIT = 80
const SCAN_DELAY_MS = 80
const SWEEP_MS = 1000
const INLINE_CROP_X = 26
const INLINE_CROP_Y = 8
/** Where the viewer's last explicit style pick is remembered between sessions. */
export const STYLE_STORAGE_KEY = 'dsh-infographic:style'
export const FREQ_STORAGE_KEY = 'dsh-infographic:frequency'
const STYLE_SELECT = 'select.dsh-ig-style'

export interface ChannelOptions {
  doc?: Document
  locale?: Locale
  sweepMs?: number
  /** Persistence for the style picker. `null` disables it; omitted → `window.localStorage`. */
  storage?: Storage | null
  log?: (message: string) => void
}

/** Narrow an unknown value to a known style id (storage and DOM values are untrusted). */
function asStyle(value: unknown): StyleName | null {
  return STYLES.find(style => style === value) ?? null
}

function normalizeLabel(text: string): string {
  return text.trim().replace(/[\s>:;,.]+$/u, '').toLowerCase()
}

function preOf(block: Element): HTMLElement | null {
  return block.querySelector('pre')
}

function labelOf(block: Element): string {
  const pre = preOf(block)
  for (const element of block.querySelectorAll('*')) {
    if (element.childElementCount !== 0) continue
    if (pre !== null && pre.contains(element)) continue
    return normalizeLabel(element.textContent ?? '')
  }
  return ''
}

function rawOf(block: Element): string {
  return preOf(block)?.textContent ?? ''
}

function isSettled(block: Element): boolean {
  return block.closest(STREAMING) === null
}

/** A surface is "banner chrome + ONE code body"; anything with prose or several bodies is a message container. */
export function isPlausibleSurface(candidate: Element): boolean {
  const pres = candidate.querySelectorAll('pre')
  if (pres.length !== 1) return false
  const pre = pres[0] as HTMLElement
  for (const element of candidate.querySelectorAll(BLOCK_CONTENT)) {
    if (!pre.contains(element)) return false
  }
  const chrome = (candidate.textContent ?? '').length - (pre.textContent ?? '').length
  return chrome <= CHROME_TEXT_LIMIT
}

function knownSurfaces(scope: ParentNode): HTMLElement[] {
  const found = new Set<HTMLElement>(scope.querySelectorAll<HTMLElement>(SURFACES))
  for (const content of scope.querySelectorAll<HTMLElement>('[data-code-block-content]')) {
    if (content.parentElement !== null) found.add(content.parentElement)
  }
  return [...found]
}

function eligible(block: Element): boolean {
  if (block.closest(EXCLUDES) !== null) return false
  if (!isPlausibleSurface(block)) return false
  return labelOf(block) === 'infographic' || looksLikeInfographic(rawOf(block))
}

/** Every host block in `scope` that holds an infographic fence, in document order. */
export function findInfographicBlocks(scope: ParentNode): HTMLElement[] {
  const found = new Set<HTMLElement>()
  const claimed = new WeakSet<Element>()
  for (const surface of knownSurfaces(scope)) {
    for (const pre of surface.querySelectorAll('pre')) claimed.add(pre)
    if (eligible(surface)) found.add(surface)
  }
  for (const pre of scope.querySelectorAll<HTMLElement>('pre')) {
    if (claimed.has(pre) || pre.closest(EXCLUDES) !== null) continue
    let element: HTMLElement | null = pre.parentElement
    for (let hops = 0; element !== null && hops < SURFACE_HOPS; hops += 1, element = element.parentElement) {
      if (!isPlausibleSurface(element)) break
      if (eligible(element)) {
        found.add(element)
        break
      }
    }
  }
  return [...found].sort((left, right) => (left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
}

function luminance(color: string): number | null {
  const match = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/u.exec(color)
  if (match === null) return null
  const [red, green, blue] = [Number(match[1]), Number(match[2]), Number(match[3])]
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
}

/** Light text on the host means a dark page. */
export function detectTheme(element: Element): 'light' | 'dark' {
  const doc = element.ownerDocument
  if (doc.body.hasAttribute('data-ds-dark-theme')) return 'dark'
  const view = doc.defaultView
  if (view === null) return 'light'
  const value = luminance(view.getComputedStyle(element).color)
  return value !== null && value > 0.6 ? 'dark' : 'light'
}

interface Mount {
  block: HTMLElement
  container: HTMLElement
  stage: HTMLElement
  bar: HTMLElement
  source: HTMLElement
  prefix: string
  key: string
  spec: InfographicSpec | null
  theme: 'light' | 'dark'
}

interface Diagnostic {
  element: HTMLElement
  raw: string
}

export interface Channel {
  /** Scan the document now (the observer and sweep call this for you). */
  scan(): void
  dispose(): void
}

export function installFenceChannel(options: ChannelOptions = {}): Channel {
  const doc = options.doc ?? document
  const locale = options.locale ?? detectLocale(doc)
  const log = options.log ?? ((message: string) => console.warn(`[infographic] ${message}`))
  const text = (key: LabelKey): string => label(locale, key)
  const view = doc.defaultView
  const mounts = new Map<HTMLElement, Mount>()
  const diagnostics = new Map<HTMLElement, Diagnostic>()
  let counter = 0
  let disposed = false
  let scanTimer: ReturnType<typeof setTimeout> | undefined
  let repairQueued = false

  if (doc.getElementById(STYLE_ID) === null) {
    const style = doc.createElement('style')
    style.id = STYLE_ID
    style.textContent = CSS
    doc.head.append(style)
  }

  const storage: Storage | null =
    options.storage !== undefined
      ? options.storage
      : ((): Storage | null => {
          try {
            return view?.localStorage ?? null
          } catch {
            return null // storage can throw on access in sandboxed/partitioned contexts
          }
        })()

  /** The viewer's pick in this page load. Null until they touch the dropdown. */
  let userStyle: StyleName | null = null
  /** Last persisted pick, used only for specs that do not name a style of their own. */
  let storedStyle: StyleName | null = null
  try {
    storedStyle = asStyle(storage?.getItem(STYLE_STORAGE_KEY))
  } catch {
    storedStyle = null
  }

  const syncRemoteConfig = (patch: { defaultStyle?: StyleName }): void => {
    try {
      if (typeof fetch !== 'undefined') {
        void fetch('/api/infographic/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patch }),
        }).catch(() => {})
      }
    } catch {
      /* fetch not available */
    }
  }

  // Attempt initial sync with host configuration endpoint
  try {
    if (typeof fetch !== 'undefined') {
      void fetch('/api/infographic/config')
        .then(r => r.json())
        .then((res: any) => {
          if (res?.ok && res.config) {
            if (isStyle(res.config.defaultStyle) && userStyle === null && storedStyle === null) {
              const remoteStyle = res.config.defaultStyle
              storedStyle = remoteStyle
              try {
                storage?.setItem(STYLE_STORAGE_KEY, remoteStyle)
              } catch {}
            }
          }
        })
        .catch(() => {})
    }
  } catch {}

  /**
   * Cascade for one image: the viewer's explicit pick (this page load) > the style the chart
   * author wrote into the spec > the persisted pick > `claude`.
   */
  const styleFor = (spec: InfographicSpec): StyleName => userStyle ?? asStyle(spec.style) ?? storedStyle ?? DEFAULT_STYLE

  const button = (caption: string, onClick: (self: HTMLButtonElement) => void | Promise<void>): HTMLButtonElement => {
    const element = doc.createElement('button')
    element.type = 'button'
    element.textContent = caption
    element.addEventListener('click', () => {
      void Promise.resolve(onClick(element))
    })
    return element
  }

  const flash = (self: HTMLButtonElement, caption: string): void => {
    const original = self.dataset.caption ?? self.textContent ?? ''
    self.dataset.caption = original
    self.textContent = caption
    setTimeout(() => {
      self.textContent = original
    }, 1200)
  }

  const guarded = (self: HTMLButtonElement, action: () => Promise<void> | void, success?: string): Promise<void> =>
    Promise.resolve()
      .then(action)
      .then(
        () => {
          if (success !== undefined) flash(self, success)
        },
        (error: unknown) => {
          flash(self, text('failed'))
          log(`export failed: ${error instanceof Error ? error.message : String(error)}`)
        },
      )

  /** Style dropdown. Every mount carries one; they are kept in sync by `applyStyle`. */
  const styleSelect = (): HTMLSelectElement => {
    const select = doc.createElement('select')
    select.className = 'dsh-ig-style'
    select.setAttribute('aria-label', text('style'))
    select.title = text('style')
    for (const style of STYLES) {
      const option = doc.createElement('option')
      option.value = style
      option.textContent = styleLabel(locale, style)
      select.append(option)
    }
    select.value = userStyle ?? storedStyle ?? DEFAULT_STYLE
    select.addEventListener('change', () => applyStyle(select.value))
    return select
  }

  /** Remember an explicit pick and repaint every mounted image with it. */
  const applyStyle = (value: unknown): void => {
    const style = asStyle(value)
    if (style === null) return
    userStyle = style
    storedStyle = style
    try {
      storage?.setItem(STYLE_STORAGE_KEY, style)
    } catch {
      /* private mode or storage disabled: the pick still applies to this page load */
    }
    syncRemoteConfig({ defaultStyle: style })
    for (const select of doc.querySelectorAll<HTMLSelectElement>(STYLE_SELECT)) select.value = style
    for (const block of mounts.keys()) render(block)
  }

  const buildBar = (mount: Mount): void => {
    mount.bar.replaceChildren()
    const spec = mount.spec
    if (spec === null) return
    const stem = fileStem(spec)
    const theme = (): 'light' | 'dark' => mount.theme
    const style = (): StyleName => styleFor(spec)
    mount.bar.append(
      button(text('copyPng'), self => guarded(self, () => copyPng(spec, theme(), style(), doc), text('copied'))),
      button(text('downloadPng'), self => guarded(self, async () => download(`${stem}.png`, await svgToPngBlob(spec, theme(), style(), doc), doc))),
      button(text('copySvg'), self => guarded(self, () => copyText(exportSvg(spec, theme(), style()), doc), text('copied'))),
      button(text('downloadSvg'), self => guarded(self, () => download(`${stem}.svg`, new Blob([exportSvg(spec, theme(), style())], { type: 'image/svg+xml' }), doc))),
      button(text('source'), self => {
        const open = mount.source.hidden
        mount.source.hidden = !open
        self.textContent = open ? text('hideSource') : text('source')
      }),
      styleSelect(),
    )
  }

  const insertBefore = (block: HTMLElement, element: HTMLElement): void => {
    block.parentNode?.insertBefore(element, block)
  }

  const clearDiagnostic = (block: HTMLElement): void => {
    diagnostics.get(block)?.element.remove()
    diagnostics.delete(block)
  }

  const createMount = (block: HTMLElement): Mount => {
    counter += 1
    const container = doc.createElement('div')
    container.setAttribute(HOST_ATTR, '')
    const stage = doc.createElement('div')
    stage.className = 'dsh-ig-stage'
    const bar = doc.createElement('div')
    bar.className = 'dsh-ig-bar'
    const source = doc.createElement('pre')
    source.className = 'dsh-ig-source'
    source.hidden = true
    container.append(stage, bar, source)
    const mount: Mount = { block, container, stage, bar, source, prefix: `ig-${counter}`, key: '', spec: null, theme: 'light' }
    insertBefore(block, container)
    block.style.display = 'none'
    block.setAttribute(TAKEN_ATTR, '')
    mounts.set(block, mount)
    return mount
  }

  const release = (block: HTMLElement): void => {
    const mount = mounts.get(block)
    if (mount === undefined) return
    mount.container.remove()
    mounts.delete(block)
    if (block.isConnected) {
      block.style.removeProperty('display')
      block.removeAttribute(TAKEN_ATTR)
    }
  }

  const paint = (mount: Mount, spec: InfographicSpec): void => {
    mount.theme = detectTheme(mount.container)
    const style = styleFor(spec)
    const { svg } = renderSvg(withStyle(spec, style), { idPrefix: mount.prefix, style })
    mount.stage.innerHTML = svg
    mount.container.dataset.style = style
    const element = mount.stage.querySelector('svg')
    element?.setAttribute('data-theme', mount.theme)
    const box = element?.getAttribute('viewBox')?.split(' ').map(Number)
    if (element !== undefined && element !== null && box?.length === 4 && box.every(Number.isFinite)) {
      const [, , width, height] = box as [number, number, number, number]
      element.setAttribute('viewBox', `${INLINE_CROP_X} ${INLINE_CROP_Y} ${width - 2 * INLINE_CROP_X} ${height - 2 * INLINE_CROP_Y}`)
    }
  }

  const render = (block: HTMLElement): void => {
    const raw = rawOf(block)
    const settled = isSettled(block)
    const activeStyle = userStyle ?? storedStyle ?? DEFAULT_STYLE
    const key = `${settled ? 's' : 'p'}|${activeStyle}|${raw}`
    const existing = mounts.get(block)
    if (existing !== undefined && existing.key === key && existing.stage.firstElementChild !== null) return
    const result = readFence(raw, { streaming: !settled, resolveStyle: own => userStyle ?? own ?? storedStyle ?? DEFAULT_STYLE })
    if (result.status === 'pending') return
    if (result.status === 'error') {
      release(block)
      const known = diagnostics.get(block)
      if (known !== undefined && known.raw === raw && known.element.isConnected) return
      clearDiagnostic(block)
      const element = doc.createElement('div')
      element.setAttribute(DIAG_ATTR, '')
      const reason = text(result.code === 'json' ? 'errorJson' : result.code === 'kind' ? 'errorKind' : 'errorEmpty')
      element.textContent = `${text('diagnostic')}：${reason}。${text('diagnosticHint')}`
      insertBefore(block, element)
      diagnostics.set(block, { element, raw })
      log(`${result.error}`)
      return
    }
    clearDiagnostic(block)
    const mount = existing ?? createMount(block)
    mount.key = key
    mount.spec = result.spec
    paint(mount, result.spec)
    mount.source.textContent = raw
    mount.container.dataset.infographic = result.spec.infographic
    mount.container.dataset.state = settled ? 'settled' : 'streaming'
    mount.bar.replaceChildren()
    if (settled) {
      buildBar(mount)
      if (result.warnings.length > 0) {
        const note = doc.createElement('span')
        note.className = 'dsh-ig-warn'
        note.textContent = `⚠ ${text('warnings')}`
        note.title = result.warnings.join('\n')
        mount.bar.append(note)
      }
    }
  }

  const repair = (): void => {
    for (const [block, mount] of [...mounts]) {
      if (!block.isConnected) {
        release(block)
        continue
      }
      if (mount.container.nextSibling !== block || mount.container.parentNode !== block.parentNode) insertBefore(block, mount.container)
      if (block.style.display !== 'none') block.style.display = 'none'
      if (mount.stage.firstElementChild === null && mount.spec !== null) paint(mount, mount.spec)
    }
    for (const [block, diagnostic] of [...diagnostics]) {
      if (!block.isConnected) {
        diagnostic.element.remove()
        diagnostics.delete(block)
      } else if (!diagnostic.element.isConnected) insertBefore(block, diagnostic.element)
    }
  }

  const syncTheme = (): void => {
    for (const mount of mounts.values()) {
      const theme = detectTheme(mount.container)
      if (theme === mount.theme) continue
      mount.theme = theme
      mount.stage.querySelector('svg')?.setAttribute('data-theme', theme)
    }
  }

  const scan = (): void => {
    if (disposed) return
    repair()
    const current = new Set(findInfographicBlocks(doc))
    for (const block of current) render(block)
    for (const block of [...mounts.keys()]) if (!current.has(block) && block.isConnected) release(block)
    syncTheme()
  }

  const scheduleScan = (): void => {
    if (scanTimer !== undefined || disposed) return
    scanTimer = setTimeout(() => {
      scanTimer = undefined
      scan()
    }, SCAN_DELAY_MS)
  }

  const scheduleRepair = (): void => {
    if (repairQueued || disposed) return
    repairQueued = true
    queueMicrotask(() => {
      repairQueued = false
      if (!disposed) repair()
    })
  }

  const Observer = view?.MutationObserver ?? MutationObserver
  const observer = new Observer(records => {
    let relevant = false
    for (const record of records) {
      const target = record.target instanceof Element ? record.target : record.target.parentElement
      if (target?.closest(`[${HOST_ATTR}], [${DIAG_ATTR}]`) != null) continue
      relevant = true
      break
    }
    if (!relevant) return
    scheduleRepair()
    scheduleScan()
  })
  observer.observe(doc.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['data-streaming', 'style', 'class', 'data-ds-dark-theme'],
  })
  const sweep = setInterval(scan, options.sweepMs ?? SWEEP_MS)
  scan()

  return {
    scan,
    dispose(): void {
      disposed = true
      observer.disconnect()
      clearInterval(sweep)
      if (scanTimer !== undefined) clearTimeout(scanTimer)
      for (const block of [...mounts.keys()]) release(block)
      for (const diagnostic of diagnostics.values()) diagnostic.element.remove()
      diagnostics.clear()
      doc.getElementById(STYLE_ID)?.remove()
    },
  }
}
