import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { apply, inject, name, SECTION_TEXT } from '../src/index.ts'
import { KINDS } from '../src/core/index.ts'

const root = join(import.meta.dirname, '..')

describe('node plugin', () => {
  it('registers a system prompt section and the bundled skill', async () => {
    const sections: { name: string; order: number; text: string }[] = []
    const providers: (() => unknown)[] = []
    const ctx = {
      systemPrompt: {
        section: (entry: { name: string; order: number; text: string }) => sections.push(entry),
        getSectionOrder: (key: string) => (key === 'STRUCTURED_OUTPUT' ? 42 : -1),
      },
      inject: (_services: string[], callback: (value: unknown) => void) => {
        callback({ skills: { registerProvider: (factory: () => unknown) => providers.push(factory) } })
      },
    }
    apply(ctx as never)
    expect(sections).toHaveLength(1)
    expect(sections[0]).toMatchObject({ name: 'infographic:fence', order: 42 })
    expect(providers).toHaveLength(1)
    const provider = providers[0]?.() as { name: string; list(): Promise<{ name: string; description: string; source: string; path: string }[]>; get(): Promise<{ content: string }> }
    const [entry] = await provider.list()
    expect(entry).toMatchObject({ name: 'infographic', source: 'bundled' })
    expect(entry?.description.length).toBeGreaterThan(40)
    expect(entry?.path).toBe(join(root, 'dsh', 'SKILL.md'))
    expect((await provider.get()).content).toContain('# Infographic')
  })

  it('declares its host dependencies and a name that matches the manifest and patch', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { name: string; exports: Record<string, unknown>; dsh: { bundle: { patch: string }; client: { platform: string } } }
    expect(name).toBe(pkg.name)
    expect(inject).toContain('systemPrompt')
    expect(readFileSync(join(root, pkg.dsh.bundle.patch), 'utf8')).toContain(`'${pkg.name}'`)
    expect(pkg.dsh.client.platform).toBe('web')
    expect(pkg.exports?.['./client']).toBeDefined()
  })

  it('documents every kind in the prompt section and in SKILL.md', () => {
    const skill = readFileSync(join(root, 'dsh', 'SKILL.md'), 'utf8')
    for (const kind of KINDS) {
      expect(SECTION_TEXT).toContain(kind)
      expect(skill).toContain(`### ${kind} —`)
    }
  })

  it('keeps every json example in SKILL.md renderable', async () => {
    const { readFence } = await import('../src/core/index.ts')
    const skill = readFileSync(join(root, 'dsh', 'SKILL.md'), 'utf8')
    const fences = [...skill.matchAll(/```infographic\n(.*?)\n```/gs)].map(match => match[1] as string)
    const complete = fences.filter(body => body.startsWith('{"infographic":"') && !body.includes('…'))
    expect(complete.length).toBeGreaterThanOrEqual(7)
    for (const body of complete) expect(readFence(body).status, body.slice(0, 60)).toBe('ok')
  })
})
