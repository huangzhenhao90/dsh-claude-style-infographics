// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { detectLocale } from '../src/client/i18n.ts'
import { STYLE_EVENT, STYLE_STORAGE_KEY, createSettingsPanel, detectTheme, findInfographicBlocks, installFenceChannel, isPlausibleSurface, type Channel } from '../src/client/index.ts'
import { normalizeSpec, renderSvg } from '../src/core/index.ts'
import type { StyleName } from '../src/core/palettes.ts'

const BAR = '{"infographic":"bar","title":"T","categories":["a","b"],"series":[{"name":"s","data":[1,2]}]}'
const BCG_BAR = BAR.replace('"title":"T"', '"title":"T","style":"bcg"')

function block(label: string, body: string, className = 'md-code-block'): string {
  return `<div class="${className}"><div data-code-block-banner><span>${label}</span></div><pre><code></code></pre></div>`.replace('<code></code>', `<code>${body.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code>`)
}

function row(inner: string, streaming = false): string {
  return `<div data-chat-flow-kind="assistant-step"${streaming ? ' data-streaming' : ''}>${inner}</div>`
}

/** Palette custom properties of a rendered svg's own stylesheet — style-agnostic probe. */
function fills(css: string): string[] {
  return [...css.matchAll(/--ig-fill:(#[0-9A-Fa-f]{6})/g)].map(match => match[1] as string)
}

function mountedFills(host: Element): string[] {
  return fills(host.querySelector('svg')?.querySelector('style')?.textContent ?? '')
}

/** Same render the channel performs, used as an oracle for the palette actually in force. */
function coreFills(body: string, style: StyleName): string[] {
  const normalized = normalizeSpec(JSON.parse(body))
  if (!normalized.ok) throw new Error(normalized.error)
  const html = renderSvg({ ...normalized.spec, style }, { idPrefix: 'ig-1', style }).svg
  return fills(/<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? '')
}

function buttonNamed(name: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>('.dsh-ig-bar button')].find(button => button.textContent === name)
}

/** The vitest jsdom env exposes Node's webstorage global (no methods here), so tests inject their own. */
class MemoryStorage {
  private data = new Map<string, string>()
  get length(): number { return this.data.size }
  clear(): void { this.data.clear() }
  getItem(key: string): string | null { return this.data.get(key) ?? null }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null }
  removeItem(key: string): void { this.data.delete(key) }
  setItem(key: string, value: string): void { this.data.set(key, value) }
}

const asStorage = (store: MemoryStorage): Storage => store as unknown as Storage

let channel: Channel | undefined
let store: MemoryStorage
const wait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

beforeEach(() => {
  document.body.innerHTML = ''
  document.body.removeAttribute('data-ds-dark-theme')
  store = new MemoryStorage()
})

afterEach(() => {
  channel?.dispose()
  channel = undefined
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'clipboard')
})

