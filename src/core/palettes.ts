import type { Ramp } from './types.ts'

/**
 * Style palettes: a `style` dimension orthogonal to `theme` (light / dark / auto).
 *
 * Every style defines the same nine categorical ramps, each as seven stops in the fixed order
 * 50 / 100 / 200 / 400 / 600 / 800 / 900, light to dark.
 *
 * `claude` keeps nine deliberately separated hues, because there the ramp *is* the category encoding.
 * The three brand styles are different by design: they are near-monochromatic, and their `cycle`
 * ramps all sit in the brand's own hue family at different lightnesses — because that is what a real
 * McKinsey / BCG / Economist exhibit looks like (one brand colour, plus a neutral). A ramp name is a
 * *slot*, not a promise of hue: `blue` is a cyan-blue under `claude` and a deep green under `bcg`,
 * since the BCG language has no blue at all. Only the `cycle` ramps of the brand styles are
 * re-skinned this way; `red` / `green` / `amber` stay semantically red / green / amber in every
 * style, so +/- deltas and warning colours never lie.
 *
 * Data only: this module must stay free of `theme.ts` imports so the two never form a cycle.
 */

export const STYLES = ['claude', 'mckinsey', 'bcg', 'economist'] as const
export type StyleName = (typeof STYLES)[number]
export const DEFAULT_STYLE: StyleName = 'claude'

export interface Neutrals {
  text1: string
  text2: string
  text3: string
  grid: string
  edge: string
  axis: string
  surface: string
  card: string
}

export interface StylePalette {
  /** ramp -> 7 档，顺序固定 50/100/200/400/600/800/900（浅 → 深），值必须是 #RRGGBB */
  stops: Record<Ramp, readonly [string, string, string, string, string, string, string]>
  light: Neutrals
  dark: Neutrals
  /** spec 没写 color 时按这个顺序自动循环配色 */
  cycle: readonly Ramp[]
  /** 栅格化成 PNG 时的页面底色 */
  paper: { light: string; dark: string }
  /**
   * Masthead ramp, when the style has one. This is a *layout* colour, not a data colour: the
   * Economist paints a rule across the top and a square tag beside the title with it, and that
   * masthead is the single most recognisable thing about the style. Styles without a masthead
   * leave this undefined and render no chrome.
   */
  accent?: Ramp
  /** cards 里 delta 以 + 开头用的 ramp */
  positive: Ramp
  /** cards 里 delta 以 - 开头用的 ramp */
  negative: Ramp
}

type Ramp7 = readonly [string, string, string, string, string, string, string]

