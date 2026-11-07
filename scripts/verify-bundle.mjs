import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const lib = new URL(`../${process.env.DSH_OUT ?? 'lib'}/`, import.meta.url)
const read = name => readFileSync(fileURLToPath(new URL(name, lib)), 'utf8')
const problems = []

const client = read('client.js')
if (/\bimport\s*[({"']/.test(client) || /\bexport\s+(default|\{|const|function)/.test(client)) problems.push('client.js: must be a plain CJS script')
if (/\beval\(|new Function\(/.test(client)) problems.push('client.js: eval is not allowed')
{
  let loaded
  const sandbox = {
    window: { __ModuleLoader__: { load: entry => { loaded = entry } } },
    console: { info() {}, warn() {} },
  }
  sandbox.window.window = sandbox.window
  try {
    vm.runInNewContext(client, { ...sandbox, globalThis: sandbox }, { filename: 'client.js' })
    if (loaded === undefined) problems.push('client.js: did not call window.__ModuleLoader__.load')
    else {
      if (loaded.id !== '@huangzhenhao90/dsh-infographic') problems.push(`client.js: module id is ${loaded.id}`)
      const exported = loaded.factory(request => { throw new Error(`unexpected require("${request}")`) })
      if (typeof exported.apply !== 'function') problems.push('client.js: apply export missing')
      if (!Array.isArray(exported.inject)) problems.push('client.js: inject export missing')
    }
  } catch (error) {
    problems.push(`client.js: failed to load in the module-loader protocol (${error.message})`)
  }
}

const node = read('index.js')
if (!/\bname\b/.test(node) || !node.includes('@huangzhenhao90/dsh-infographic')) problems.push('index.js: plugin name missing')
if (/from ['"]\.\.?\//.test(node)) problems.push('index.js: unbundled relative import')

const globalBuild = read('infographic.global.js')
if (!globalBuild.includes('DshInfographic')) problems.push('infographic.global.js: window.DshInfographic missing')

const patch = readFileSync(fileURLToPath(new URL('../cordis.patch.yml', import.meta.url)), 'utf8')
const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'))
if (!patch.includes(`'${pkg.name}'`)) problems.push('cordis.patch.yml: package name does not match package.json')
if (pkg.dsh?.client && !pkg.exports?.['./client']) problems.push('package.json: dsh.client declared but exports["./client"] is missing')

if (problems.length > 0) {
  for (const problem of problems) console.error(problem)
  process.exit(1)
}
console.log('bundle ok')
