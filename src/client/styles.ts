export const STYLE_ID = 'dsh-infographic-style'

export const CSS = `
[data-infographic-host]{display:block;margin:12px 0;max-width:720px;color:inherit}
[data-infographic-host] .dsh-ig-stage{display:block;line-height:0}
[data-infographic-host] .dsh-ig-stage>svg{display:block;width:100%;max-width:640px;height:auto}
[data-infographic-host] .dsh-ig-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:6px;font:12px/1.4 system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif}
[data-infographic-host] .dsh-ig-bar button{font:inherit;color:inherit;background:transparent;border:1px solid color-mix(in srgb,currentColor 20%,transparent);border-radius:6px;padding:2px 9px;cursor:pointer;opacity:.72}
[data-infographic-host] .dsh-ig-bar button:hover,[data-infographic-host] .dsh-ig-bar button:focus-visible{opacity:1;background:color-mix(in srgb,currentColor 8%,transparent)}
[data-infographic-host] .dsh-ig-bar select.dsh-ig-style{font:inherit;color:inherit;background:transparent;border:1px solid color-mix(in srgb,currentColor 20%,transparent);border-radius:6px;padding:2px 6px;cursor:pointer;opacity:.72;margin-left:auto;max-width:11em}
[data-infographic-host] .dsh-ig-bar select.dsh-ig-style:hover,[data-infographic-host] .dsh-ig-bar select.dsh-ig-style:focus-visible{opacity:1}
[data-infographic-host] .dsh-ig-bar select.dsh-ig-style option{color:#2C2C2A;background:#FFFFFF}
[data-infographic-host] .dsh-ig-warn{opacity:.55;cursor:help}
[data-infographic-diagnostic]{display:block;margin:8px 0 4px;padding:8px 12px;border-radius:8px;border:1px solid color-mix(in srgb,#d03a2f 45%,transparent);background:color-mix(in srgb,#d03a2f 8%,transparent);font:13px/1.5 system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif}
`