describe('discovery', () => {
  it('finds a block by its banner label', () => {
    document.body.innerHTML = row(`<p>hi</p>${block('infographic', BAR)}`)
    expect(findInfographicBlocks(document)).toHaveLength(1)
  })

  it('finds an unlabelled block (host hides unknown languages) by content', () => {
    document.body.innerHTML = row(block('', BAR))
    expect(findInfographicBlocks(document)).toHaveLength(1)
    document.body.innerHTML = row(block('Code', BAR, 'code-block'))
    expect(findInfographicBlocks(document)).toHaveLength(1)
  })

  it('finds a labelled pre on a surface with an unknown class (structural fallback)', () => {
    document.body.innerHTML = row(`<section><div class="weird"><div><span>infographic</span></div><pre>${BAR}</pre></div></section>`)
    expect(findInfographicBlocks(document)).toHaveLength(1)
  })

  it('ignores other languages and ordinary json', () => {
    document.body.innerHTML = row(block('python', 'print(1)') + block('json', '{"title":"x"}'))
    expect(findInfographicBlocks(document)).toHaveLength(0)
  })

  it('never takes over a message-level container that also holds prose', () => {
    document.body.innerHTML = row(`<div class="code-block"><p>some answer text</p><pre>${BAR}</pre></div>`)
    expect(findInfographicBlocks(document)).toHaveLength(0)
    document.body.innerHTML = row(`<div class="code-block"><pre>${BAR}</pre><pre>other</pre></div>`)
    expect(findInfographicBlocks(document)).toHaveLength(0)
  })

  it('skips reasoning, tool output and sidebars', () => {
    document.body.innerHTML = `<div data-chat-group-part="reasoning">${block('infographic', BAR)}</div><div data-tool>${block('infographic', BAR)}</div><div data-sidebar-chat>${block('infographic', BAR)}</div>`
    expect(findInfographicBlocks(document)).toHaveLength(0)
  })

  it('treats chrome with a lot of text as a container, not a surface', () => {
    document.body.innerHTML = `<div class="md-code-block"><span>${'x'.repeat(200)}</span><pre>${BAR}</pre></div>`
    expect(isPlausibleSurface(document.querySelector('.md-code-block') as Element)).toBe(false)
  })
})

