---
name: infographic
description: "Draw a clean, Claude-artifact-style infographic inline in the reply through the infographic fence: flowcharts, bar/line/donut charts, KPI cards, timelines and layered architecture diagrams. Use it when a diagram or chart explains a process, comparison, trend, share, milestone list or system structure faster than prose. Write the user-visible text in the conversation language."
---

# Infographic — 在对话里直接画信息图

在**回答正文**里写一个语言标记为 `infographic` 的围栏，内容是 JSON 规格；界面会把它画成一张 SVG 信息图，并带「复制 PNG / 下载 PNG / 复制 SVG / 下载 SVG / 源码」按钮和一个风格切换器。文字照常穿插在图的前后。

```infographic
{"infographic":"bar","title":"…","categories":["…"],"series":[{"name":"…","data":[1,2]}]}
```

## 写法铁律

- 围栏语言标记只写 `infographic`，收尾是单独一行的三个反引号。
- JSON 的**第一个键必须是** `"infographic"`，值是下面七种之一：`flow` `bar` `line` `donut` `cards` `timeline` `layers`。
- 只写 JSON：不要在里面放 SVG、HTML、Markdown、注释或 `<script>`；颜色不能写色值，只能用调色名。
- 写在回答正文里，不要写进思考过程（思考块里的围栏不会被渲染）。
- 图里所有用户可见文字（标题、标签、说明）跟随用户的语言；JSON 的键和调色名保持英文。
- 图里已经有的内容，正文不要再复述一遍；正文讲图没法表达的结论、依据和限制。
- 数据必须来自对话、用户材料或你核实过的来源。没有来源的数字，用 `note` 标明「示例数据」，或者不画。
- 一次回答里图要少而准；一张图只讲一个问题。

## 公共字段

| 字段 | 说明 |
| --- | --- |
| `title` | 图标题，一行 |
| `subtitle` | 副标题，一行 |
| `note` | 底部注释：数据口径、单位、来源，最多两行 |
| `style` | 视觉风格，见下。不写则跟随界面当前选中的风格（默认 `claude`） |

风格（`style`）：`claude`（默认，Claude artifact 的柔和九色）、`mckinsey`（麦肯锡：亮青蓝 `#2CBDEF` 主色 + 对照灰 `#D4D4D4`）、`bcg`（BCG：标志性绿 `#2CA02C`，只有绿）、`economist`（经济学人：`#E3120B` 红色主系列，并在图顶画出红色横线 + 左上红方块版头，`#006BA2` 编辑蓝为第二系列）。

**什么时候写 `style`：** 图要落进一份有固定视觉规范的材料时，由你在围栏里写死，这样导出的 PNG/SVG 就是那个风格。只在对话里看一眼，就不用写；界面上随时可以手动切。写死之后界面上的切换器以用户的选择为准。

调色名（`color`）：`purple` `teal` `coral` `pink` `gray` `blue` `green` `amber` `red`。颜色表示类别，不表示好坏；不写则按顺序自动配色。**调色名是「槽位」，不是色相承诺**——`blue` 在 `claude` 下是青蓝，在 `bcg` 下是深绿（BCG 的视觉语言里没有蓝色）。三套品牌风格是近单色的：自动配色只在品牌自己的色相家族里走深浅。只有 `red`/`green`/`amber` 在四套风格里语义固定，涨跌色和告警色不会说谎。换风格不用改 JSON。

长度上限：单段文字约 160 字；`flow` 40 个节点、80 条边；`bar`/`line` 24 个类别、6 个系列；`donut` 12 块；`cards` 12 张（每张：标签约 60 字、数值约 24 字、涨跌幅约 30 字、说明约 120 字，长文字会自动换行、卡片自动撑高）；`timeline` 16 项；`layers` 8 层、每层 8 项。超出部分会被丢弃，并在图下方提示「已自动修正」。

## 七种图

### flow — 流程图、决策树、循环

```infographic
{"infographic":"flow","title":"一次 API 请求的处理流程","direction":"down",
 "nodes":[
  {"id":"req","label":"用户提交请求","sub":"API 或网页表单","shape":"pill","color":"purple"},
  {"id":"auth","label":"身份认证","sub":"校验令牌与权限","color":"teal"},
  {"id":"ok","label":"输入合法？","shape":"diamond","color":"amber"},
  {"id":"run","label":"执行业务逻辑","color":"teal"},
  {"id":"err","label":"返回错误","sub":"400 + 原因","color":"red"},
  {"id":"done","label":"返回结果","shape":"pill","color":"green"}],
 "edges":[["req","auth"],["auth","ok"],{"from":"ok","to":"run","label":"是"},{"from":"ok","to":"err","label":"否"},["run","done"],["err","done"]]}
```

