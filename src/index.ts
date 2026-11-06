/**
 * Node half of the plugin: teaches the model the ```infographic fence and ships the bundled
 * `infographic` skill. The browser half (lib/client.js) renders the fence.
 * @module @huangzhenhao90/dsh-infographic
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type { SkillProvider } from '@deepseek-ai/dsh-skill'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildPromptSection,
  DEFAULT_FREQUENCY,
  FREQUENCIES,
  isFrequency,
  type Frequency,
  type InfographicConfig,
} from './core/config.ts'
import { loadConfig, saveConfig } from './node/config.ts'
import { DEFAULT_STYLE, isStyle, STYLES, type StyleName } from './core/palettes.ts'

export const name = '@huangzhenhao90/dsh-infographic'
export const inject = ['systemPrompt']

const SKILL_NAME = 'infographic'
const SKILL_RANK = 600
const SKILL_INVOCATION = { modelInvocable: true, userInvocable: true } as const

/** Default section text for static reference and backwards compatibility with test fixtures. */
export const SECTION_TEXT = buildPromptSection(DEFAULT_FREQUENCY, DEFAULT_STYLE)

function frontmatterField(front: string, key: string): string | undefined {
  const line = new RegExp(`^\\s*${key}\\s*:\\s*(.+?)\\s*$`, 'mu').exec(front)
  return line?.[1]?.replace(/^['"]|['"]$/gu, '')
}

function bundledSkillProvider(): SkillProvider {
  const moduleDirectory = dirname(fileURLToPath(new URL(import.meta.url)))
  const path = resolve(moduleDirectory, '../dsh/SKILL.md')
  const raw = readFileSync(path, 'utf8')
  const end = raw.indexOf('\n---\n', 4)
  if (!raw.startsWith('---\n') || end < 0) throw new Error('infographic SKILL.md has invalid frontmatter')
  const description = frontmatterField(raw.slice(4, end), 'description')
  if (description === undefined) throw new Error('infographic SKILL.md frontmatter has no description')
  const provider = 'dsh-infographic'
  const entry = {
    name: SKILL_NAME,
    description,
    invocation: SKILL_INVOCATION,
    source: 'bundled',
    provider,
    path,
    resourceBase: { kind: 'directory', path: dirname(path) },
  } as const
  return {
    name: provider,
    list: () => Promise.resolve([{ ...entry, rank: SKILL_RANK, locator: path }]),
    get: () => Promise.resolve({ ...entry, content: raw.slice(end + 5) }),
  }
}

export interface PluginConfig {
  frequency?: Frequency
  defaultStyle?: StyleName
}

export function apply(ctx: Context, initialConfig?: PluginConfig): void {
  // If an initial configuration was provided by Cordis composition/manifest, persist any present fields.
  if (initialConfig) {
    const patch: Partial<InfographicConfig> = {}
    if (isFrequency(initialConfig.frequency)) patch.frequency = initialConfig.frequency
    if (isStyle(initialConfig.defaultStyle)) patch.defaultStyle = initialConfig.defaultStyle
    if (Object.keys(patch).length > 0) saveConfig(patch)
  }

  let currentConfig: InfographicConfig = loadConfig()
  let promptDisposer: (() => void) | undefined

  const syncSystemPrompt = (): void => {
    promptDisposer?.()
    promptDisposer = ctx.systemPrompt.section({
      name: 'infographic:fence',
      order: ctx.systemPrompt.getSectionOrder('STRUCTURED_OUTPUT'),
      text: buildPromptSection(currentConfig.frequency, currentConfig.defaultStyle),
    })
  }

  syncSystemPrompt()

  // 1. Skill registration
  ctx.inject(['skills'], (skillCtx: any) => {
    skillCtx.skills?.registerProvider?.(() => bundledSkillProvider())
  })

  // 2. Tool registration: infographic_config to inspect and tune frequency/style
  ctx.inject(['tools'], (toolCtx: any) => {
    try {
      toolCtx.tools?.register?.({
        name: 'infographic_config',
        description:
          '查看或修改「信息图」插件的设置。不传 patch 表示查看当前配置；传入 patch 可以修改画图频率策略（high: 积极视觉优先, medium: 平衡克制, low: 文字优先严格按需）及默认图形风格（claude, mckinsey, bcg, economist）。修改即时生效。',
        parameters: {
          type: 'object',
          properties: {
            patch: {
              type: 'object',
              description: '要修改的配置项（可选）',
              properties: {
                frequency: {
                  type: 'string',
                  enum: [...FREQUENCIES],
                  description: '画图频率策略：high (积极出图) | medium (平衡适度，默认) | low (克制，仅在被要求时画图)',
                },
                defaultStyle: {
                  type: 'string',
                  enum: [...STYLES],
                  description: '默认图表视觉风格：claude (默认) | mckinsey (麦肯锡) | bcg (BCG) | economist (经济学人)',
                },
              },
              additionalProperties: false,
            },
          },
          additionalProperties: false,
        },
        output: {
          schema: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              message: { type: 'string' },
              config: {
                type: 'object',
                properties: {
                  frequency: { type: 'string' },
                  defaultStyle: { type: 'string' },
                },
              },
            },
            required: ['ok', 'message'],
          },
          render: (_args: any, value: any) => [{
            type: 'text',
            text: value?.message ?? JSON.stringify(value),
          }],
        },
        execute: async (args: { patch?: { frequency?: string; defaultStyle?: string } }) => {
          if (args?.patch) {
            const patch: Partial<InfographicConfig> = {}
            if (isFrequency(args.patch.frequency)) patch.frequency = args.patch.frequency
            if (isStyle(args.patch.defaultStyle)) patch.defaultStyle = args.patch.defaultStyle
            currentConfig = saveConfig(patch)
            syncSystemPrompt()
            return {
              ok: true,
              config: currentConfig,
              message: `信息图设置已更新并即时生效：画图策略 = ${currentConfig.frequency}，默认风格 = ${currentConfig.defaultStyle}`,
            }
          }
          currentConfig = loadConfig()
          return {
            ok: true,
            config: currentConfig,
            message: `当前信息图设置：画图策略 = ${currentConfig.frequency}，默认风格 = ${currentConfig.defaultStyle}`,
          }
        },
      })
    } catch (err) {
      console.error('[infographic] failed to register config tool', err)
    }
  })

  // 3. WebServer route for settings sync from browser client
  ctx.inject(['webServer'], (wsCtx: any) => {
    try {
      wsCtx.webServer?.register?.({
        kind: 'prefix',
        path: '/api/infographic',
        handler: async (req: any, res: any) => {
          const url = new URL(req.url, 'http://127.0.0.1')
          if (url.pathname === '/api/infographic/config') {
            if (req.method === 'GET') {
              currentConfig = loadConfig()
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true, config: currentConfig }))
              return
            }
            if (req.method === 'POST') {
              let body = ''
              req.on('data', (chunk: Buffer) => {
                body += chunk.toString('utf8')
              })
              req.on('end', () => {
                try {
                  const data = JSON.parse(body)
                  currentConfig = saveConfig(data.patch || data)
                  syncSystemPrompt()
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ ok: true, config: currentConfig }))
                } catch (e: any) {
                  res.statusCode = 400
                  res.end(JSON.stringify({ ok: false, error: e?.message || 'Invalid JSON' }))
                }
              })
              return
            }
          }
          res.statusCode = 404
          res.end(JSON.stringify({ ok: false, error: 'Not found' }))
        },
      })
    } catch {
      // webServer not available in this profile / environment
    }
  })
}
