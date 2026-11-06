import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE, PALETTES, STYLES, isStyle, type Neutrals, type StylePalette } from '../src/core/palettes.ts'
import { RAMPS, type Ramp } from '../src/core/types.ts'

const HEX = /^#[0-9A-Fa-f]{6}$/
const NEUTRAL_COLOR = /^(#[0-9A-Fa-f]{6}|rgba\(\d+,\d+,\d+,0?\.\d+\))$/

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
}

function channel(value: number): number {
  const v = value / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

/** WCAG relative luminance: the ordering this test asserts is perceptual, not raw channel order. */
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

function hsl(hex: string): { h: number; s: number } {
  const [r, g, b] = rgb(hex).map(v => v / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6)
    else if (max === g) h = 60 * ((b - r) / d + 2)
    else h = 60 * ((r - g) / d + 4)
  }
  return { h: ((h % 360) + 360) % 360, s: s * 100 }
}

const styles = Object.entries(PALETTES) as [string, StylePalette][]

describe('palette structure', () => {
  it('ships exactly the four contracted styles, with claude as the default', () => {
    expect(STYLES).toEqual(['claude', 'mckinsey', 'bcg', 'economist'])
    expect(Object.keys(PALETTES).sort()).toEqual([...STYLES].sort())
    expect(DEFAULT_STYLE).toBe('claude')
  })

  it('defines all nine ramps, seven stops each, every stop a valid #RRGGBB', () => {
    for (const [style, palette] of styles) {
      expect(Object.keys(palette.stops).sort(), `${style} ramp keys`).toEqual([...RAMPS].sort())
      for (const ramp of RAMPS) {
        const stops = palette.stops[ramp]
        expect(stops, `${style}/${ramp}`).toHaveLength(7)
        for (const stop of stops) expect(stop, `${style}/${ramp} stop`).toMatch(HEX)
      }
    }
  })

  it('separates ramps: claude by hue, the brand styles by hue or lightness', () => {
    // claude is the frozen baseline: nine categorical hues, and its own tightest pair (coral/red)
    // measures 14.6°, so 12° is the floor there.
    const claude = RAMPS.filter(r => r !== 'gray').map(r => {
      const { h, s } = hsl(PALETTES.claude.stops[r][3])
      expect(s, `claude/${r} 400-stop saturation`).toBeGreaterThanOrEqual(35)
      return { r, h }
    })
    for (let i = 0; i < claude.length; i++) {
      for (let j = i + 1; j < claude.length; j++) {
        const raw = Math.abs(claude[i]!.h - claude[j]!.h)
        expect(
          Math.min(raw, 360 - raw),
          `claude: ${claude[i]!.r} vs ${claude[j]!.r} hue gap`,
        ).toBeGreaterThanOrEqual(12)
      }
    }

    // The three brand styles are near-monochromatic *on purpose*: every cycle ramp sits in the
    // brand's own hue family, because that is what a real McKinsey / BCG / Economist exhibit looks
    // like. So hue alone cannot separate them here. Two cycle ramps may share a hue — but then they
    // must differ in lightness, or two series would render as the same colour.
    for (const style of ['mckinsey', 'bcg', 'economist'] as const) {
      const pts = PALETTES[style].cycle.map(r => {
        const hex = PALETTES[style].stops[r][3]
        return { r, ...hsl(hex), l: luminance(hex) }
      })
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const raw = Math.abs(pts[i]!.h - pts[j]!.h)
          const hueGap = Math.min(raw, 360 - raw)
          const lumGap = Math.abs(pts[i]!.l - pts[j]!.l)
          expect(
            hueGap >= 18 || lumGap >= 0.06,
            `${style}: ${pts[i]!.r} vs ${pts[j]!.r} — hue ${hueGap.toFixed(0)}°, lightness ${lumGap.toFixed(3)}`,
          ).toBe(true)
        }
      }
    }
  })

  it('darkens monotonically from stop 50 to stop 900', () => {
    for (const [style, palette] of styles) {
      for (const ramp of RAMPS) {
        const stops = palette.stops[ramp]
        const lums = stops.map(luminance)
        for (let i = 1; i < lums.length; i++) {
          expect(lums[i]!, `${style}/${ramp}: ${stops[i - 1]} -> ${stops[i]}`).toBeLessThan(lums[i - 1]!)
        }
        expect(Math.max(...lums), `${style}/${ramp} lightest stop`).toBe(lums[0])
        expect(Math.min(...lums), `${style}/${ramp} darkest stop`).toBe(lums[6])
      }
    }
  })

  it('leads each cycle with the brand ramp and keeps the real brand anchors as stops', () => {
    expect(PALETTES.claude.cycle[0]).toBe('purple')
    expect(PALETTES.mckinsey.cycle[0]).toBe('blue')
    expect(PALETTES.bcg.cycle[0]).toBe('green')
    // The Economist leads with its masthead red: the reference treats #E3120B as a layout colour,
    // but it is also the only thing that makes the style recognisable, so it heads the cycle *and*
    // paints the masthead. The editorial blue follows as series 2.
    expect(PALETTES.economist.cycle[0]).toBe('red')
    expect(PALETTES.economist.accent).toBe('red')
    expect(PALETTES.mckinsey.accent).toBeUndefined()
    expect(PALETTES.bcg.accent).toBeUndefined()

    // Anchors lifted from the real exhibit palettes (huangzhenhao90/data-visualization), not invented.
    expect(PALETTES.mckinsey.stops.blue).toContain('#2CBDEF')
    expect(PALETTES.mckinsey.stops.gray).toContain('#D4D4D4')
    expect(PALETTES.mckinsey.light.text1).toBe('#051C2C')
    expect(PALETTES.bcg.stops.green).toContain('#2CA02C')
    expect(PALETTES.economist.stops.blue).toContain('#006BA2')
    expect(PALETTES.economist.stops.red).toContain('#E3120B')
    expect(PALETTES.economist.light.text1).toBe('#121212')
  })
})

