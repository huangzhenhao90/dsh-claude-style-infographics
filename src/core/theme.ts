import { RAMPS, type Ramp, type Theme } from './types.ts'

/** Stops 50 / 100 / 200 / 400 / 600 / 800 / 900 of the nine Claude-artifact ramps. */
const STOPS: Record<Ramp, readonly [string, string, string, string, string, string, string]> = {
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

export const DEFAULT_CYCLE: readonly Ramp[] = ['purple', 'teal', 'coral', 'blue', 'pink', 'amber', 'green', 'gray', 'red']

export function isRamp(value: unknown): value is Ramp {
  return typeof value === 'string' && (RAMPS as readonly string[]).includes(value)
}

interface Vars {
  fill: string
  stroke: string
  title: string
  sub: string
  mark: string
}

function rampVars(ramp: Ramp, dark: boolean): Vars {
  const [s50, s100, s200, s400, s600, s800] = STOPS[ramp]
  return dark
    ? { fill: s800, stroke: s200, title: s100, sub: s200, mark: s400 }
    : { fill: s50, stroke: s600, title: s800, sub: s600, mark: s400 }
}

function declare(vars: Vars): string {
  return `--ig-fill:${vars.fill};--ig-stroke:${vars.stroke};--ig-title:${vars.title};--ig-sub:${vars.sub};--ig-mark:${vars.mark}`
}

interface Neutrals {
  text1: string
  text2: string
  text3: string
  grid: string
  edge: string
  axis: string
  surface: string
  card: string
}

const LIGHT: Neutrals = {
  text1: '#2C2C2A', text2: '#5F5E5A', text3: '#888780',
  grid: 'rgba(0,0,0,0.08)', edge: '#888780', axis: '#B4B2A9', surface: '#FFFFFF', card: '#F1EFE8',
}
const DARK: Neutrals = {
  text1: '#E8E6DF', text2: '#B4B2A9', text3: '#888780',
  grid: 'rgba(255,255,255,0.09)', edge: '#B4B2A9', axis: '#5F5E5A', surface: '#262624', card: '#2C2C2A',
}

function neutralVars(n: Neutrals): string {
  return `--ig-text1:${n.text1};--ig-text2:${n.text2};--ig-text3:${n.text3};--ig-grid:${n.grid};--ig-edge:${n.edge};--ig-axis:${n.axis};--ig-surface:${n.surface};--ig-card:${n.card}`
}

function themeBlock(selector: string, dark: boolean): string {
  const rules = [`${selector}{${neutralVars(dark ? DARK : LIGHT)}}`]
  for (const ramp of RAMPS) rules.push(`${selector} .ig-r-${ramp}{${declare(rampVars(ramp, dark))}}`)
  return rules.join('')
}

/** Raw ramp stops, for tests and docs. */
export function rampStops(ramp: Ramp): readonly string[] {
  return STOPS[ramp]
}

const STRUCTURE = [
  '.ig-t1{fill:var(--ig-text1)}',
  '.ig-t2{fill:var(--ig-text2)}',
  '.ig-t3{fill:var(--ig-text3)}',
  '.ig-title-r{fill:var(--ig-title)}',
  '.ig-sub-r{fill:var(--ig-sub)}',
  '.ig-box{fill:var(--ig-fill);stroke:var(--ig-stroke);stroke-width:.5}',
  '.ig-mark{fill:var(--ig-mark)}',
  '.ig-mark-stroke{stroke:var(--ig-mark);fill:none}',
  '.ig-mark-area{fill:var(--ig-mark);fill-opacity:.12;stroke:none}',
  '.ig-surface{fill:var(--ig-surface);stroke:var(--ig-stroke);stroke-width:.5}',
  '.ig-card{fill:var(--ig-card)}',
  '.ig-card-r{fill:var(--ig-fill)}',
  '.ig-grid{stroke:var(--ig-grid);stroke-width:.5}',
  '.ig-axis{stroke:var(--ig-axis);stroke-width:.5}',
  '.ig-edge{stroke:var(--ig-edge);stroke-width:.75;fill:none}',
  '.ig-arrowhead{stroke:var(--ig-edge);fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}',
  '.ig-dash{stroke-dasharray:4 3}',
  '.ig-pos{fill:#3B6D11}',
  '.ig-neg{fill:#A32D2D}',
  '.ig-line{stroke:var(--ig-stroke);stroke-width:.75}',
].join('')

/** Stylesheet for one rendered SVG; every selector is scoped by the SVG's own class, so inline use never leaks. */
export function styleSheet(scope: string, theme: Theme): string {
  const root = `.${scope}`
  let css = `${root}{font-family:system-ui,-apple-system,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif}`
  css += STRUCTURE.replace(/(^|\})\./g, `$1${root} .`)
  if (theme === 'light') {
    css += themeBlock(root, false)
  } else if (theme === 'dark') {
    css += themeBlock(root, true)
  } else {
    css += themeBlock(root, false)
    css += themeBlock(`${root}[data-theme="dark"]`, true)
    css += `@media (prefers-color-scheme:dark){${themeBlock(`${root}:not([data-theme="light"]):not([data-theme="dark"])`, true)}}`
  }
  return css
}

/** Page background used when exporting a raster image. */
export function pageBackground(theme: Theme): string {
  return theme === 'dark' ? '#1F1F1E' : '#FFFFFF'
}
