import type { FlowEdge, FlowNode, FlowSpec } from '../types.ts'
import { measure, wrap } from '../text.ts'
import { CONTENT_WIDTH, MARGIN_X, roundedPath, round, titleOf, txt, textBlock, type Piece, type Point } from './common.ts'

const LABEL_SIZE = 14
const SUB_SIZE = 12
const LABEL_LINE = 18
const SUB_LINE = 16
const WIDTH_STEPS = [220, 180, 150, 120, 96]

interface Box {
  node: FlowNode
  w: number
  h: number
  labelLines: string[]
  subLines: string[]
}

interface LNode {
  key: string
  box?: Box
  main: number
  cross: number
  layer: number
  index: number
  pos: number
}

interface Chain {
  edge: FlowEdge
  reversed: boolean
  nodes: LNode[]
}

function measureBox(node: FlowNode, maxWidth: number): Box {
  const diamond = node.shape === 'diamond'
  const inner = diamond ? Math.max(70, maxWidth * 0.6) : maxWidth - 32
  const labelLines = wrap(node.label, inner, LABEL_SIZE, 500, 3)
  const subLines = node.sub === undefined ? [] : wrap(node.sub, inner, SUB_SIZE, 400, 3)
  const textWidth = Math.max(
    ...labelLines.map(entry => measure(entry, LABEL_SIZE, 500)),
    ...subLines.map(entry => measure(entry, SUB_SIZE, 400)),
  )
  const textHeight = labelLines.length * LABEL_LINE + (subLines.length > 0 ? subLines.length * SUB_LINE + 2 : 0)
  if (diamond) {
    const w = Math.min(maxWidth, Math.max(96, textWidth * 1.55 + 24))
    return { node, w, h: Math.max(60, textHeight * 1.6 + 20), labelLines, subLines }
  }
  const w = Math.min(maxWidth, Math.max(88, textWidth + 32 + (node.shape === 'pill' ? 8 : 0)))
  return { node, w, h: Math.max(node.shape === 'pill' ? 40 : 44, textHeight + 24), labelLines, subLines }
}

/** Longest-path layering with back edges flipped so cycles do not break it. */
function assignLayers(spec: FlowSpec): { layer: Map<string, number>; reversed: Set<FlowEdge> } {
  const out = new Map<string, FlowEdge[]>()
  for (const node of spec.nodes) out.set(node.id, [])
  for (const edge of spec.edges) out.get(edge.from)?.push(edge)
  const indegree = new Map<string, number>()
  for (const edge of spec.edges) indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1)
  const state = new Map<string, 0 | 1 | 2>()
  const reversed = new Set<FlowEdge>()
  const visit = (id: string): void => {
    state.set(id, 1)
    for (const edge of out.get(id) ?? []) {
      const next = state.get(edge.to) ?? 0
      if (next === 1) reversed.add(edge)
      else if (next === 0) visit(edge.to)
    }
    state.set(id, 2)
  }
  const roots = [...spec.nodes].sort((left, right) => (indegree.get(left.id) ?? 0) - (indegree.get(right.id) ?? 0))
  for (const node of roots) if ((state.get(node.id) ?? 0) === 0) visit(node.id)

  const dag = spec.edges.map(edge => (reversed.has(edge) ? { from: edge.to, to: edge.from } : { from: edge.from, to: edge.to }))
  const layer = new Map<string, number>(spec.nodes.map(node => [node.id, 0]))
  for (let pass = 0; pass <= spec.nodes.length; pass += 1) {
    let changed = false
    for (const edge of dag) {
      const candidate = (layer.get(edge.from) as number) + 1
      if (candidate > (layer.get(edge.to) as number)) {
        layer.set(edge.to, candidate)
        changed = true
      }
    }
    if (!changed) break
  }
  const hasIncoming = new Set(dag.map(edge => edge.to))
  for (const node of spec.nodes) {
    if (hasIncoming.has(node.id)) continue
    const targets = dag.filter(edge => edge.from === node.id).map(edge => layer.get(edge.to) as number)
    if (targets.length > 0) layer.set(node.id, Math.max(0, Math.min(...targets) - 1))
  }
  return { layer, reversed }
}