/** Byte-for-byte the ramps currently hard-coded in `theme.ts` (STOPS). Do not "improve" these. */
const CLAUDE_STOPS: Record<Ramp, Ramp7> = {
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

const CLAUDE_LIGHT: Neutrals = {
  text1: '#2C2C2A', text2: '#5F5E5A', text3: '#888780',
  grid: 'rgba(0,0,0,0.08)', edge: '#888780', axis: '#B4B2A9', surface: '#FFFFFF', card: '#F1EFE8',
}
const CLAUDE_DARK: Neutrals = {
  text1: '#E8E6DF', text2: '#B4B2A9', text3: '#888780',
  grid: 'rgba(255,255,255,0.09)', edge: '#B4B2A9', axis: '#5F5E5A', surface: '#262624', card: '#2C2C2A',
}

/**
 * McKinsey: anchored on the real exhibit palette — #2CBDEF (the cyan of "Top performers"),
 * #D4D4D4 (the grey of "Others"), #051C2C (body text). The reference is emphatic that this is a
 * two-colour language: highlight in cyan, comparison in grey, both carried through the whole report.
 * So the cycle opens on cyan and then walks *shades of the same blue*, never a second hue.
 */
const MCKINSEY_STOPS: Record<Ramp, Ramp7> = {
  blue: ['#E5F7FE', '#B2E8FA', '#79D4F3', '#2CBDEF', '#1D96C0', '#196A86', '#144658'],
  teal: ['#D7EEFD', '#8FCBF3', '#3FA2E2', '#1A5E8A', '#1A4866', '#153347', '#0F232F'],
  purple: ['#EDF5FA', '#CDE0EF', '#A8C7E0', '#7BA7CB', '#5084AF', '#3C5E7B', '#2A4052'],
  pink: ['#F5FBFE', '#E4F3FB', '#D0E9F7', '#B8DCF0', '#50A1CE', '#31759B', '#25516A'],
  coral: ['#E7F3FA', '#BAD9EE', '#88BADC', '#4A93C4', '#3B7297', '#2D526A', '#203747'],
  gray: ['#FBFBFB', '#F2F2F2', '#E7E7E7', '#D4D4D4', '#9F9F9F', '#727272', '#4F4F4F'],
  green: ['#E7F4EA', '#B9DBC1', '#85BD92', '#4E8A5C', '#40684A', '#2F4A35', '#213125'],
  amber: ['#FBF4E5', '#EFDCB5', '#DFC080', '#C79A3E', '#967636', '#695429', '#46391D'],
  red: ['#FDE3E0', '#F3AFA8', '#E3766B', '#C0392B', '#8E332A', '#632720', '#421C18'],
}

const MCKINSEY_LIGHT: Neutrals = {
  text1: '#051C2C', text2: '#425B76', text3: '#8C8C8C',
  grid: 'rgba(5,28,44,0.08)', edge: '#8C8C8C', axis: '#D4D4D4', surface: '#FFFFFF', card: '#F5F7F9',
}
const MCKINSEY_DARK: Neutrals = {
  text1: '#EAF2F8', text2: '#A8BECF', text3: '#7C93A5',
  grid: 'rgba(255,255,255,0.10)', edge: '#5A7080', axis: '#2A4052', surface: '#051C2C', card: '#0C2537',
}

/**
 * BCG: green #2CA02C is the only brand colour, and the reference says so explicitly. The cycle is
 * therefore shades of green plus a neutral; there is no second hue to fall back on.
 */
const BCG_STOPS: Record<Ramp, Ramp7> = {
  green: ['#DFFBDF', '#A3EDA3', '#61D961', '#2CA02C', '#297629', '#1F531F', '#163716'],
  teal: ['#D2FBE2', '#81EBAB', '#2ACF6C', '#14532D', '#184E2D', '#11311E', '#0B1E12'],
  blue: ['#EAF8EA', '#C1E8C1', '#94D494', '#5CB85C', '#479047', '#356635', '#254425'],
  amber: ['#F1F7EB', '#D5E6C7', '#B5D09D', '#8CB369', '#6D8E50', '#4E643B', '#354329'],
  purple: ['#D7FCEA', '#8DEFBF', '#3CDB8C', '#1B7A4B', '#1A5A3A', '#143F2A', '#0F2A1C'],
  pink: ['#F4FBF3', '#DEF2DC', '#C6E5C2', '#A8D5A2', '#73B36A', '#4E8547', '#385B33'],
  coral: ['#EEF9EE', '#CDECCF', '#A9DBAB', '#7BC47F', '#54A558', '#3E7541', '#2B4E2D'],
  gray: ['#F7F4F4', '#E7DEDE', '#D4C5C5', '#B0B0B0', '#9A7979', '#6E5757', '#4A3C3C'],
  red: ['#FDE3E0', '#F3AFA8', '#E3766B', '#C0392B', '#8E332A', '#632720', '#421C18'],
}

const BCG_LIGHT: Neutrals = {
  text1: '#1A1A1A', text2: '#444444', text3: '#767676',
  grid: 'rgba(0,0,0,0.06)', edge: '#000000', axis: '#000000', surface: '#FFFFFF', card: '#F4F6F4',
}
const BCG_DARK: Neutrals = {
  text1: '#EAF4EC', text2: '#A9C3AE', text3: '#7A9680',
  grid: 'rgba(255,255,255,0.10)', edge: '#9FB8A4', axis: '#4E6B54', surface: '#0C1F17', card: '#12291F',
}

/**
 * The Economist: the reference is blunt that #E3120B is a *layout* colour — the red rule across the
 * top and the red square tag — not a data colour. The series palette is blue #006BA2, cyan #3EBCD2,
 * green #379A8B, yellow #EBB434 and grey #758D99. So the cycle leads with the editorial blue, and
 * `red` stays available for emphasis or as the negative delta colour.
 */
const ECONOMIST_STOPS: Record<Ramp, Ramp7> = {
  blue: ['#D7F0FD', '#89D2F7', '#32AEED', '#006BA2', '#095176', '#093952', '#082636'],
  teal: ['#E5F9FD', '#B5EAF4', '#80D7E6', '#3EBCD2', '#3192A3', '#266772', '#1C444B'],
  green: ['#E1F8F5', '#ABE7DE', '#6DD0C1', '#379A8B', '#307369', '#24514A', '#1A3631'],
  amber: ['#FEF7E5', '#FAE5B4', '#F4D07C', '#EBB434', '#BF8F21', '#85651C', '#584415'],
  gray: ['#EEF2F4', '#CCD6DB', '#A6B6BF', '#758D99', '#5B6E78', '#434F55', '#2E3539'],
  red: ['#FEE1E0', '#F9A6A3', '#F1645F', '#E3120B', '#A51914', '#731512', '#4C110F'],
  purple: ['#ECE7F6', '#C8BAE1', '#9E87C7', '#6B4E9E', '#554177', '#3D3054', '#2A2238'],
  pink: ['#FDF5F8', '#F8E2EB', '#F2CEDB', '#E8B4C8', '#C25C83', '#913B5C', '#632B41'],
  coral: ['#FCEFF4', '#F4D3DF', '#E9B3C7', '#D98BA8', '#BD587E', '#8C3B59', '#5D2A3D'],
}

const ECONOMIST_LIGHT: Neutrals = {
  text1: '#121212', text2: '#555555', text3: '#758D99',
  grid: '#A8BAC4', edge: '#758D99', axis: '#A8BAC4', surface: '#FFFFFF', card: '#F2F2F2',
}
const ECONOMIST_DARK: Neutrals = {
  text1: '#F2F2F2', text2: '#B8C4CC', text3: '#8A9AA4',
  grid: 'rgba(255,255,255,0.12)', edge: '#758D99', axis: '#3E4C55', surface: '#12100C', card: '#1C1A15',
}

export const PALETTES: Record<StyleName, StylePalette> = {
  claude: {
    stops: CLAUDE_STOPS,
    light: CLAUDE_LIGHT,
    dark: CLAUDE_DARK,
    cycle: ['purple', 'teal', 'coral', 'blue', 'pink', 'amber', 'green', 'gray', 'red'],
    paper: { light: '#FFFFFF', dark: '#1F1F1E' },
    positive: 'green',
    negative: 'red',
  },
  mckinsey: {
    stops: MCKINSEY_STOPS,
    light: MCKINSEY_LIGHT,
    dark: MCKINSEY_DARK,
    cycle: ['blue', 'teal', 'purple', 'pink', 'coral', 'gray', 'green', 'amber', 'red'],
    paper: { light: '#FFFFFF', dark: '#0A1A26' },
    positive: 'green',
    negative: 'red',
  },
  bcg: {
    stops: BCG_STOPS,
    light: BCG_LIGHT,
    dark: BCG_DARK,
    cycle: ['green', 'teal', 'blue', 'amber', 'purple', 'pink', 'coral', 'gray', 'red'],
    paper: { light: '#FFFFFF', dark: '#0C1F17' },
    positive: 'green',
    negative: 'red',
  },
  economist: {
    stops: ECONOMIST_STOPS,
    light: ECONOMIST_LIGHT,
    dark: ECONOMIST_DARK,
    cycle: ['red', 'blue', 'teal', 'green', 'amber', 'gray', 'coral', 'purple', 'pink'],
    paper: { light: '#FFFFFF', dark: '#12100C' },
    positive: 'green',
    negative: 'red',
    accent: 'red',
  },
}

export function isStyle(value: unknown): value is StyleName {
  return typeof value === 'string' && (STYLES as readonly string[]).includes(value)
}
