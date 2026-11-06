/**
 * Four outputs:
 *  - lib/index.js            node half (system prompt + bundled skill), ESM
 *  - lib/core.js             DOM-free renderer, neutral ESM (`@huangzhenhao90/dsh-infographic/core`)
 *  - lib/client.js           browser half, CJS wrapped in the DSH module-loader protocol
 *  - lib/infographic.global.js  plain <script> build exposing window.DshInfographic
 */
import type { UserConfig } from 'tsdown'

const ID = '@huangzhenhao90/dsh-infographic'

const define = {
  'process.env.NODE_ENV': JSON.stringify('production'),
}

const nodeConfig: UserConfig = {
  name: `${ID}/node`,
  entry: { index: 'src/index.ts' },
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
  outputOptions: { entryFileNames: '[name].js' },
}

const coreConfig: UserConfig = {
  name: `${ID}/core`,
  entry: { core: 'src/core/index.ts' },
  outDir: 'lib',
  format: ['esm'],
  platform: 'neutral',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
  outputOptions: { entryFileNames: '[name].js' },
}

const clientConfig: UserConfig = {
  name: `${ID}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  minify: true,
  sourcemap: false,
  clean: false,
  deps: {
    alwaysBundle: () => true,
    neverBundle: ['react', 'react/jsx-runtime', 'react-dom'],
  },
  define,
  outputOptions: {
    entryFileNames: 'client.js',
    codeSplitting: false,
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

const globalConfig: UserConfig = {
  name: `${ID}/global`,
  entry: { 'infographic.global': 'src/global.ts' },
  outDir: 'lib',
  format: 'iife',
  platform: 'browser',
  dts: false,
  minify: true,
  sourcemap: false,
  clean: false,
  deps: { alwaysBundle: () => true },
  define,
  outputOptions: { entryFileNames: '[name].js', codeSplitting: false },
}

export default [nodeConfig, coreConfig, clientConfig, globalConfig]