describe('claude regression guard', () => {
  // Inlined from src/core/theme.ts (STOPS / LIGHT / DARK / DEFAULT_CYCLE) on purpose: those constants
  // are module-private there, and theme.ts is owned by the integration task, so this test must not
  // reach into it. Any drift in PALETTES.claude breaks this test instead of silently re-theming users.
  const STOPS: Record<Ramp, readonly string[]> = {
    purple: ['#EEEDFE', '#CECBF6', '#AFA9EC', '#7F77DD', '#534AB7', '#3C3489', '#26215C'],
    teal: ['#E1F5EE', '#9FE1CB', '#5DCAA5', '#1D9E75', '#0F6E56', '#085041', '#04342C'],
    coral: ['#FAECE7', '#F5C4B3', '#F0997B', '#D85A30', '#993C1D', '#712B13', '#4A1B0C'],
    pink: ['#FBEAF0', '#F4C0D1', '#ED93B1', '#D4537E', '#993556', '#72243E', '#4B1528'],
    gray: ['#F1EFE8', '#D3D1C7', '#B4B2A9', '#888780', '#5F5E5A', '#444441', '#2C2C2A'],
    blue: ['#E6F1FB', '#B5D4F4', '#85B7EB', '#378ADD', '#185FA5', '#0C447C', '#042C53'],
    green: ['#EAF3DE', '#C0DD97', '#97C459', '#639922', '#3B6D11', '#27500A', '#173404'],
    amber: ['#FAEEDA', '#FAC775', '#EF9F27', '#BA7517', '#854F0B', '#633806', '#412402'],
    red: ['#FCEBEB', '#F7C1C1', '#F09595', '#E24B4A', '#A32D2D', '#791F1F', '#501313'],
  }
  const LIGHT: Neutrals = {
    text1: '#2C2C2A', text2: '#5F5E5A', text3: '#888780',
    grid: 'rgba(0,0,0,0.08)', edge: '#888780', axis: '#B4B2A9', surface: '#FFFFFF', card: '#F1EFE8',
  }
  const DARK: Neutrals = {
    text1: '#E8E6DF', text2: '#B4B2A9', text3: '#888780',
    grid: 'rgba(255,255,255,0.09)', edge: '#B4B2A9', axis: '#5F5E5A', surface: '#262624', card: '#2C2C2A',
  }
  const DEFAULT_CYCLE: readonly Ramp[] = ['purple', 'teal', 'coral', 'blue', 'pink', 'amber', 'green', 'gray', 'red']

  it('reproduces theme.ts stops value for value', () => {
    for (const ramp of RAMPS) {
      expect([...PALETTES.claude.stops[ramp]], `claude/${ramp}`).toEqual([...STOPS[ramp]!])
    }
  })

  it('reproduces theme.ts light and dark neutrals value for value', () => {
    expect(PALETTES.claude.light).toEqual(LIGHT)
    expect(PALETTES.claude.dark).toEqual(DARK)
  })

  it('reproduces DEFAULT_CYCLE and the documented claude extras', () => {
    expect([...PALETTES.claude.cycle]).toEqual([...DEFAULT_CYCLE])
    expect(PALETTES.claude.paper).toEqual({ light: '#FFFFFF', dark: '#1F1F1E' })
    expect(PALETTES.claude.positive).toBe('green')
    expect(PALETTES.claude.negative).toBe('red')
  })
})