function spread(entries: { node: LNode; desired: number; gap: number }[]): number[] {
  const forward: number[] = []
  entries.forEach((entry, index) => {
    const previous = entries[index - 1]
    const minimum = previous === undefined ? -Infinity : (forward[index - 1] as number) + previous.node.cross / 2 + entry.node.cross / 2 + entry.gap
    forward.push(Math.max(entry.desired, minimum))
  })
  const backward: number[] = new Array<number>(entries.length)
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index] as { node: LNode; desired: number; gap: number }
    const following = entries[index + 1]
    const maximum = following === undefined ? Infinity : (backward[index + 1] as number) - following.node.cross / 2 - entry.node.cross / 2 - following.gap
    backward[index] = Math.min(entry.desired, maximum)
  }
  return forward.map((value, index) => (value + (backward[index] as number)) / 2)
}

interface Layout {
  nodes: LNode[]
  chains: Chain[]
  layerStart: number[]
  layerMain: number[]
  mainExtent: number
  crossExtent: number
}

function layoutFlow(spec: FlowSpec, maxWidth: number): Layout {
  const right = spec.direction === 'right'
  const boxes = new Map(spec.nodes.map(node => [node.id, measureBox(node, maxWidth)]))
  const { layer, reversed } = assignLayers(spec)
  const real = new Map<string, LNode>()
  const all: LNode[] = []
  for (const node of spec.nodes) {
    const box = boxes.get(node.id) as Box
    const entry: LNode = { key: node.id, box, main: right ? box.w : box.h, cross: right ? box.h : box.w, layer: layer.get(node.id) as number, index: 0, pos: 0 }
    real.set(node.id, entry)
    all.push(entry)
  }
  const chains: Chain[] = []
  let dummyCount = 0
  for (const edge of spec.edges) {
    const isReversed = reversed.has(edge)
    const upper = real.get(isReversed ? edge.to : edge.from) as LNode
    const lower = real.get(isReversed ? edge.from : edge.to) as LNode
    const nodes: LNode[] = [upper]
    for (let level = upper.layer + 1; level < lower.layer; level += 1) {
      const dummy: LNode = { key: `~${dummyCount++}`, main: 0, cross: 10, layer: level, index: 0, pos: 0 }
      nodes.push(dummy)
      all.push(dummy)
    }
    nodes.push(lower)
    chains.push({ edge, reversed: isReversed, nodes })
  }
  const layerCount = Math.max(...all.map(entry => entry.layer)) + 1
  const layers: LNode[][] = Array.from({ length: layerCount }, () => [])
  for (const entry of all) layers[entry.layer]?.push(entry)
  const reindex = (): void => layers.forEach(members => members.forEach((member, index) => { member.index = index }))
  reindex()

  const neighbours = new Map<LNode, { up: LNode[]; down: LNode[] }>()
  for (const entry of all) neighbours.set(entry, { up: [], down: [] })
  for (const chain of chains) {
    for (let index = 1; index < chain.nodes.length; index += 1) {
      const upper = chain.nodes[index - 1] as LNode
      const lower = chain.nodes[index] as LNode
      neighbours.get(upper)?.down.push(lower)
      neighbours.get(lower)?.up.push(upper)
    }
  }
  const sweep = (members: LNode[], side: 'up' | 'down'): void => {
    const score = new Map<LNode, number>()
    for (const member of members) {
      const linked = neighbours.get(member)?.[side] ?? []
      score.set(member, linked.length === 0 ? member.index : linked.reduce((sum, item) => sum + item.index, 0) / linked.length)
    }
    members.sort((left, right) => (score.get(left) as number) - (score.get(right) as number) || left.index - right.index)
    members.forEach((member, index) => { member.index = index })
  }
  for (let pass = 0; pass < 4; pass += 1) {
    for (let level = 1; level < layerCount; level += 1) sweep(layers[level] as LNode[], 'up')
    for (let level = layerCount - 2; level >= 0; level -= 1) sweep(layers[level] as LNode[], 'down')
  }

  const gapCross = right ? 22 : 30
  for (const members of layers) {
    let cursor = 0
    for (const member of members) {
      member.pos = cursor + member.cross / 2
      cursor += member.cross + (member.box === undefined ? 14 : gapCross)
    }
  }
  const relax = (members: LNode[], side: 'up' | 'down'): void => {
    const entries = members.map(member => {
      const linked = neighbours.get(member)?.[side] ?? []
      return {
        node: member,
        desired: linked.length === 0 ? member.pos : linked.reduce((sum, item) => sum + item.pos, 0) / linked.length,
        gap: member.box === undefined ? 14 : gapCross,
      }
    })
    spread(entries).forEach((value, index) => { (members[index] as LNode).pos = value })
  }
  for (let pass = 0; pass < 4; pass += 1) {
    for (let level = 1; level < layerCount; level += 1) relax(layers[level] as LNode[], 'up')
    for (let level = layerCount - 2; level >= 0; level -= 1) relax(layers[level] as LNode[], 'down')
  }
  let minCross = Infinity
  let maxCross = -Infinity
  for (const entry of all) {
    minCross = Math.min(minCross, entry.pos - entry.cross / 2)
    maxCross = Math.max(maxCross, entry.pos + entry.cross / 2)
  }
  for (const entry of all) entry.pos -= minCross

  const labelled = (level: number): boolean => chains.some(chain => chain.edge.label !== undefined && chain.nodes.some(entry => entry.layer === level))
  const layerMain = layers.map(members => Math.max(12, ...members.map(member => member.main)))
  const layerStart: number[] = []
  let cursor = 0
  layerMain.forEach((size, level) => {
    layerStart.push(cursor)
    cursor += size + (right ? 66 : labelled(level) ? 56 : 46)
  })
  const mainExtent = cursor - (right ? 66 : 46)
  return { nodes: all, chains, layerStart, layerMain, mainExtent, crossExtent: maxCross - minCross }
}

