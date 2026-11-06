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

export const name = '@huangzhenhao90/dsh-infographic'
export const inject = ['systemPrompt']

const SKILL_NAME = 'infographic'
const SKILL_RANK = 600
const SKILL_INVOCATION = { modelInvocable: true, userInvocable: true } as const

export const SECTION_TEXT = `Draw an infographic inside your reply with a fenced \`infographic\` JSON block, when a diagram or chart explains a process, comparison, trend, share, milestone list or system structure faster than prose:

\`\`\`infographic
{"infographic":"bar","title":"…","categories":["Q1","Q2"],"series":[{"name":"…","data":[38,42]}]}
\`\`\`

- The first key is "infographic": flow | bar | line | donut | cards | timeline | layers. Language tag is exactly \`infographic\`; the JSON is the only content (no SVG, HTML, Markdown or comments).
- flow: nodes[{id,label,sub?,shape?:box|pill|diamond,color?}] + edges[["from","to","label?"]], direction down|right. bar/line: categories[] + series[{name,data[],color?}], unit?, horizontal?, stacked?, area?. donut: data[{label,value}], center?{value,label}. cards: items[{label,value,delta?,note?}]. timeline: items[{time?,title,desc?}]. layers: layers[{label,items[{label,sub?}]}], arrows?.
- Optional on every kind: title, subtitle, note (data source / unit / "sample data"), style (claude | mckinsey | bcg | economist — match the house style of the document it lands in; default claude). Colours are names only: purple teal coral pink gray blue green amber red.
- Write the fence in the answer body, never in reasoning. Write all visible text in the user's language. Do not repeat the chart's content in prose. Never invent numbers; mark illustrative data in note.
- Load the \`infographic\` skill for the full field reference and examples before your first use in a session.`

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

export function apply(ctx: Context): void {
  ctx.systemPrompt.section({
    name: 'infographic:fence',
    order: ctx.systemPrompt.getSectionOrder('STRUCTURED_OUTPUT'),
    text: SECTION_TEXT,
  })
  ctx.inject(['skills'], skillCtx => {
    skillCtx.skills.registerProvider(() => bundledSkillProvider())
  })
}