- `direction`：`down`（默认）或 `right`；步骤少、线性时用 `right`。
- 节点：`id`（边引用它）、`label`（≤ 12 字为宜）、`sub`（可选一行说明）、`shape`（`box` 默认 / `pill` 起止 / `diamond` 判断）、`color`。
- 边：`["from","to"]` 或 `["from","to","标签"]` 或 `{"from","to","label","dashed":true}`；也可写 `"a->b"`。
- 不写 `edges` 时，节点按顺序依次连线。回到上游节点的边（循环、重试）会自动绕行并建议用 `dashed`。
- 判断节点的分支边都写 `label`（是 / 否）。

### bar — 柱状图、条形图

```infographic
{"infographic":"bar","title":"各产品线季度营收","unit":"M","categories":["Q1","Q2","Q3","Q4"],
 "series":[{"name":"订阅","data":[38,42,47,55]},{"name":"服务","data":[27,31,29,36]}],
 "note":"数据为示例，单位：百万元"}
```

- `categories` 是横轴标签，`series[].data` 与之按位置对应；`null` 表示缺失。
- `horizontal:true` 画横向条形（类别名较长或要排名时用）；`stacked:true` 画堆叠（部分与整体）。
- 单个系列也可简写：`"data":[{"label":"ChatGPT","value":71}, …]`。
- `unit`：数值后缀（`%`、`M`、`万`）；`¥`、`$` 开头的会前置。

### line — 趋势线

```infographic
{"infographic":"line","title":"周活跃用户","categories":["W1","W2","W3","W4"],"area":true,
 "series":[{"name":"新用户","data":[120,150,170,160]},{"name":"回访用户","data":[80,95,120,150]}]}
```

字段与 `bar` 相同；`area:true` 给线下方铺淡色面积。类别应是有序的（时间、阶段）。

### donut — 占比

```infographic
{"infographic":"donut","title":"流量来源占比","center":{"value":"12.8万","label":"总访问"},
 "data":[{"label":"搜索","value":48},{"label":"社交媒体","value":27},{"label":"直接访问","value":15},{"label":"其他","value":10}]}
```

- 只用于"各部分相加是整体"的数据，≤ 6 块最清楚；`center` 可选，放总量。
- `value` 用原始数值，图会自己算百分比。

### cards — 指标卡

```infographic
{"infographic":"cards","title":"本周核心指标",
 "items":[{"label":"活跃用户","value":"12,847","delta":"+12.4%","note":"较上周"},{"label":"转化率","value":"3.8%","delta":"-0.4%","color":"coral"}]}
```

`value` 写成字符串（带单位）；`delta` 以 `+` 开头显示为增长色，以 `-` 开头显示为下降色。每行 3–4 张，自动换行。数值 ≥ 1 万的图表标签会缩写成 k / M / B。

### timeline — 时间线、里程碑

```infographic
{"infographic":"timeline","title":"产品发布节奏",
 "items":[{"time":"9 月","title":"内部灰度","desc":"20 名种子用户"},{"time":"10 月","title":"公开测试"},{"time":"11 月","title":"正式发布"}]}
```

### layers — 分层架构

```infographic
{"infographic":"layers","title":"RAG 应用的分层架构","arrows":true,
 "layers":[
  {"label":"接入层","color":"purple","items":[{"label":"Web 前端","sub":"聊天界面"},{"label":"API 网关"}]},
  {"label":"服务层","color":"teal","items":[{"label":"检索服务"},{"label":"重排序"},{"label":"生成服务"}]},
  {"label":"数据层","color":"coral","items":[{"label":"向量库"},{"label":"文档存储"}]}]}
```

自上而下排列；`arrows:true` 在层之间画向下箭头（表示调用方向）。

## 选哪一种

| 想表达 | 用 |
| --- | --- |
| 步骤、分支、循环、因果链 | `flow` |
| 几个类别之间的数值比较、排名 | `bar` |
| 随时间 / 阶段的变化 | `line` |
| 整体里各部分的占比 | `donut` |
| 3–8 个关键数字一眼看完 | `cards` |
| 先后发生的事、路线图 | `timeline` |
| 系统由哪几层、每层有什么 | `layers` |

先判断这张图是否真的比文字清楚：只有两三个要点、或数据不足以支撑比较时，直接写文字。

## 出错时

围栏内 JSON 不合法，或必填内容缺失（如 `flow` 没有节点），界面会保留原始代码块并提示原因。看到提示后，下一轮重写一个**完整**的围栏，不要只补片段。
