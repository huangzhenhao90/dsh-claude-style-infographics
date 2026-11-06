# Third-party notices

## dsh-genui (MIT)

The DSH integration follows the approach of [`omdsh-dev/dsh-genui`](https://github.com/omdsh-dev/dsh-genui) (`@changfenhuang/dsh-genui`): the package layout of a node half plus a browser half, the `dsh` block in `package.json`, `cordis.patch.yml`, the module-loader wrapper of the client bundle, the bundled-skill provider, and the DOM fence-discovery heuristics (code-block surface selectors, "banner label + one `<pre>`" detection, the `[data-streaming]` marker, the "message-level container" guard, and repairing the mount after host re-renders). The code in `src/client/dom-fence.ts` and `src/index.ts` is a fresh, much smaller implementation written for this project, not a copy.

```
MIT License

Copyright (c) 2026 dsh-external

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## pi-generative-ui

The visual system (the nine colour ramps, the 680px canvas, flat style, light/dark pairing) comes from the design rules in [`Michaelliv/pi-generative-ui`](https://github.com/Michaelliv/pi-generative-ui), as already credited in `README.md` and `skill/`. `src/core/theme.ts` re-expresses those rules as data.
