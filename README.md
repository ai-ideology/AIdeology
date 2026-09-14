# AIdeology — AI 意识形态测试

一个让用户探索「自己希望 AI 世界变成什么样」的互动思想产品。回答 48 道核心
情景题、6–10 道动态判别题（必要时再加 0–4 道专题题），得到 26 种 AI
意识形态中最接近你的一种，并可生成分享页。

视觉系统：**Ideological Neo-Brutalism / 意识形态新野兽派**
（见 `docs-reference/AIdeology_Ideological_Neo_Brutalism_Design_System_v1.0.md`）。

## 技术栈

- **bun** + **TypeScript**（严格模式）
- **Vite** 构建静态站点（相对 base，可直接部署到 GitHub Pages）
- 零运行时依赖；所有题目、文案、理论参数均为 JSON 配置
- 测试用 `bun test`；`scripts/shoot.ts` 是仅开发用的 Playwright 截图/溢出检查工具

## 快速开始

```bash
bun install
bun run dev         # http://127.0.0.1:5173
bun test            # 评分引擎与内容完整性测试
bun run build       # 输出 dist/
bun run preview     # 预览构建产物
```

## 目录结构

```
index.html                 入口（挂载点 + 导航/页脚）
src/
  main.ts                  路由器 + 交互控制器（测试流程、分享、toast、键盘操作）
  content/
    frozen/                v1 冻结包（题库、原型规则、隐藏规则、维度、评分规范）
    index.ts               内容加载层：校验 + 派生出 Ideology 视图模型
    types.ts               冻结数据的 TypeScript 形状
    ideologies.json        26 + 8 个主义的展示文案（Hero 文案，可编辑）
    detail-copy.json       详情页核心信念与思想来源（可编辑）
    wiki.json              维基页：每条轴背后的开放问题、分歧地图（可编辑）
    families.json          五个谱系分组
    derived-colors.json    从美术图提取的参考色（辅色选取参考）
  scoring/engine.ts        v1 评分与判别引擎
  app/
    store.ts               会话状态（localStorage）
    share.ts               分享结果编解码（URL-safe base64）
  ui/                      组件与 DOM 工具
  views/                   landing / test / result / detail / library / atlas / wiki / share
  styles/                  primitives（od-layout 层）+ app（设计系统令牌与组件）
scripts/
  assets.ts                从 26 张主视觉生成 WebP 资产并提取主题色
  shoot.ts                 开发用：多视口截图 + 横向溢出/控制台错误检查
tests/scoring.test.ts      评分引擎测试
docs/DECISIONS.md          规范未定义处的实现选择
docs-reference/            设计文档与冻结包原文（参考，不参与构建）
```

## 结果类型

`single_primary`（主意识形态）· `primary_plus_resonance`（主意识形态 + 共鸣）·
`dual_core`（双核心）· `mixed`（混合型）· `low_information`（未定型）。

## 页面

- **首页** — 品牌与立场冲突场
- **测试** — 答题前提示 → 48 核心题 → 6–10 判别题 → 必要时专题题
- **我的结果** — 主意识形态海报、价值轴、可信度、相近/冲突、完整贴合度；触发隐藏徽章时才显示徽章区
- **图鉴** — 26 张海报墙，可按谱系筛选与搜索
- **谱系** — 可交互的主义节点图
- **维基** — 讲述这套测试的设计：信念 vs 立场、四层模型、16 条轴、分歧地图、谱系、隐藏立场、判别流程与命名体系
- **主义详情 ×26** — 每种立场的人物化介绍页
- **分享页** — 从 URL 快照复现的结果页

## 分享

报告可从 URL 中的紧凑 base64 快照复现（`#/share?d=…`），因此访客无需自己的
localStorage 即可看到分享结果；也可以把结果渲染为 PNG 分享图下载。

## 内容与理论的可配置性

题目、原型规则、阈值都在 `src/content/frozen/*.json`；文案在
`ideologies.json` / `detail-copy.json`。修改 JSON 即可调整文案与题库。
理论数值（轴、原型贴合、Hallmark、隐藏规则）来自 v1 冻结包，属于正式产品
配置，不建议改动理论含义。

## 部署

`bun run build` 后把 `dist/` 发布为静态站点。已配置相对 `base`，可直接用于
GitHub Pages 子路径。
