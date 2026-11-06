export const RAMPS = ['purple', 'teal', 'coral', 'pink', 'gray', 'blue', 'green', 'amber', 'red'] as const
export type Ramp = (typeof RAMPS)[number]

export const KINDS = ['flow', 'bar', 'line', 'donut', 'cards', 'timeline', 'layers'] as const
export type Kind = (typeof KINDS)[number]

export interface BaseSpec {
  title?: string
  subtitle?: string
  note?: string
}

export interface FlowNode {
  id: string
  label: string
  sub?: string
  color: Ramp
  shape: 'box' | 'pill' | 'diamond'
}

export interface FlowEdge {
  from: string
  to: string
  label?: string
  dashed: boolean
}

export interface FlowSpec extends BaseSpec {
  infographic: 'flow'
  direction: 'down' | 'right'
  nodes: FlowNode[]
  edges: FlowEdge[]
}

export interface Series {
  name: string
  data: (number | null)[]
  color: Ramp
}

export interface BarSpec extends BaseSpec {
  infographic: 'bar'
  categories: string[]
  series: Series[]
  horizontal: boolean
  stacked: boolean
  unit?: string
}

export interface LineSpec extends BaseSpec {
  infographic: 'line'
  categories: string[]
  series: Series[]
  area: boolean
  unit?: string
}

export interface DonutSlice {
  label: string
  value: number
  color: Ramp
}

export interface DonutSpec extends BaseSpec {
  infographic: 'donut'
  data: DonutSlice[]
  center?: { value: string; label?: string }
  unit?: string
}

export interface CardItem {
  label: string
  value: string
  delta?: string
  note?: string
  color?: Ramp
}

export interface CardsSpec extends BaseSpec {
  infographic: 'cards'
  items: CardItem[]
}

export interface TimelineItem {
  title: string
  desc?: string
  time?: string
  color: Ramp
}

export interface TimelineSpec extends BaseSpec {
  infographic: 'timeline'
  items: TimelineItem[]
}

export interface LayerItem {
  label: string
  sub?: string
}

export interface Layer {
  label: string
  color: Ramp
  items: LayerItem[]
}

export interface LayersSpec extends BaseSpec {
  infographic: 'layers'
  layers: Layer[]
  arrows: boolean
}

export type InfographicSpec =
  | FlowSpec
  | BarSpec
  | LineSpec
  | DonutSpec
  | CardsSpec
  | TimelineSpec
  | LayersSpec

export type Theme = 'auto' | 'light' | 'dark'

export interface RenderOptions {
  /** Unique per rendered SVG on a page: prefixes ids and css classes so inline SVGs never collide. */
  idPrefix?: string
  /** `auto` follows the `data-theme` attribute / OS; `light` and `dark` bake a single theme (for export). */
  theme?: Theme
  /** Standalone file: adds the XML prolog and a fixed pixel size. */
  standalone?: boolean
}

export interface RenderedSvg {
  svg: string
  width: number
  height: number
}

export type NormalizeResult =
  | { ok: true; spec: InfographicSpec; warnings: string[]; renderable: boolean }
  | { ok: false; error: string; code: 'json' | 'kind' }