describe('channel', () => {
  it('replaces the host block with an svg and keeps the surrounding text', () => {
    document.body.innerHTML = row(`<p>before</p>${block('infographic', BAR)}<p>after</p>`)
    channel = installFenceChannel({ locale: 'en' })
    const host = document.querySelector('[data-infographic-host]')
    expect(host?.querySelector('svg')).not.toBeNull()
    expect((document.querySelector('.md-code-block') as HTMLElement).style.display).toBe('none')
    expect(host?.nextElementSibling).toBe(document.querySelector('.md-code-block'))
    expect(document.body.textContent).toContain('before')
    expect(document.body.textContent).toContain('after')
    expect([...host?.querySelectorAll('.dsh-ig-bar button') ?? []].map(button => button.textContent)).toEqual(['Copy PNG', 'Download PNG'])
  })

  it('renders progressively while streaming, without a toolbar, then settles', () => {
    document.body.innerHTML = row(block('', BAR.slice(0, -3)), true)
    channel = installFenceChannel({ locale: 'en' })
    let host = document.querySelector('[data-infographic-host]') as HTMLElement
    expect(host.dataset.state).toBe('streaming')
    expect(host.querySelector('svg')).not.toBeNull()
    expect(host.querySelectorAll('.dsh-ig-bar button')).toHaveLength(0)

    ;(document.querySelector('code') as HTMLElement).textContent = BAR
    document.querySelector('[data-streaming]')?.removeAttribute('data-streaming')
    channel.scan()
    host = document.querySelector('[data-infographic-host]') as HTMLElement
    expect(host.dataset.state).toBe('settled')
    expect(host.querySelectorAll('.dsh-ig-bar button')).toHaveLength(2)
    expect(document.querySelectorAll('[data-infographic-host]')).toHaveLength(1)
  })

  it('leaves a streaming block alone until something is drawable', () => {
    document.body.innerHTML = row(block('', '{"infographic":"bar","title":"T"'), true)
    channel = installFenceChannel()
    expect(document.querySelector('[data-infographic-host]')).toBeNull()
    expect((document.querySelector('.md-code-block') as HTMLElement).style.display).not.toBe('none')
  })

  it('shows a diagnostic and keeps the code block when a settled fence is broken', () => {
    document.body.innerHTML = row(block('infographic', '{"infographic":"flow","nodes":'))
    channel = installFenceChannel({ locale: 'en', log: () => {} })
    expect(document.querySelectorAll('[data-infographic-diagnostic]')).toHaveLength(1)
    expect(document.querySelector('[data-infographic-diagnostic]')?.textContent).toContain('Nothing to draw')
    expect((document.querySelector('.md-code-block') as HTMLElement).style.display).not.toBe('none')
    channel.scan()
    expect(document.querySelectorAll('[data-infographic-diagnostic]')).toHaveLength(1)
  })

  it('repairs the mount after the host wipes it or resets the hide', async () => {
    document.body.innerHTML = row(block('infographic', BAR))
    channel = installFenceChannel({ sweepMs: 20 })
    const hostBlock = document.querySelector('.md-code-block') as HTMLElement
    document.querySelector('[data-infographic-host]')?.remove()
    hostBlock.style.display = ''
    await wait(80)
    expect(document.querySelectorAll('[data-infographic-host]')).toHaveLength(1)
    expect(hostBlock.style.display).toBe('none')
    document.querySelector('[data-infographic-host] .dsh-ig-stage')?.replaceChildren()
    await wait(80)
    expect(document.querySelector('[data-infographic-host] svg')).not.toBeNull()
  })

  it('tears the mount down when the host removes the block', async () => {
    document.body.innerHTML = row(block('infographic', BAR))
    channel = installFenceChannel({ sweepMs: 20 })
    document.querySelector('.md-code-block')?.remove()
    await wait(80)
    expect(document.querySelector('[data-infographic-host]')).toBeNull()
  })

  it('picks up blocks added later and gives each svg its own id prefix', async () => {
    channel = installFenceChannel({ sweepMs: 20 })
    document.body.insertAdjacentHTML('beforeend', row(block('infographic', BAR) + block('infographic', BAR.replace('"T"', '"U"'))))
    await wait(150)
    const classes = [...document.querySelectorAll('[data-infographic-host] svg')].map(svg => svg.getAttribute('class'))
    expect(classes).toHaveLength(2)
    expect(new Set(classes).size).toBe(2)
  })

  it('does not hide or touch other code blocks', () => {
    document.body.innerHTML = row(block('infographic', BAR) + block('python', 'print(1)'))
    channel = installFenceChannel()
    const python = [...document.querySelectorAll<HTMLElement>('.md-code-block')].find(element => element.textContent?.includes('python'))
    expect(python?.style.display).not.toBe('none')
  })

  it('syncs the theme with the host', () => {
    document.body.innerHTML = row(block('infographic', BAR))
    channel = installFenceChannel()
    expect(document.querySelector('[data-infographic-host] svg')?.getAttribute('data-theme')).toBe('light')
    document.body.setAttribute('data-ds-dark-theme', '')
    channel.scan()
    expect(document.querySelector('[data-infographic-host] svg')?.getAttribute('data-theme')).toBe('dark')
  })

  it('defaults to Chinese labels unless the UI is explicitly English', () => {
    expect(detectLocale(document.implementation.createHTMLDocument(''))).toBe(navigator.language.toLowerCase().startsWith('en') ? 'en' : 'zh')
    const zh = document.implementation.createHTMLDocument('')
    zh.documentElement.lang = 'zh-CN'
    expect(detectLocale(zh)).toBe('zh')
    const fr = document.implementation.createHTMLDocument('')
    fr.documentElement.lang = 'fr'
    expect(detectLocale(fr)).toBe('zh')
    const en = document.implementation.createHTMLDocument('')
    en.documentElement.lang = 'en-US'
    expect(detectLocale(en)).toBe('en')
  })

  it('still picks up a block whose text becomes an infographic after being skipped', () => {
    document.body.innerHTML = '<div class="msg"><div class="tool"><pre>plain output</pre></div></div>'
    channel = installFenceChannel({ locale: 'en', sweepMs: 100000 })
    expect(document.querySelector('[data-infographic-host]')).toBeNull()
    ;(document.querySelector('pre') as HTMLElement).textContent = BAR
    channel.scan(false)
    expect(document.querySelector('[data-infographic-host]')).not.toBeNull()
  })

  it('removes everything on dispose and restores the host block', () => {
    document.body.innerHTML = row(block('infographic', BAR))
    channel = installFenceChannel()
    channel.dispose()
    channel = undefined
    expect(document.querySelector('[data-infographic-host]')).toBeNull()
    expect(document.getElementById('dsh-infographic-style')).toBeNull()
    expect((document.querySelector('.md-code-block') as HTMLElement).style.display).not.toBe('none')
  })
})