function toXY(spec: FlowSpec, main: number, cross: number): Point {
  return spec.direction === 'right' ? { x: main, y: cross } : { x: cross, y: main }
}

function segments(points: Point[]): { from: Point; to: Point; length: number; horizontal: boolean }[] {
  const result: { from: Point; to: Point; length: number; horizontal: boolean }[] = []
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1] as Point
    const to = points[index] as Point
    const length = Math.hypot(to.x - from.x, to.y - from.y)
    if (length > 0.5) result.push({ from, to, length, horizontal: Math.abs(to.y - from.y) < Math.abs(to.x - from.x) })
  }
  return result
}

function drawEdge(layout: Layout, spec: FlowSpec, chain: Chain, sidePort: 'cross-' | 'cross+' | null, markerId: string): string {
  const placement = (entry: LNode): { entry: number; exit: number } => {
    const start = layout.layerStart[entry.layer] as number
    const size = layout.layerMain[entry.layer] as number
    if (entry.box === undefined) return { entry: start, exit: start + size }
    const center = start + size / 2
    return { entry: center - entry.main / 2, exit: center + entry.main / 2 }
  }
  const first = chain.nodes[0] as LNode
  const lastNode = chain.nodes[chain.nodes.length - 1] as LNode
  const pairs: { cross: number; main: number }[] = []
  const firstPlace = placement(first)
  const firstCenter = (firstPlace.entry + firstPlace.exit) / 2
  if (chain.reversed) {
    const lastPlace = placement(lastNode)
    const edgeFirst = first.pos + first.cross / 2
    const edgeLast = lastNode.pos + lastNode.cross / 2
    const laneFirst = edgeFirst + 14
    const laneLast = edgeLast + 14
    const lastCenter = (lastPlace.entry + lastPlace.exit) / 2
    pairs.push({ cross: edgeFirst, main: firstCenter }, { cross: laneFirst, main: firstCenter })
    let previousExit = firstCenter
    for (let index = 1; index < chain.nodes.length - 1; index += 1) {
      const current = chain.nodes[index] as LNode
      const place = placement(current)
      const last = pairs[pairs.length - 1] as { cross: number; main: number }
      if (Math.abs(last.cross - current.pos) > 0.5) {
        const mid = (previousExit + place.entry) / 2
        pairs.push({ cross: last.cross, main: mid }, { cross: current.pos, main: mid })
      }
      pairs.push({ cross: current.pos, main: place.entry }, { cross: current.pos, main: place.exit })
      previousExit = place.exit
    }
    const tail = pairs[pairs.length - 1] as { cross: number; main: number }
    const approach = chain.nodes.length === 2 ? Math.max(laneFirst, laneLast) : laneLast
    if (chain.nodes.length === 2) {
      pairs.length = 1
      pairs.push({ cross: approach, main: firstCenter }, { cross: approach, main: lastCenter })
    } else {
      const mid = (previousExit + lastPlace.entry) / 2
      pairs.push({ cross: tail.cross, main: mid }, { cross: approach, main: mid }, { cross: approach, main: lastCenter })
    }
    pairs.push({ cross: edgeLast, main: lastCenter })
  } else {
    if (sidePort !== null) {
      const edgeCross = first.pos + (sidePort === 'cross+' ? 1 : -1) * (first.cross / 2)
      pairs.push({ cross: edgeCross, main: firstCenter })
      const next = chain.nodes[1] as LNode
      pairs.push({ cross: next.pos, main: firstCenter })
    } else {
      pairs.push({ cross: first.pos, main: firstPlace.exit })
    }
    let previousExit = sidePort !== null ? firstCenter : firstPlace.exit
    for (let index = 1; index < chain.nodes.length; index += 1) {
      const current = chain.nodes[index] as LNode
      const place = placement(current)
      const last = pairs[pairs.length - 1] as { cross: number; main: number }
      if (Math.abs(last.cross - current.pos) > 0.5 && !(sidePort !== null && index === 1)) {
        const mid = (previousExit + place.entry) / 2
        pairs.push({ cross: last.cross, main: mid }, { cross: current.pos, main: mid })
      }
      pairs.push({ cross: current.pos, main: place.entry })
      if (current.box === undefined) {
        pairs.push({ cross: current.pos, main: place.exit })
        previousExit = place.exit
      }
    }
  }
  let points = pairs.map(pair => toXY(spec, pair.main, pair.cross))
  if (chain.reversed) points = [...points].reverse()
  const path = roundedPath(points, 8)
  const dash = chain.edge.dashed ? ' ig-dash' : ''
  let svg = `<path class="ig-edge${dash}" d="${path}" marker-end="url(#${markerId})"/>`
  if (chain.edge.label !== undefined) {
    const parts = segments(points)
    const firstSegment = parts[0]
    let anchor: { x: number; y: number; anchor: 'start' | 'middle' } | undefined
    if (firstSegment !== undefined && firstSegment.horizontal && firstSegment.length >= 24 && sidePort !== null) {
      anchor = { x: (firstSegment.from.x + firstSegment.to.x) / 2, y: firstSegment.from.y - 9, anchor: 'middle' }
    } else {
      const vertical = parts.filter(part => !part.horizontal).sort((left, right) => right.length - left.length)[0]
      const chosen = vertical ?? [...parts].sort((left, right) => right.length - left.length)[0]
      if (chosen !== undefined) {
        anchor = chosen.horizontal
          ? { x: (chosen.from.x + chosen.to.x) / 2, y: chosen.from.y - 9, anchor: 'middle' }
          : { x: chosen.from.x + 8, y: (chosen.from.y + chosen.to.y) / 2, anchor: 'start' }
      }
    }
    if (anchor !== undefined) svg += txt(anchor.x, anchor.y, chain.edge.label, { size: 11, cls: 'ig-t2', anchor: anchor.anchor })
  }
  return svg
}

