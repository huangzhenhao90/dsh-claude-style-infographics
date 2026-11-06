# Claude infographic Charts

让任何大模型都能生成 Claude artifact 风格的专业图表、流程图和交互式可视化。现在有两种用法：

| | 提示词 Skill（原有） | DSH 嵌入模式（新增） |
|---|---|---|
| 模型输出 | 整段 SVG / HTML 文件 | 一小段 `infographic` JSON 规格 |
| 渲染位置 | 你自己保存、打开 | 直接画在 DeepSeek Harness（DSH）对话里 |
| 流式 | 写完才能看 | 边写边画 |
| 安全 | 取决于你怎么打开文件 | 不执行模型写的任何标记，只画白名单里的七种图 |
| 导出 | 文件本身 | 复制 / 下载 SVG，下载 PNG |
| 适合 | 报告、PPT、公众号里的精修图；任意模型 | 对话里随手出图、改图 |

两种用法共用同一套视觉规范（9 色调色板、680px 画布、扁平风格、亮暗模式）。下面先讲 DSH 嵌入模式，原有 Skill 的说明在后面。

---

## DSH 嵌入模式

让模型在回答里写一段 ` ```infographic ` 围栏（内容是 JSON），DSH 对话界面把它当场画成 SVG 信息图，文字照常排在前后。

![流程图](docs/gallery/flow-request.svg)

![分组柱状图](docs/gallery/bar-grouped.svg)

七种图：`flow` 流程图 · `bar` 柱状图 · `line` 趋势线 · `donut` 占比 · `cards` 指标卡 · `timeline` 时间线 · `layers` 分层架构。全部示例在 [`docs/gallery/`](docs/gallery/)，对应规格在 [`examples/`](examples/)；每张图都有亮、暗两版（`*.light.svg` / `*.dark.svg`），默认版跟随系统。

### 它怎么工作

- **节点侧**（`src/index.ts`）：往系统提示词里加一小段围栏语法说明，并注册内置 Skill `infographic`（完整字段表和示例在 [`dsh/SKILL.md`](dsh/SKILL.md)）。
- **浏览器侧**（`src/client/`）：观察对话 DOM，找到 `infographic` 围栏，隐藏宿主的代码块，在原位挂一个由本插件拥有的容器，里面是渲染出来的 SVG 和工具栏。
- **渲染核心**（`src/core/`）：纯 TypeScript、无 DOM 依赖。`JSON → 校验补全 → SVG 字符串`；所有文字都转义，颜色只能取调色板里的名字，每张 SVG 的样式都带唯一前缀，同一页放多张也不会互相影响。
- **流式**：围栏还在输出时，用宽容解析器取"目前已完整的部分"重画，截断的最后一个 token 直接丢弃；写完后补上工具栏。
- **失败可见**：围栏最终写坏了（不是 JSON、缺必填内容），保留宿主原来的代码块，并在上方给出一行原因，不会静默消失。

### 安装

```bash
pnpm install
pnpm build
dsh plugin --profile web add link:/绝对路径/claude-infographic-charts
```

包名、节点侧导出的 `name`、`cordis.patch.yml` 三处保持一致（`@huangzhenhao90/dsh-infographic`）；包目前标记为 `private`，发布到 npm 前请先确认 scope。安装方式沿用 [dsh-genui](https://github.com/omdsh-dev/dsh-genui) 的 `dsh plugin add` 约定。

### 60 秒验证

装好、重启 DSH 后，对模型说："用 infographic 画一个用户登录的流程图，要有失败重试。" 应当看到：围栏变成流程图；输出过程中图会逐步成形；写完后图下方出现 `复制 SVG / 下载 SVG / 下载 PNG / 源码`。

### 规格速查

第一个键必须是 `"infographic"`。公共字段 `title` / `subtitle` / `note`。

| 类型 | 主要字段 |
|---|---|
| `flow` | `nodes[{id,label,sub?,shape?,color?}]`、`edges[["from","to","label?"]]`、`direction: down\|right` |
| `bar` | `categories[]`、`series[{name,data[],color?}]`、`horizontal?`、`stacked?`、`unit?` |
| `line` | 同 `bar`，另有 `area?` |
| `donut` | `data[{label,value}]`、`center?{value,label}` |
| `cards` | `items[{label,value,delta?,note?}]` |
| `timeline` | `items[{time?,title,desc?}]` |
| `layers` | `layers[{label,items[{label,sub?}]}]`、`arrows?` |

颜色只能写调色名：`purple teal coral pink gray blue green amber red`。各类型的数量上限、简写和选型建议见 [`dsh/SKILL.md`](dsh/SKILL.md)。

### 导出

- **复制 SVG / 下载 SVG**：独立 SVG 文件，按当前页面的亮暗主题烘焙成单一主题，可直接放进报告、网页；
- **下载 PNG**：2 倍分辨率，白底（暗色页面为深色底），可插入 PPT 和公众号；
- **PPT 原生对象导出尚未实现**，目前是把 PNG / SVG 作为图片插入。

### 非 DSH 页面

`lib/infographic.global.js` 是一个普通 `<script>` 构建，暴露 `window.DshInfographic`：

```html
<script src="infographic.global.js"></script>
<script>
  DshInfographic.installFenceChannel()                  // 把页面里的 infographic 代码块换成图
  const svg = DshInfographic.renderInfographic({ infographic: 'donut', data: [{ label: 'A', value: 3 }, { label: 'B', value: 1 }] })