describe('global default style', () => {
  it('gives each style a distinct palette (core integration)', () => {
    const claude = coreFills(BAR, 'claude')
    expect(claude.length).toBeGreaterThan(0)
    for (const style of ['mckinsey', 'bcg', 'economist'] as const) expect(coreFills(BAR, style)).not.toEqual(claude)
  })

  it('uses the persisted pick as the default for images that name no style', () => {
    store.setItem(STYLE_STORAGE_KEY, 'economist')
    document.body.innerHTML = row(block('infographic', BAR))
    channel = installFenceChannel({ locale: 'en', storage: asStorage(store) })
    const host = document.querySelector('[data-infographic-host]') as HTMLElement
    expect(host.dataset.style).toBe('economist')
    expect(mountedFills(host)).toEqual(coreFills(BAR, 'economist'))
  })

  it('ignores a junk persisted value', () => {
    store.setItem(STYLE_STORAGE_KEY, 'nordic')
    document.body.innerHTML = row(block('infographic', BAR))
    channel = installFenceChannel({ locale: 'en', storage: asStorage(store) })
    expect((document.querySelector('[data-infographic-host]') as HTMLElement).dataset.style).toBe('claude')
  })

  it('lets the style written into the spec win over the persisted default', () => {
    store.setItem(STYLE_STORAGE_KEY, 'economist')
    document.body.innerHTML = row(block('infographic', BCG_BAR))
    channel = installFenceChannel({ locale: 'en', storage: asStorage(store) })
    const host = document.querySelector('[data-infographic-host]') as HTMLElement
    expect(host.dataset.style).toBe('bcg')
    expect(mountedFills(host)).toEqual(coreFills(BCG_BAR, 'bcg'))
  })

  it('has no per-image style dropdown (style is a global setting)', () => {
    document.body.innerHTML = row(block('infographic', BAR))
    channel = installFenceChannel({ locale: 'en', storage: asStorage(store) })
    expect(document.querySelector('select')).toBeNull()
  })

  it('repaints every mounted image when the settings page announces a new default', () => {
    document.body.innerHTML = row(block('infographic', BCG_BAR) + block('infographic', BAR.replace('"T"', '"U"')))
    channel = installFenceChannel({ locale: 'en', storage: asStorage(store) })
    const hosts = () => [...document.querySelectorAll<HTMLElement>('[data-infographic-host]')]
    expect(hosts().map(host => host.dataset.style)).toEqual(['bcg', 'claude'])

    window.dispatchEvent(new CustomEvent(STYLE_EVENT, { detail: 'mckinsey' }))

    // The spec that names its own style keeps it; the one that does not follows the new default.
    expect(hosts().map(host => host.dataset.style)).toEqual(['bcg', 'mckinsey'])
    expect(mountedFills(hosts()[1] as HTMLElement)).toEqual(coreFills(BAR, 'mckinsey'))
    expect(store.getItem(STYLE_STORAGE_KEY)).toBe('mckinsey')
  })

  it('ignores a junk style announcement and still works without persistence', () => {
    document.body.innerHTML = row(block('infographic', BAR))
    channel = installFenceChannel({ locale: 'en', storage: null })
    window.dispatchEvent(new CustomEvent(STYLE_EVENT, { detail: 'nordic' }))
    expect((document.querySelector('[data-infographic-host]') as HTMLElement).dataset.style).toBe('claude')
    window.dispatchEvent(new CustomEvent(STYLE_EVENT, { detail: 'economist' }))
    expect((document.querySelector('[data-infographic-host]') as HTMLElement).dataset.style).toBe('economist')
  })

  it('applies a new default to images mounted later in the same page load', async () => {
    document.body.innerHTML = row(block('infographic', BAR))
    channel = installFenceChannel({ locale: 'en', sweepMs: 20, storage: asStorage(store) })
    window.dispatchEvent(new CustomEvent(STYLE_EVENT, { detail: 'bcg' }))
    document.body.insertAdjacentHTML('beforeend', row(block('infographic', BAR.replace('"T"', '"V"'))))
    await wait(120)
    const hosts = [...document.querySelectorAll<HTMLElement>('[data-infographic-host]')]
    expect(hosts).toHaveLength(2)
    expect(hosts.map(host => host.dataset.style)).toEqual(['bcg', 'bcg'])
  })

  it('re-cycles multi-series colours immediately when the default style changes', () => {
    const TWO_SERIES = '{"infographic":"bar","title":"T","categories":["a"],"series":[{"name":"s1","data":[1]},{"name":"s2","data":[2]}]}'
    document.body.innerHTML = row(block('infographic', TWO_SERIES))
    channel = installFenceChannel({ locale: 'en', storage: asStorage(store) })
    const host = document.querySelector('[data-infographic-host]') as HTMLElement

    expect(host.querySelector('.ig-r-purple')).not.toBeNull()
    expect(host.querySelector('.ig-r-teal')).not.toBeNull()

    window.dispatchEvent(new CustomEvent(STYLE_EVENT, { detail: 'bcg' }))

    expect(host.dataset.style).toBe('bcg')
    expect(host.querySelector('.ig-r-green')).not.toBeNull()
    expect(host.querySelector('.ig-r-teal')).not.toBeNull()
    expect(host.querySelector('.ig-r-purple')).toBeNull()
  })
})

