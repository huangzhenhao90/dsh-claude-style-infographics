import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { homedir } from 'node:os'
import {
  DEFAULT_CONFIG,
  DEFAULT_FREQUENCY,
  isFrequency,
  type InfographicConfig,
} from '../core/config.ts'
import { DEFAULT_STYLE, isStyle } from '../core/palettes.ts'

export function configPath(): string {
  const custom = process.env.DSH_HOME || process.env.DSH_INFOGRAPHIC_HOME
  const base = custom ? custom : resolve(homedir(), '.dsh')
  return resolve(base, 'infographic', 'config.json')
}

export function loadConfig(): InfographicConfig {
  try {
    const file = configPath()
    if (!existsSync(file)) return { ...DEFAULT_CONFIG }
    const raw = JSON.parse(readFileSync(file, 'utf8')) as Partial<InfographicConfig>
    return {
      frequency: isFrequency(raw?.frequency) ? raw.frequency : DEFAULT_FREQUENCY,
      defaultStyle: isStyle(raw?.defaultStyle) ? raw.defaultStyle : DEFAULT_STYLE,
    }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveConfig(patch: Partial<InfographicConfig>): InfographicConfig {
  const current = loadConfig()
  const next: InfographicConfig = {
    frequency: isFrequency(patch.frequency) ? patch.frequency : current.frequency,
    defaultStyle: isStyle(patch.defaultStyle) ? patch.defaultStyle : current.defaultStyle,
  }
  try {
    const file = configPath()
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(next, null, 2) + '\n', 'utf8')
  } catch (err) {
    console.error('[infographic] failed to save config to', configPath(), err)
  }
  return next
}
