// Build into lib.next and swap it into place only once everything succeeded.
// DSH watches the linked plugin directory, so wiping lib/ up front (the old `clean`) made the host reload a
// plugin with no files at all, and a failed build left it that way.
import { execFileSync } from 'node:child_process'
import { existsSync, renameSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const path = name => fileURLToPath(new URL(`../${name}`, import.meta.url))
const out = 'lib.next'
const env = { ...process.env, DSH_OUT: out }
const run = (command, args) => execFileSync(command, args, { cwd: root, env, stdio: 'inherit' })

rmSync(path(out), { recursive: true, force: true })
try {
  run('pnpm', ['exec', 'tsc', '-p', 'tsconfig.json', '--outDir', out, '--declarationDir', `${out}/types`])
  run('pnpm', ['exec', 'tsdown'])
  run('node', ['scripts/verify-bundle.mjs'])
} catch (error) {
  rmSync(path(out), { recursive: true, force: true })
  throw error
}
rmSync(path('lib.old'), { recursive: true, force: true })
if (existsSync(path('lib'))) renameSync(path('lib'), path('lib.old'))
renameSync(path(out), path('lib'))
rmSync(path('lib.old'), { recursive: true, force: true })
console.log('lib updated')