function drawNode(layout: Layout, spec: FlowSpec, entry: LNode): string {
  const box = entry.box as Box
  const start = layout.layerStart[entry.layer] as number
  const size = layout.layerMain[entry.layer] as number
  const center = toXY(spec, start + size / 2, entry.pos)
  const left = center.x - box.w / 2
  const top = center.y - box.h / 2
  let shape: string
  if (box.node.shape === 'diamond') {
    shape = `<polygon class="ig-box" points="${round(center.x)},${round(top)} ${round(left + box.w)},${round(center.y)} ${round(center.x)},${round(top + box.h)} ${round(left)},${round(center.y)}" stroke-linejoin="round"/>`
  } else {
    shape = `<rect class="ig-box" x="${round(left)}" y="${round(top)}" width="${round(box.w)}" height="${round(box.h)}" rx="${box.node.shape === 'pill' ? round(box.h / 2) : 8}"/>`
  }
  const textHeight = box.labelLines.length * LABEL_LINE + (box.subLines.length > 0 ? box.subLines.length * SUB_LINE + 2 : 0)
  const firstCenter = center.y - textHeight / 2 + LABEL_LINE / 2
  let labels = textBlock(center.x, firstCenter + ((box.labelLines.length - 1) * LABEL_LINE) / 2, box.labelLines, LABEL_LINE, { size: LABEL_SIZE, weight: 500, cls: 'ig-title-r', anchor: 'middle' })
  if (box.subLines.length > 0) {
    const subFirst = center.y - textHeight / 2 + box.labelLines.length * LABEL_LINE + 2 + SUB_LINE / 2
    labels += textBlock(center.x, subFirst + ((box.subLines.length - 1) * SUB_LINE) / 2, box.subLines, SUB_LINE, { size: SUB_SIZE, cls: 'ig-sub-r', anchor: 'middle' })
  }
  const caption = box.node.sub === undefined ? box.node.label : `${box.node.label} — ${box.node.sub}`
  return `<g class="ig-r-${box.node.color}">${titleOf(caption)}${shape}${labels}</g>`
}

