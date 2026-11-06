/**
 * Browser half of the plugin. The DSH host loads this bundle through its module loader
 * (see tsdown.config.ts); `apply` installs the DOM fence channel and returns its disposer.
 */
import { installFenceChannel } from './dom-fence.ts'

export const inject: string[] = []

export function apply(): () => void {
  if (typeof document === 'undefined') return () => {}
  const channel = installFenceChannel()
  console.info('[infographic] client active')
  return () => channel.dispose()
}

export { installFenceChannel, findInfographicBlocks, isPlausibleSurface, detectTheme } from './dom-fence.ts'
export type { Channel, ChannelOptions } from './dom-fence.ts'
