export type Locale = 'zh' | 'en'

const LABELS = {
  zh: {
    copyPng: '复制 PNG',
    downloadPng: '下载 PNG',
    settings: '设置',
    settingsTitle: '信息图设置',
    settingsFrequency: '画图频率',
    settingsFreqHigh: '🔥 积极 (高)',
    settingsFreqHighDesc: '视觉优先，多出图表',
    settingsFreqMedium: '⚖️ 平衡 (中)',
    settingsFreqMediumDesc: '比文字更清晰时画图',
    settingsFreqLow: '🤫 克制 (低)',
    settingsFreqLowDesc: '文字优先，仅在明确提问时画',
    settingsDefaultStyle: '全局默认风格',
    settingsSaved: '已生效',
    copied: '已复制',
    failed: '失败',
    diagnostic: '信息图无法渲染',
    diagnosticHint: '下方保留原始代码块。',
    errorJson: '围栏内容不是合法的 JSON',
    errorKind: '"infographic" 必须是 flow、bar、line、donut、cards、timeline、layers 之一',
    errorEmpty: '没有可画的内容，请检查该类型的必填字段',
    warnings: '已自动修正',
    chart: '信息图',
  },
  en: {
    copyPng: 'Copy PNG',
    downloadPng: 'Download PNG',
    settings: 'Settings',
    settingsTitle: 'Infographic Settings',
    settingsFrequency: 'Drawing Frequency',
    settingsFreqHigh: '🔥 High (Proactive)',
    settingsFreqHighDesc: 'Visual-first, frequent charts',
    settingsFreqMedium: '⚖️ Medium (Balanced)',
    settingsFreqMediumDesc: 'Only when clearer than text',
    settingsFreqLow: '🤫 Low (Minimal)',
    settingsFreqLowDesc: 'Text-first, on request only',
    settingsDefaultStyle: 'Default Visual Style',
    settingsSaved: 'Saved',
    copied: 'Copied',
    failed: 'Failed',
    diagnostic: 'Infographic could not be rendered',
    diagnosticHint: 'The original code block is kept below.',
    errorJson: 'The fence body is not valid JSON',
    errorKind: '"infographic" must be one of flow, bar, line, donut, cards, timeline, layers',
    errorEmpty: 'Nothing to draw yet — check the required fields for this kind',
    warnings: 'auto-corrected',
    chart: 'Infographic',
  },
} as const

export type LabelKey = keyof (typeof LABELS)['zh']

export function detectLocale(doc: Document = document): Locale {
  const tag = (doc.documentElement.lang || (typeof navigator === 'undefined' ? '' : navigator.language) || '').toLowerCase()
  // Chinese is the default; only an explicitly English UI gets English labels.
  return tag.startsWith('en') ? 'en' : 'zh'
}

export function label(locale: Locale, key: LabelKey): string {
  return LABELS[locale][key]
}