describe('cycle, ramp references and isStyle', () => {
  it('cycles every ramp exactly once', () => {
    for (const [style, palette] of styles) {
      expect(palette.cycle, `${style} cycle`).toHaveLength(RAMPS.length)
      expect(new Set(palette.cycle).size, `${style} cycle duplicates`).toBe(RAMPS.length)
      expect([...palette.cycle].sort(), `${style} cycle coverage`).toEqual([...RAMPS].sort())
    }
  })

  it('points positive and negative at real ramps', () => {
    for (const [style, palette] of styles) {
      expect(RAMPS, `${style} positive`).toContain(palette.positive)
      expect(RAMPS, `${style} negative`).toContain(palette.negative)
      expect(palette.positive, `${style} positive !== negative`).not.toBe(palette.negative)
    }
  })

  it('accepts exactly the four style ids', () => {
    for (const style of STYLES) expect(isStyle(style), style).toBe(true)
    for (const junk of ['Claude', 'CLAUDE', 'default', 'mckinsey ', '', 'bcg2', null, undefined, 42, {}, [], true]) {
      expect(isStyle(junk), String(junk)).toBe(false)
    }
  })
})

describe('neutrals', () => {
  const KEYS: (keyof Neutrals)[] = ['text1', 'text2', 'text3', 'grid', 'edge', 'axis', 'surface', 'card']

  it('fills every neutral slot in both themes with a valid colour', () => {
    for (const [style, palette] of styles) {
      for (const [theme, neutrals] of [['light', palette.light], ['dark', palette.dark]] as const) {
        expect(Object.keys(neutrals).sort(), `${style}/${theme} keys`).toEqual([...KEYS].sort())
        for (const key of KEYS) expect(neutrals[key], `${style}/${theme}/${key}`).toMatch(NEUTRAL_COLOR)
      }
    }
  })

  it('hand-tunes dark instead of inverting light, and keeps text1 readable on each surface', () => {
    for (const [style, palette] of styles) {
      expect(palette.dark.text1, `${style} dark text1 is its own value`).not.toBe(palette.light.text1)
      expect(luminance(palette.dark.surface), `${style} dark surface is dark`).toBeLessThan(0.2)
      expect(luminance(palette.light.surface), `${style} light surface is light`).toBeGreaterThan(0.8)
      expect(contrast(palette.light.text1, palette.light.surface), `${style} light text1`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(palette.dark.text1, palette.dark.surface), `${style} dark text1`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('gives every style a valid paper colour for both themes', () => {
    for (const [style, palette] of styles) {
      expect(palette.paper.light, `${style} paper.light`).toMatch(HEX)
      expect(palette.paper.dark, `${style} paper.dark`).toMatch(HEX)
      expect(luminance(palette.paper.light), `${style} paper.light`).toBeGreaterThan(0.8)
      expect(luminance(palette.paper.dark), `${style} paper.dark`).toBeLessThan(0.2)
    }
  })
})
