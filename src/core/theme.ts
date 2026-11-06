import { DEFAULT_STYLE, PALETTES, type Neutrals, type StyleName } from './palettes.ts'
import { RAMPS, type Ramp, type Theme } from './types.ts'

export { DEFAULT_STYLE }
export type { StyleName }

/** Auto-colour order of the default style; kept for callers that predate `style`. */
export const DEFAULT_CYCLE: readonly Ramp[] = PALETTES[DEFAULT_STYLE].cycle

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

/** Derives the five role colours of one ramp from its 7 stops (50/100/200/400/600/800/900). */
function rampVars(ramp: Ramp, dark: boolean, style: StyleName): Vars {
  const [s50, s100, s200, s400, s600, s800] = PALETTES[style].stops[ramp]
  return dark
    ? { fill: s800, stroke: s200, title: s100, sub: s200, mark: s400 }
    : { fill: s50, stroke: s600, title: s800, sub: s600, mark: s400 }
}

function declare(vars: Vars): string {
  return `--ig-fill:${vars.fill};--ig-stroke:${vars.stroke};--ig-title:${vars.title};--ig-sub:${vars.sub};--ig-mark:${vars.mark}`
}

function neutralVars(n: Neutrals): string {
  return `--ig-text1:${n.text1};--ig-text2:${n.text2};--ig-text3:${n.text3};--ig-grid:${n.grid};--ig-edge:${n.edge};--ig-axis:${n.axis};--ig-surface:${n.surface};--ig-card:${n.card}`
}

function themeBlock(selector: string, dark: boolean, style: StyleName): string {
  const palette = PALETTES[style]
  const rules = [`${selector}{${neutralVars(dark ? palette.dark : palette.light)}}`]
  for (const ramp of RAMPS) rules.push(`${selector} .ig-r-${ramp}{${declare(rampVars(ramp, dark, style))}}`)
  return rules.join('')
}

/** Raw ramp stops of one style, for tests and docs. */
export function rampStops(ramp: Ramp, style: StyleName = DEFAULT_STYLE): readonly string[] {
  return PALETTES[style].stops[ramp]
}

/** Style-agnostic rules; every colour is a `--ig-*` reference resolved by the blocks below. */
function structure(style: StyleName): string {
  const { stops, positive, negative, accent } = PALETTES[style]
  return [
    // The masthead is chrome, so it takes the accent ramp directly rather than a --ig-* variable.
    ...(accent === undefined ? [] : [`.ig-rule,.ig-tag{fill:${stops[accent][3]}}`]),
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
    `.ig-pos{fill:${stops[positive][4]}}`,
    `.ig-neg{fill:${stops[negative][4]}}`,
    '.ig-line{stroke:var(--ig-stroke);stroke-width:.75}',
  ].join('')
}

/** Stylesheet for one rendered SVG; every selector is scoped by the SVG's own class, so inline use never leaks. */
export function styleSheet(scope: string, theme: Theme, style: StyleName = DEFAULT_STYLE): string {
  const root = `.${scope}`
  let css = `${root}{font-family:system-ui,-apple-system,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif}`
  css += structure(style).replace(/(^|\})\./g, `$1${root} .`)
  if (theme === 'light') {
    css += themeBlock(root, false, style)
  } else if (theme === 'dark') {
    css += themeBlock(root, true, style)
  } else {
    css += themeBlock(root, false, style)
    css += themeBlock(`${root}[data-theme="dark"]`, true, style)
    css += `@media (prefers-color-scheme:dark){${themeBlock(`${root}:not([data-theme="light"]):not([data-theme="dark"])`, true, style)}}`
  }
  return css
}

/** Page background used when exporting a raster image. */
export function pageBackground(theme: Theme, style: StyleName = DEFAULT_STYLE): string {
  const paper = PALETTES[style].paper
  return theme === 'dark' ? paper.dark : paper.light
}
