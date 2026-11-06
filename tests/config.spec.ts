import { describe, expect, it } from 'vitest'
import {
  buildPromptSection,
  DEFAULT_CONFIG,
  DEFAULT_FREQUENCY,
  FREQUENCIES,
  isFrequency,
} from '../src/core/config.ts'
import { loadConfig, saveConfig } from '../src/node/config.ts'
import { DEFAULT_STYLE, STYLES } from '../src/core/palettes.ts'

describe('config module', () => {
  it('defines valid frequency presets and default', () => {
    expect(FREQUENCIES).toEqual(['high', 'medium', 'low'])
    expect(DEFAULT_FREQUENCY).toBe('medium')
    expect(isFrequency('high')).toBe(true)
    expect(isFrequency('medium')).toBe(true)
    expect(isFrequency('low')).toBe(true)
    expect(isFrequency('random')).toBe(false)
  })

  it('builds customized prompt text for each frequency', () => {
    const high = buildPromptSection('high', 'mckinsey')
    expect(high).toContain('视觉优先（积极模式）')
    expect(high).toContain('默认图形风格：mckinsey')

    const medium = buildPromptSection('medium', 'claude')
    expect(medium).toContain('克制平衡（平衡模式）')
    expect(medium).toContain('默认图形风格：claude')

    const low = buildPromptSection('low', 'economist')
    expect(low).toContain('文字优先（克制模式）')
    expect(low).toContain('默认图形风格：economist')
  })

  it('loads and saves config safely', () => {
    const saved = saveConfig({ frequency: 'high', defaultStyle: 'bcg' })
    expect(saved.frequency).toBe('high')
    expect(saved.defaultStyle).toBe('bcg')

    const reloaded = loadConfig()
    expect(reloaded.frequency).toBe('high')
    expect(reloaded.defaultStyle).toBe('bcg')

    // Reset back to defaults
    const reset = saveConfig(DEFAULT_CONFIG)
    expect(reset.frequency).toBe(DEFAULT_FREQUENCY)
    expect(reset.defaultStyle).toBe(DEFAULT_STYLE)
  })
})
