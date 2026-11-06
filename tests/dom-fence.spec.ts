// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { detectTheme, findInfographicBlocks, installFenceChannel, isPlausibleSurface, type Channel } from '../src/client/index.ts'

const BAR = '{"infographic":"bar","title":"T","categories":["a","b"],"series":[{"name":"s","data":[1,2]}]}'

function block(label: string, body: string, className = 'md-code-block'): string {
  return `<div class="${className}"><div data-code-block-banner><span>${label}</span></div><pre><code></code></pre></div>`.replace('<code></code>', `<code>${body.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code>`)
}

function row(inner: string, streaming = false): string {
  return `<div data-chat-flow-kind="assistant-step"${streaming ? ' data-streaming' : ''}>${inner}</div>`
}

let channel: Channel | undefined
const wait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

beforeEach(() => {
  document.body.innerHTML = ''
  document.body.removeAttribute('data-ds-dark-theme')
})

afterEach(() => {
  channel?.dispose()
  channel = undefined
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
    expect([...host?.querySelectorAll('.dsh-ig-bar button') ?? []].map(button => button.textContent)).toEqual(['Copy SVG', 'Download SVG', 'Download PNG', 'Source'])
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
    expect(host.querySelectorAll('.dsh-ig-bar button')).toHaveLength(4)
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

  it('exports a standalone svg through the download button', async () => {
    document.body.innerHTML = row(block('infographic', BAR))
    const created: Blob[] = []
    URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => {
      created.push(blob as Blob)
      return 'blob:test'
    })
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    channel = installFenceChannel({ locale: 'en' })
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-infographic-host] .dsh-ig-bar button')]
    buttons.find(button => button.textContent === 'Download SVG')?.click()
    await wait(10)
    expect(created).toHaveLength(1)
    const text = await new Promise<string>(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.readAsText(created[0] as Blob)
    })
    expect(text).toMatch(/^<\?xml/)
    expect(text).toContain('width="680"')
  })

  it('toggles the source view', () => {
    document.body.innerHTML = row(block('infographic', BAR))
    channel = installFenceChannel({ locale: 'en' })
    const source = document.querySelector('.dsh-ig-source') as HTMLElement
    expect(source.hidden).toBe(true)
    const toggle = [...document.querySelectorAll<HTMLButtonElement>('.dsh-ig-bar button')].find(button => button.textContent === 'Source')
    toggle?.click()
    expect(source.hidden).toBe(false)
    expect(source.textContent).toBe(BAR)
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

describe('detectTheme', () => {
  it('reads light text as a dark page', () => {
    document.body.innerHTML = '<div id="t" style="color: rgb(240, 240, 240)"></div>'
    expect(detectTheme(document.getElementById('t') as Element)).toBe('dark')
    document.body.innerHTML = '<div id="t" style="color: rgb(20, 20, 20)"></div>'
    expect(detectTheme(document.getElementById('t') as Element)).toBe('light')
  })
})
