/**
 * Plain `<script>` entry for pages that are not DSH: exposes the renderer and the fence channel
 * on `window.DshInfographic`.
 */
import { installFenceChannel } from './client/dom-fence.ts'
import { exportSvg, svgToPngBlob } from './client/export.ts'
import { normalizeSpec, readFence, renderInfographic, renderSvg } from './core/index.ts'

const api = { installFenceChannel, normalizeSpec, readFence, renderInfographic, renderSvg, exportSvg, svgToPngBlob }

declare global {
  interface Window {
    DshInfographic?: typeof api
  }
}

window.DshInfographic = api
