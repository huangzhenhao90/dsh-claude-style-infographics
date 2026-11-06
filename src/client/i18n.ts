export type Locale = 'zh' | 'en'

const LABELS = {
  zh: {
    copySvg: '复制 SVG',
    downloadSvg: '下载 SVG',
    downloadPng: '下载 PNG',
    source: '源码',
    hideSource: '收起源码',
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
    copySvg: 'Copy SVG',
    downloadSvg: 'Download SVG',
    downloadPng: 'Download PNG',
    source: 'Source',
    hideSource: 'Hide source',
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
  return tag.startsWith('zh') ? 'zh' : 'en'
}

export function label(locale: Locale, key: LabelKey): string {
  return LABELS[locale][key]
}
