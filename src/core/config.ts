import { DEFAULT_FREQUENCY, DEFAULT_STYLE, FREQUENCIES, STYLES, type Frequency, type StyleName } from './types.js'

/** Generate dynamic system prompt section text based on frequency and default style. */
export function buildPromptSection(frequency: Frequency, defaultStyle: StyleName): string {
  let policy = ''
  switch (frequency) {
    case 'high':
      policy =
        '视觉优先（积极模式）：默认每一条实质性回答都要配至少一张信息图，不要等用户提醒。只要回答涉及业务流程、步骤流转、系统分层架构、数据量化对比、周期走势、里程碑、市场份额、分类枚举、多类要点并列、事件梳理或结论汇总，就必须绘制信息图，用图表主导回答，正文仅作简明结论。判断标准从宽：宁可多画一张，也不要漏画；只有纯寒暄、单一事实确认或完全无法结构化的闲谈才可以不配图。若内容超过一张图能讲清的范围，拆成多张（每张只讲一个问题），而不是省掉不画。'
      break
    case 'low':
      policy =
        '文字优先（克制模式）：日常对话严格保持纯文字交流，绝不主动画图；只有当用户提问中明确要求“画图”、“画信息图”、“做图表”时，才绘制信息图。'
      break
    case 'medium':
    default:
      policy =
        '克制平衡（平衡模式）：当且仅当图表比纯文字更清晰直观高效时才画；两三个简单要点直接写文字，避免为了画图而画图。'
      break
  }

  return `Draw an infographic inside your reply with a fenced \`infographic\` JSON block:

\`\`\`infographic
{"infographic":"bar","title":"…","categories":["Q1","Q2"],"series":[{"name":"…","data":[38,42]}]}
\`\`\`

- 画图策略：${policy}
- 默认图形风格：${defaultStyle}（除非用户在提问中指定其他风格，否则无需在 JSON 中声明 style 字段，自动使用 ${defaultStyle} 风格绘制）。
- The first key is "infographic": flow | bar | line | donut | cards | timeline | layers. Language tag is exactly \`infographic\`; the JSON is the only content (no SVG, HTML, Markdown or comments).
- flow: nodes[{id,label,sub?,shape?:box|pill|diamond,color?}] + edges[["from","to","label?"]], direction down|right. bar/line: categories[] + series[{name,data[],color?}], unit?, horizontal?, stacked?, area?. donut: data[{label,value}], center?{value,label}. cards: items[{label,value,delta?,note?}]. timeline: items[{time?,title,desc?}]. layers: layers[{label,items[{label,sub?}]}], arrows?.
- Optional on every kind: title, subtitle, note (data source / unit / "sample data"), style (${STYLES.join(' | ')} — 默认已为 ${defaultStyle}）。Colours are names only: purple teal coral pink gray blue green amber red.
- Write the fence in the answer body, never in reasoning. Write all visible text in the user's language. Do not repeat the chart's content in prose. Never invent numbers; mark illustrative data in note.
- Load the \`infographic\` skill for the full field reference and examples before your first use in a session.`
}

export function isFrequency(value: unknown): value is Frequency {
  return typeof value === 'string' && (FREQUENCIES as readonly string[]).includes(value)
}
