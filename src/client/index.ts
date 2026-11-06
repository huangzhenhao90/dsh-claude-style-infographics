/**
 * Browser half of the plugin. The DSH host loads this bundle through its module loader
 * (see tsdown.config.ts); `apply` installs the DOM fence channel and registers the
 * native settings section under DSH's Settings menu.
 */
import { installFenceChannel } from './dom-fence.ts'
import { createSettingsPanel } from './settings-panel.ts'

export const inject: string[] = [
  '@deepseek-ai/dsh-client-ui-renderer',
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-ui-settings',
]

export function apply(ctx?: any): () => void {
  if (typeof document === 'undefined') return () => {}
  const channel = installFenceChannel()
  console.info('[infographic] client active')

  let unregisterSettings: (() => void) | undefined

  try {
    const slots = (typeof ctx?.get === 'function' ? ctx.get('slots') : undefined) || ctx?.slots
    if (slots) {
      const Panel = createSettingsPanel(ctx)
      const registerSection = (): (() => void) | undefined => {
        try {
          return slots.register(
            {
              name: 'settings.section',
              id: 'infographic',
              order: 58,
              label: () => {
                const active = ctx?.locale?.getLocale?.()?.active || ctx?.locale?.get?.() || ''
                return typeof active === 'string' && active.startsWith('zh')
                  ? '信息图设置'
                  : 'Infographics'
              },
            },
            Panel,
          )
        } catch (e) {
          console.warn('[infographic] failed to register settings.section', e)
          return undefined
        }
      }

      if (typeof slots.inject === 'function') {
        slots.inject('settings.section', () => {
          unregisterSettings = registerSection()
          return () => unregisterSettings?.()
        })
      } else {
        unregisterSettings = registerSection()
      }
    }
  } catch (err) {
    console.warn('[infographic] error during settings section setup', err)
  }

  return () => {
    unregisterSettings?.()
    channel.dispose()
  }
}

export {
  installFenceChannel,
  findInfographicBlocks,
  isPlausibleSurface,
  detectTheme,
  STYLE_STORAGE_KEY,
  FREQ_STORAGE_KEY,
} from './dom-fence.ts'
export { createSettingsPanel } from './settings-panel.ts'
export type { Channel, ChannelOptions } from './dom-fence.ts'