describe('copy png', () => {
  it('writes an image/png clipboard item built from the pending rasterisation', async () => {
    document.body.innerHTML = row(block('infographic', BAR))
    class FakeClipboardItem {
      constructor(readonly payload: Record<string, unknown>) {}
    }
    const items: FakeClipboardItem[] = []
    vi.stubGlobal('ClipboardItem', FakeClipboardItem)
    const write = vi.fn(async (data: unknown[]) => {
      items.push(...(data as FakeClipboardItem[]))
    })
    Object.defineProperty(navigator, 'clipboard', { value: { write }, configurable: true })
    channel = installFenceChannel({ locale: 'en' })
    const copy = buttonNamed('Copy PNG')
    copy?.click()
    await wait(10)
    expect(write).toHaveBeenCalledTimes(1)
    expect(items).toHaveLength(1)
    expect(Object.keys(items[0]?.payload ?? {})).toEqual(['image/png'])
    // the item holds the *pending* rasterisation promise, the shape Safari requires
    expect(items[0]?.payload['image/png']).toBeInstanceOf(Promise)
    expect(copy?.textContent).toBe('Copied')
  })

  it('flashes a failure (and logs it) when the context cannot put images on the clipboard', async () => {
    document.body.innerHTML = row(block('infographic', BAR))
    const logs: string[] = []
    channel = installFenceChannel({ locale: 'en', log: message => logs.push(message) })
    const copy = buttonNamed('Copy PNG')
    copy?.click()
    await wait(10)
    expect(copy?.textContent).toBe('Failed')
    expect(logs.join('\n')).toMatch(/clipboard/i)
    await wait(1250)
    expect(copy?.textContent).toBe('Copy PNG')
  })
})

describe('settings section', () => {
  it('creates a settings panel factory for DSH settings slot', () => {
    const Panel = createSettingsPanel({ locale: { getLocale: () => ({ active: 'zh' }) } })
    expect(typeof Panel).toBe('function')
  })
})

describe('detectTheme', () => {
  it('reads light text as a dark page', () => {
    document.body.innerHTML = '<div id="t" style="color: rgb(240, 240, 240)"></div>'
    expect(detectTheme(document.getElementById('t') as Element)).toBe('dark')
    document.body.innerHTML = '<div id="t" style="color: rgb(20, 20, 20)"></div>'
    expect(detectTheme(document.getElementById('t') as Element)).toBe('light')
  })
})