export function renderFlow(spec: FlowSpec, top: number, prefix: string): Piece {
  const right = spec.direction === 'right'
  let layout = layoutFlow(spec, WIDTH_STEPS[0] as number)
  for (const step of WIDTH_STEPS) {
    layout = layoutFlow(spec, step)
    const width = right ? layout.mainExtent : layout.crossExtent
    if (width <= CONTENT_WIDTH) break
  }
  const width = right ? layout.mainExtent : layout.crossExtent
  const height = right ? layout.crossExtent : layout.mainExtent
  const scale = width > CONTENT_WIDTH ? CONTENT_WIDTH / width : 1
  const offsetX = scale < 1 ? MARGIN_X : MARGIN_X + (CONTENT_WIDTH - width) / 2

  const markerId = `${prefix}-arrow`
  const outgoing = new Map<string, Chain[]>()
  for (const chain of layout.chains) {
    const upper = chain.nodes[0] as LNode
    const list = outgoing.get(upper.key) ?? []
    list.push(chain)
    outgoing.set(upper.key, list)
  }
  const ports = new Map<Chain, 'cross-' | 'cross+' | null>()
  for (const list of outgoing.values()) {
    const owner = list[0]?.nodes[0] as LNode
    const forward = list.filter(chain => !chain.reversed)
    if (owner.box?.node.shape !== 'diamond' || forward.length < 2) continue
    let leftTaken = false
    let rightTaken = false
    let bottomTaken = false
    const ordered = [...forward].sort((a, b) => (a.nodes[1] as LNode).pos - (b.nodes[1] as LNode).pos)
    for (const chain of ordered) {
      const delta = (chain.nodes[1] as LNode).pos - owner.pos
      if (delta < -8 && !leftTaken) {
        ports.set(chain, 'cross-')
        leftTaken = true
      } else if (delta > 8 && !rightTaken) {
        ports.set(chain, 'cross+')
        rightTaken = true
      } else if (!bottomTaken) {
        bottomTaken = true
      } else if (!rightTaken) {
        ports.set(chain, 'cross+')
        rightTaken = true
      } else if (!leftTaken) {
        ports.set(chain, 'cross-')
        leftTaken = true
      }
    }
  }

  const edges = layout.chains.map(chain => drawEdge(layout, spec, chain, ports.get(chain) ?? null, markerId)).join('')
  const nodes = layout.nodes.filter(entry => entry.box !== undefined).map(entry => drawNode(layout, spec, entry)).join('')
  const transform = scale < 1 ? `translate(${round(offsetX)} ${top}) scale(${round(scale * 1000) / 1000})` : `translate(${round(offsetX)} ${top})`
  const defs = `<marker id="${markerId}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path class="ig-arrowhead" d="M2 1.5L8 5L2 8.5"/></marker>`
  return { body: `<g transform="${transform}">${edges}${nodes}</g>`, bottom: top + height * scale, defs }
}