</script>
```

只要代码块是 `<pre>`，且带 `infographic` 语言标签或内容以 `{"infographic":` 开头即可。纯渲染核心也可以单独使用：`import { renderInfographic } from '@huangzhenhao90/dsh-infographic/core'`。

### 开发

```bash
pnpm test        # 单元测试：宽容 JSON、规格校验、渲染、围栏读取、DOM 通道（jsdom）、节点插件
pnpm examples    # 重新生成 docs/gallery/ 里的 SVG
pnpm build       # tsc 类型声明 + tsdown 四个产物
pnpm check       # 清理 → 类型检查 → 测试 → 构建 → 产物协议检查 → 示例校验
```

`tests/browser/host.html` 是一个模拟 DSH 代码块结构的页面（含流式、写坏的围栏、整条消息容器、其他语言代码块），可以用任意 Chromium 打开 `lib/infographic.global.js` 做手动验证。

### 验证状态与尚未做的

- 已做：单元测试；在无头 Chrome 里用模拟 DSH 结构的页面跑通渲染、流式、暗色、被宿主清掉后的自动修复、PNG 导出。
- **尚未在真实 DSH 宿主里端到端验证**（插件加载、系统提示词注入、模型实际写出围栏）。宿主的 DOM 结构按 dsh-genui 的做法适配，若宿主版本变化导致发现失败，围栏会保持原样显示为代码块，不会丢内容。
- 暂未实现：围栏写坏时让模型自动重发的反馈回路、`validate` / `render` 模型工具、点击图元回传给模型的交互、PPT 原生导出。

> 说明：以下是原有的提示词 Skill 模式，内容未改动。

---

## 这是什么

这是一套提示词 Skill，提炼自 Claude 内置的生成式 UI 系统，将其视觉风格标准化为任何 LLM 都能遵循的规则文件。

Claude 的 artifact 图表有一套独特的设计语言：9 色调色系、680px viewBox 基准、极简扁平美学、完整的亮/暗模式支持。这套 Skill 把这些规则从 Claude 的专有渲染管线中剥离出来，变成独立的、可复用的提示词规范。

**输出格式两种：**
- **SVG 文件** — 静态图表、流程图、架构图、插画
- **HTML 文件** — 需要 JavaScript 的交互式图表（Chart.js、滑块、动画）

---

## 效果预览

### 1) Flowchart 示例（优先看这个）

![Flowchart demo](tests/test-flowchart.svg)

### 2) OpenClaw 架构概览

![OpenClaw overview](tests/openclaw-overview.svg)

### 3) 分组柱状图

![Bar chart demo](tests/test-bar-chart.svg)

### 4) 甜甜圈图

![Donut chart demo](tests/test-donut-chart.svg)

> 交互式示例见 `tests/test-interactive-benchmark.html`

---

## 文件结构

```
claude infographic charts/
├── README.md                         ← 你正在读的这个
├── dsh/SKILL.md                      ← DSH 嵌入模式的内置 Skill（infographic 围栏规格）
├── src/ · examples/ · docs/gallery/  ← DSH 插件源码 / 规格示例 / 渲染结果
├── lib/                              ← pnpm build 的产物（不入库）
├── skill/
│   ├── SKILL.md                      ← 主 Skill 文件（模块路由 + 格式决策 + 完整规范）
│   ├── diagram.md                    ← 流程图 / 结构图 / 说明图
│   ├── chart-types.md                ← 图表类型选择指南（9 种图表）
│   ├── mockup.md                     ← UI 组件 / 仪表盘 / 数据卡片
│   ├── interactive.md                ← 滑块 / 动画 / stepper 交互组件
│   └── art.md                        ← SVG 插画 / 几何图案
└── tests/
    ├── test-flowchart.svg            ← 测试流程图
    ├── openclaw-overview.svg         ← 架构概览图
    ├── test-bar-chart.svg            ← 柱状图示例
    ├── test-donut-chart.svg          ← 甜甜圈图示例
    └── test-interactive-benchmark.html ← 交互式 HTML 示例
```

---

## 设计系统核心

### 9 色调色板

| 色系   | 400（主色）| 600（描边）| 800（深色）|
|--------|-----------|-----------|-----------|
| purple | `#7F77DD` | `#534AB7` | `#3C3489` |
| teal   | `#1D9E75` | `#0F6E56` | `#085041` |
| coral  | `#D85A30` | `#993C1D` | `#712B13` |
| pink   | `#D4537E` | `#993556` | `#72243E` |
| gray   | `#888780` | `#5F5E5A` | `#444441` |
| blue   | `#378ADD` | `#185FA5` | `#0C447C` |
| green  | `#639922` | `#3B6D11` | `#27500A` |
| amber  | `#BA7517` | `#854F0B` | `#633806` |
| red    | `#E24B4A` | `#A32D2D` | `#791F1F` |

每个色系包含 7 个色阶（50 / 100 / 200 / 400 / 600 / 800 / 900），完整色表见 `skill/SKILL.md`。

### 三条核心规则

1. **ViewBox 宽度固定 680px** — 所有 SVG 使用 `viewBox="0 0 680 H"`，`width="100%"`
2. **Flat 美学** — 无渐变、无阴影、无模糊，字重只用 400 / 500
3. **格式决策** — 静态内容 → SVG；需要 JS 交互 → 自包含 HTML

---

## 使用方法

### 在 Claude Code / Cowork 中作为 Skill

将整个仓库文件夹放入你的项目目录下的 `.claude/skills/` 中，并重命名为 `claude-svg-charts`，即可被 Claude Code 自动识别为可调用的 Skill。

### 作为提示词上下文（任何模型）

直接将 `skill/SKILL.md` 的内容作为 system prompt 或 context 传给任何 LLM，让它生成对应风格的 SVG 或 HTML 文件。需要更详细规范时，附上对应的 `skill/*.md` 模块文件。

### 五个视觉模块

| 模块 | 参考文件 | 适用场景 |
|------|---------|---------|
| **diagram** | `skill/diagram.md` | 流程图、架构图、原理说明图 |
| **chart** | `skill/chart-types.md` | 柱状图、折线图、饼图、散点图 |
| **mockup** | `skill/mockup.md` | UI 界面、数据卡片、仪表盘 |
| **interactive** | `skill/interactive.md` | 滑块、按钮、实时计算、动画 |
| **art** | `skill/art.md` | 插画、几何图案、装饰性视觉 |

---

## 创意来源

本项目的设计系统和视觉规范提炼自：

**[pi-generative-ui](https://github.com/Michaelliv/pi-generative-ui)** by [@Michaelliv](https://github.com/Michaelliv)

该仓库对 Claude 内置的生成式 UI 系统进行了逆向工程和开源还原，包含完整的 SVG 样式定义（`svg-styles.ts`）、9 色调色板规范、以及 5 个视觉模块的 Claude 官方提示词指南（`diagram.md`、`interactive.md`、`art.md` 等）。

本 Skill 的工作是：将上述规范从 Claude 的专有渲染上下文中抽离，转换为任何 LLM 都能独立遵循的可移植提示词文件，同时扩展了 HTML 交互输出的支持。

---

## License

MIT
