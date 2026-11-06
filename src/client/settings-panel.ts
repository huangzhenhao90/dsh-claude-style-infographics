/**
 * Official DSH Settings Section Panel for dsh-infographic.
 * Rendered inside DSH's native Settings modal under the "信息图设置" (Infographics) section.
 * Built using React.createElement (h) with native DSH design tokens.
 */
import {
  DEFAULT_FREQUENCY,
  isFrequency,
  type Frequency,
  type InfographicConfig,
} from '../core/config.ts'
import {
  DEFAULT_STYLE,
  isStyle,
  type StyleName,
} from '../core/palettes.ts'

interface ReactApi {
  createElement: (...args: any[]) => any
  useState: <T>(init: T | (() => T)) => [T, (next: T | ((prev: T) => T)) => void]
  useEffect: (effect: () => void | (() => void), deps?: any[]) => void
  useCallback: <T extends (...args: any[]) => any>(fn: T, deps: any[]) => T
  useRef: <T>(init?: T) => { current: T }
}

// Resolve React from DSH host environment
function resolveReact(): ReactApi | null {
  if (typeof window !== 'undefined' && (window as any).React) {
    return (window as any).React as ReactApi
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react') as ReactApi
  } catch {
    return null
  }
}

const FREQ_STORAGE_KEY = 'dsh-infographic:frequency'
const STYLE_STORAGE_KEY = 'dsh-infographic:style'
const CONFIG_ROUTE = '/api/infographic/config'

interface FrequencyMeta {
  id: Frequency
  icon: string
  titleZh: string
  titleEn: string
  tagZh: string
  tagEn: string
  descZh: string
  descEn: string
}

const FREQ_OPTIONS: FrequencyMeta[] = [
  {
    id: 'high',
    icon: '🔥',
    titleZh: '积极模式（视觉优先）',
    titleEn: 'Visual First (High)',
    tagZh: '适合汇报复盘与高密度展示',
    tagEn: 'Great for decks & reports',
    descZh: '只要涉及业务流程、分层架构、数据对比、走势或市场份额，优先画图，用图表主导回答。',
    descEn: 'Prioritizes infographics for workflows, architectures, metrics, and breakdowns.',
  },
  {
    id: 'medium',
    icon: '⚖️',
    titleZh: '平衡模式（克制平衡）',
    titleEn: 'Balanced (Recommended)',
    tagZh: '默认推荐',
    tagEn: 'Default',
    descZh: '当且仅当图表比纯文字更直观高效时才画；两三个简单要点直接写文字，避免为了画图而画图。',
    descEn: 'Draws diagrams only when visually superior to prose; simple points remain plain text.',
  },
  {
    id: 'low',
    icon: '🤫',
    titleZh: '克制模式（文字优先）',
    titleEn: 'Text First (Low)',
    tagZh: '适合纯文字与代码调试',
    tagEn: 'Focus & quiet mode',
    descZh: '日常严格保持纯文字交流，绝不主动画图；只有当提问中明确要求“画图”时才绘制。',
    descEn: 'Strictly text-only by default; generates infographics only upon explicit request.',
  },
]

interface StyleMeta {
  id: StyleName
  nameZh: string
  nameEn: string
  tagZh: string
  tagEn: string
  descZh: string
  descEn: string
  colors: string[]
}

const STYLE_OPTIONS: StyleMeta[] = [
  {
    id: 'claude',
    nameZh: 'Claude 官方默认',
    nameEn: 'Claude (Default)',
    tagZh: '官方经典',
    tagEn: 'Official',
    descZh: '温润优雅的紫/青/珊瑚多色系，对比清晰，适合日常绝大多数沟通场景。',
    descEn: 'Warm purple, teal, and coral palette with clear contrasts for general diagrams.',
    colors: ['#7F22FE', '#009688', '#F26522', '#1877F2'],
  },
  {
    id: 'mckinsey',
    nameZh: 'McKinsey 麦肯锡',
    nameEn: 'McKinsey',
    tagZh: '商务咨询',
    tagEn: 'Consulting',
    descZh: '标志性青蓝 (#2CBDEF) 主色 + 纯中性浅灰，高反差极简，专为汇报复盘与严谨商业图表打造。',
    descEn: 'Signature cyan (#2CBDEF) and neutral light grey; minimalist high contrast for decks.',
    colors: ['#2CBDEF', '#D4D4D4', '#051C2C', '#8C8C8C'],
  },
  {
    id: 'bcg',
    nameZh: 'BCG 波士顿咨询',
    nameEn: 'BCG',
    tagZh: '单色绿系',
    tagEn: 'Monochrome Green',
    descZh: '经典绿色 (#2ca02c) 单色系，白底无网格，通过明度梯度严谨区分数据层次。',
    descEn: 'Classic green monochrome on white; uses disciplined lightness steps for series.',
    colors: ['#2CA02C', '#177B57', '#52C41A', '#0C1F17'],
  },
  {
    id: 'economist',
    nameZh: 'The Economist 经济学人',
    nameEn: 'The Economist',
    tagZh: '政经周刊',
    tagEn: 'Editorial',
    descZh: '醒目红横线与红方块版头 + 编辑蓝主系列，米白底色，经典权威政经周刊质感。',
    descEn: 'Signature red masthead ribbon + editorial blue series on warm off-white canvas.',
    colors: ['#E3120B', '#006BA2', '#3EBCD2', '#F5F2EC'],
  },
]

export function createSettingsPanel(ctx: any): (props?: any) => any {
  return function InfographicSettingsPanel() {
    const React = resolveReact()
    if (!React) {
      return null
    }

    const h = React.createElement
    const { useState, useEffect, useCallback, useRef } = React

    const isZh = (() => {
      try {
        const loc = ctx.locale?.getLocale?.()?.active || ctx.locale?.get?.() || ''
        return typeof loc === 'string' && loc.startsWith('zh')
      } catch {
        return true
      }
    })()

    const [frequency, setFrequency] = useState<Frequency>(DEFAULT_FREQUENCY)
    const [defaultStyle, setDefaultStyle] = useState<StyleName>(DEFAULT_STYLE)
    const [notice, setNotice] = useState<string | null>(null)
    const timerRef = useRef<any>(null)

    const notify = useCallback((msg: string) => {
      setNotice(msg)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setNotice(null), 3000)
    }, [])

    // Read initial settings from local storage and remote server
    useEffect(() => {
      let active = true

      try {
        const storedFreq = localStorage.getItem(FREQ_STORAGE_KEY)
        if (isFrequency(storedFreq)) setFrequency(storedFreq)
        const storedStyle = localStorage.getItem(STYLE_STORAGE_KEY)
        if (isStyle(storedStyle)) setDefaultStyle(storedStyle)
      } catch {}

      fetch(CONFIG_ROUTE, { cache: 'no-store' })
        .then(res => res.json())
        .then((data: { ok?: boolean; config?: InfographicConfig }) => {
          if (!active || !data?.ok || !data.config) return
          if (isFrequency(data.config.frequency)) {
            setFrequency(data.config.frequency)
            try {
              localStorage.setItem(FREQ_STORAGE_KEY, data.config.frequency)
            } catch {}
          }
          if (isStyle(data.config.defaultStyle)) {
            setDefaultStyle(data.config.defaultStyle)
            try {
              localStorage.setItem(STYLE_STORAGE_KEY, data.config.defaultStyle)
            } catch {}
          }
        })
        .catch(() => {})

      return () => {
        active = false
      }
    }, [])

    const updateConfig = useCallback(
      (patch: Partial<InfographicConfig>) => {
        if (patch.frequency) {
          setFrequency(patch.frequency)
          try {
            localStorage.setItem(FREQ_STORAGE_KEY, patch.frequency)
          } catch {}
        }
        if (patch.defaultStyle) {
          setDefaultStyle(patch.defaultStyle)
          try {
            localStorage.setItem(STYLE_STORAGE_KEY, patch.defaultStyle)
          } catch {}
          try {
            // Tell the fence renderer in this same window so charts repaint at once.
            window.dispatchEvent(new CustomEvent('dsh-infographic:style', { detail: patch.defaultStyle }))
          } catch {}
        }

        fetch(CONFIG_ROUTE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
          .then(res => res.json())
          .then((res: { ok?: boolean; message?: string }) => {
            if (res?.ok) {
              notify(
                isZh
                  ? '✓ 设置已保存并即时生效（下次提问自动采用）'
                  : '✓ Settings saved and active for subsequent turns',
              )
            }
          })
          .catch(() => {
            notify(isZh ? '本地已切换（后台同步稍后重试）' : 'Applied locally')
          })
      },
      [isZh, notify],
    )

    // Render Section
    return h(
      'section',
      {
        style: {
          maxWidth: 780,
          padding: '4px 0 32px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          color: 'var(--dsw-alias-label-primary, #1e293b)',
          fontFamily: 'inherit',
        },
      },
      // Header
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 10 } },
          h('span', { style: { fontSize: 24 } }, '📊'),
          h(
            'h2',
            {
              style: {
                margin: 0,
                fontSize: 20,
                fontWeight: 600,
                lineHeight: '28px',
                color: 'var(--dsw-alias-label-primary, #0f172a)',
              },
            },
            isZh ? '信息图设置 (Claude Style Infographics)' : 'Claude Style Infographics',
          ),
        ),
        h(
          'p',
          {
            style: {
              margin: 0,
              fontSize: 13,
              lineHeight: '20px',
              color: 'var(--dsw-alias-label-tertiary, #64748b)',
            },
          },
          isZh
            ? '在对话中自动或手动将业务流程、数据对比、时间线、分层架构等复杂信息绘制成高质量的现代咨询风格信息图。'
            : 'Turn complex workflows, architectures, metrics, and timelines into clean consulting-grade infographics.',
        ),
      ),

      // Notice Toast Banner
      notice
        ? h(
            'div',
            {
              style: {
                padding: '10px 14px',
                borderRadius: 8,
                background: 'var(--dsw-alias-bg-hover, #ecfdf5)',
                border: '1px solid var(--dsw-alias-state-success-primary, #10b981)',
                color: 'var(--dsw-alias-state-success-primary, #047857)',
                fontSize: 13,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              },
            },
            h('span', null, notice),
          )
        : null,

      // 1. Frequency Section
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        h(
          'div',
          null,
          h(
            'h3',
            {
              style: {
                margin: '0 0 4px 0',
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--dsw-alias-label-primary, #0f172a)',
              },
            },
            isZh ? '1. 画图频率策略 (Generation Frequency)' : '1. Generation Frequency',
          ),
          h(
            'p',
            {
              style: {
                margin: 0,
                fontSize: 12,
                color: 'var(--dsw-alias-label-tertiary, #64748b)',
              },
            },
            isZh
              ? '控制 AI 在回答时主动画图的积极程度（即时生效，由系统提示词策略动态引导）。'
              : 'Governs how proactively the AI introduces visual diagrams during conversation.',
          ),
        ),
        h(
          'div',
          {
            style: {
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
              gap: 12,
            },
          },
          FREQ_OPTIONS.map(opt => {
            const active = frequency === opt.id
            return h(
              'div',
              {
                key: opt.id,
                onClick: () => updateConfig({ frequency: opt.id }),
                style: {
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: '14px 16px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  border: active
                    ? '2px solid var(--dsw-alias-button-primary-fill, #3b82f6)'
                    : '1px solid var(--dsw-alias-border-l2, #e2e8f0)',
                  background: active
                    ? 'var(--dsw-alias-bg-hover, rgba(59, 130, 246, 0.05))'
                    : 'var(--dsw-alias-bg-container, #ffffff)',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                },
              },
              h(
                'div',
                {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  },
                },
                h(
                  'div',
                  { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                  h('span', { style: { fontSize: 18 } }, opt.icon),
                  h(
                    'span',
                    {
                      style: {
                        fontSize: 14,
                        fontWeight: active ? 600 : 500,
                        color: 'var(--dsw-alias-label-primary, #0f172a)',
                      },
                    },
                    isZh ? opt.titleZh : opt.titleEn,
                  ),
                ),
                active
                  ? h(
                      'span',
                      {
                        style: {
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: 'var(--dsw-alias-button-primary-fill, #3b82f6)',
                          color: '#ffffff',
                        },
                      },
                      isZh ? '当前' : 'Active',
                    )
                  : null,
              ),
              h(
                'p',
                {
                  style: {
                    margin: 0,
                    fontSize: 12,
                    lineHeight: '18px',
                    color: 'var(--dsw-alias-label-tertiary, #64748b)',
                    flex: 1,
                  },
                },
                isZh ? opt.descZh : opt.descEn,
              ),
              h(
                'div',
                {
                  style: {
                    fontSize: 11,
                    color: active
                      ? 'var(--dsw-alias-button-primary-fill, #2563eb)'
                      : 'var(--dsw-alias-label-tertiary, #94a3b8)',
                    fontWeight: active ? 500 : 400,
                    borderTop: '1px dashed var(--dsw-alias-border-l2, #f1f5f9)',
                    paddingTop: 6,
                  },
                },
                isZh ? opt.tagZh : opt.tagEn,
              ),
            )
          }),
        ),
      ),

      // 2. Default Style Section
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        h(
          'div',
          null,
          h(
            'h3',
            {
              style: {
                margin: '0 0 4px 0',
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--dsw-alias-label-primary, #0f172a)',
              },
            },
            isZh ? '2. 全局默认视觉风格 (Default Visual Style)' : '2. Default Visual Style',
          ),
          h(
            'p',
            {
              style: {
                margin: 0,
                fontSize: 12,
                color: 'var(--dsw-alias-label-tertiary, #64748b)',
              },
            },
            isZh
              ? '新生成的图表将默认使用所选风格呈现，亦可在单张图表底部临时切换。'
              : 'Sets the baseline aesthetic theme for all newly generated diagrams.',
          ),
        ),
        h(
          'div',
          {
            style: {
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
              gap: 12,
            },
          },
          STYLE_OPTIONS.map(opt => {
            const active = defaultStyle === opt.id
            return h(
              'div',
              {
                key: opt.id,
                onClick: () => updateConfig({ defaultStyle: opt.id }),
                style: {
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: '14px 16px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  border: active
                    ? '2px solid var(--dsw-alias-button-primary-fill, #3b82f6)'
                    : '1px solid var(--dsw-alias-border-l2, #e2e8f0)',
                  background: active
                    ? 'var(--dsw-alias-bg-hover, rgba(59, 130, 246, 0.05))'
                    : 'var(--dsw-alias-bg-container, #ffffff)',
                  transition: 'all 0.15s ease',
                },
              },
              h(
                'div',
                {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  },
                },
                h(
                  'span',
                  {
                    style: {
                      fontSize: 14,
                      fontWeight: active ? 600 : 500,
                      color: 'var(--dsw-alias-label-primary, #0f172a)',
                    },
                  },
                  isZh ? opt.nameZh : opt.nameEn,
                ),
                active
                  ? h(
                      'span',
                      {
                        style: {
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: 'var(--dsw-alias-button-primary-fill, #3b82f6)',
                          color: '#ffffff',
                        },
                      },
                      isZh ? '默认' : 'Default',
                    )
                  : null,
              ),
              // Color Swatches
              h(
                'div',
                { style: { display: 'flex', gap: 6, margin: '2px 0' } },
                opt.colors.map((c, i) =>
                  h('span', {
                    key: i,
                    style: {
                      display: 'inline-block',
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      backgroundColor: c,
                      border: '1px solid rgba(0,0,0,0.1)',
                    },
                  }),
                ),
              ),
              h(
                'p',
                {
                  style: {
                    margin: 0,
                    fontSize: 12,
                    lineHeight: '18px',
                    color: 'var(--dsw-alias-label-tertiary, #64748b)',
                    flex: 1,
                  },
                },
                isZh ? opt.descZh : opt.descEn,
              ),
              h(
                'div',
                {
                  style: {
                    fontSize: 11,
                    color: active
                      ? 'var(--dsw-alias-button-primary-fill, #2563eb)'
                      : 'var(--dsw-alias-label-tertiary, #94a3b8)',
                    fontWeight: active ? 500 : 400,
                    borderTop: '1px dashed var(--dsw-alias-border-l2, #f1f5f9)',
                    paddingTop: 6,
                  },
                },
                isZh ? opt.tagZh : opt.tagEn,
              ),
            )
          }),
        ),
      ),

      // Footer Meta Information
      h(
        'div',
        {
          style: {
            borderTop: '1px solid var(--dsw-alias-border-l2, #e2e8f0)',
            paddingTop: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            fontSize: 12,
            color: 'var(--dsw-alias-label-tertiary, #94a3b8)',
          },
        },
        h(
          'div',
          null,
          isZh
            ? '💡 提示：在日常对话中也可以直接告诉 AI “把画图频率改成高” 或 “默认风格换成麦肯锡”，AI 将调用配置工具即时生效。'
            : '💡 Tip: You can also tell the AI directly in chat to change the frequency or default style.',
        ),
        h(
          'div',
          null,
          isZh
            ? '配置同步落盘路径：~/.dsh/infographic/config.json'
            : 'Configuration persisted at: ~/.dsh/infographic/config.json',
        ),
      ),
    )
  }
}
