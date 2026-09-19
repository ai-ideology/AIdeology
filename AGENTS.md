# AGENTS.md — AIdeology 工程导览

> 给 AI 读的项目地图。读完这一份，你应该能定位任何代码、知道哪些能改哪些不能改、以及如何验证改动。
> 人类向的产品说明在 `README.md`；实现取舍的原委在 `docs/DECISIONS.md`。

## 1. 这是什么

**AIdeology** — 一个「AI 意识形态测试」静态单页应用（SPA）。用户答 48 道核心情景题（+ 6–10 道判别题，必要时最多 4 道专题题），得到：

- 一个**主意识形态**（26 种之一）或 双核心 / 混合型 / 未定型；
- 15 条价值轴 + 1 条元轴（M1）的读数；
- 一句通俗的「你的 AI 世界观」解释；
- 最多 2 个**隐藏徽章**（8 种稀有边界立场之一）；
- 可分享的 URL 快照与 PNG 分享图。

技术栈：**Bun + TypeScript（strict）+ Vite 5**，无前端框架（模板字符串 + 事件委托），Canvas 画分享图，sharp 生成图片资产，Playwright 仅供开发期视觉验证。部署到 GitHub Pages。

## 2. 三条最重要的不变量（改代码前必读）

1. **`src/content/frozen/` 是权威数据，不是普通配置。** 它来自产品方冻结的 v1 包，定义题库、轴、原型规则、阈值。**不要手改其中的数值**——引擎的测试会因此失败。要改行为，改 `src/scoring/engine.ts` 或 `docs/DECISIONS.md` 里记录的「spec 未定义处的选择」。注意：v1.1 题库（`*_v1.1.json`）替换了旧 v1 题库，且 `prototype_rules_v1.json` 里的 `adaptive_items` 列表已过时——原型↔判别题的对应关系改由题库自身的 `target_a`/`target_b` 推导（`adaptiveItemsByPrototype`）。
2. **`axis_score` 全中间作答必须让所有原型的 AxisFit = 50。** 这是冻结保证，`tests/scoring.test.ts` 有专项测试。任何触碰 `axisFit` 的改动都要跑测试。
3. **题库的选项分数是方向已编码的**（score 直接进入所属轴，无需运行时翻转符号）。`scenario` 字段是展示用，不参与计分。

## 3. 目录地图

```
index.html                 外壳：顶栏 / 主区 #app / 页脚 / toast / sr-only 播报器
src/main.ts                路由 + 所有事件处理（单一入口，558 行）
src/scoring/engine.ts      计分与判别引擎（纯函数，694 行，无 DOM 依赖）
src/content/               内容层：所有文案/题库的加载与派生
  index.ts                 统一加载 + join（rule + copy），并导出查询辅助函数
  types.ts                 全部数据类型的唯一来源
  frozen/                  ★ 冻结数据（权威，勿改数值）
    core_items_v1.1.json       48 核心题（25 L5 立场题 + 23 S5 单变量程度题）
    adaptive_items_v1.1.json   24 判别题（A11R/A12R/A21R/A23R/A24R 为 v1.1 替换对）
    hidden_items_v1.json       16 专题题
    prototype_rules_v1.json    26 原型：轴目标 / 信条 / 反证 / 近邻
    hidden_rules_v1.json       8 隐藏立场的触发规则
    dimensions_v1.json / scoring_spec_v1.json
  ideologies.json          26 个呈现文案 + 8 个隐藏立场呈现文案
  axis-copy.json           15 轴：通俗名 / 用户问题 / 两极定义 / 5 档文案
  ideology-profiles.json   26 主义：一句话核心 / 最在意 / 最大担忧 / 理想未来
  relations.json           18 组关系：relationType + keyAxis + 程度句 + 一句话对照
  detail-copy.json         每主义 3 条核心信念 + 思想来源
  wiki.json                维基页文案
  families.json            5 个谱系分组
  derived-colors.json      由 scripts/assets.ts 从插画提取的主色（生成物）
src/views/                 每个页面一个渲染函数（返回 HTML 字符串）
src/ui/                    共享组件（components.ts）与 DOM 小工具（dom.ts）
src/styles/app.css         全部样式（2564 行，含设计令牌）
src/styles/primitives.css  od-* 布局原语（od-row / od-fill / od-cluster…）
src/app/store.ts           会话状态（localStorage 键 aideology.v2）+ 结果
src/app/share.ts           分享 payload 的 base64 编解码
scripts/assets.ts          图片管线：sharp 生成 hero/char/thumb WebP
scripts/shoot.ts           开发期视觉切片（Playwright，多视口截图）
tests/scoring.test.ts      16 个引擎测试，全部纯逻辑
.github/workflows/deploy.yml  push main → test → build → 部署 dist 到 Pages
设计方案/                  ★ 原始素材，已 gitignore，不进仓库（本地保留）
docs-reference/           设计系统与冻结规范的可读版（已提交，供参考）
```

## 4. 数据流（一次测试的完整链路）

```
用户作答
  └─ main.ts selectAnswer() 写进 store.answers
     └─ 核心题答完 → planAdaptive(axes) 选 6–10 道判别题
        └─ 判别题答完 → decideHidden(s) 预筛「前置接近满足」的隐藏规则（最多问 4 道）
           └─ 专题题答完（或无需） → finishTest()
              └─ computeResult(answers)  ← 唯一的结果入口，纯函数
                 └─ 写进 store.result，跳 #/computing → #/result
```

`computeResult(answers)` 的内部顺序（与 `engine.ts` 的编号注释一一对应）：

1. `scoreItems` → 每题得分表
2. `axisScores` → 15 轴 + M1，`[-1,1]`（未作答轴取中性 0）
3. `consistency` → 轴内一致性
4. 对 26 个原型各算：`axisFit`（中性基线校正）→ `discEvidence`（判别题证据）→ `evaluateHallmark` → `contradictions` 罚分
5. `RawFit = .50·AxisFit + .30·DiscEvidence + .15·Hallmark + .05·Consistency`；`FinalFit = clamp(RawFit − penalty)`
6. 按 `scoring_spec_v1.json` 的 `selection` / `low_information` 阈值选出结果类型
7. `evaluateNormalism`（元原型回退）、`evaluateHidden`（徽章，最多 2）、三重可信度、`beliefTags`

渲染侧的派生（不在 engine 里）：

- **「你的 AI 世界观」** = `src/views/worldview.ts`：按文档规则选 5–6 条轴，用 `axis-copy.json` 的 5 档文案翻译成人话。档位阈值 `[-0.65,-0.25,0.25,0.65]`，见 `src/content/index.ts` 的 `axisBand`。
- **「主义关系比较器」** = `src/views/compare.ts`：卡片是 selector（不是链接），点击只重绘面板。选轴用**用户自己的答案**（`userResonanceAxes` / `userContrastAxes`），不是主意识形态的冻结向量——否则会落到用户没表态的轴上，退化出「判断最接近／差异明显」的空话。文案优先用 `relations.json` 手写版，缺失时由 `sharedStance` / `boundaryStance` 生成，**必须点名两边各自站的那一端**；同向分歧直接说「谁的立场更强」，不再画位置长条。

## 5. 关键约定与陷阱

- **无框架：改渲染 = 改模板字符串。** `views/*.ts` 每个导出 `renderX(...)` 返回 HTML 字符串。`main.ts` 用 `paintApp()` 整体替换 `#app.innerHTML`。
- **事件全部走委托。** 交互靠 `data-act="xxx"` 属性 + `src/main.ts` 里唯一的 click 处理器分发。加交互 = 加一个 `data-act` 分支，不要绑 addEventListener 到元素。
- **两类「重绘」不要混淆：**
  - 整页重绘 → `render()`（会重建 `#app`，滚动归零）；
  - 局部重绘 → 如 `pickCompare()` 只替换 `#compare-root` 的 innerHTML，避免整页刷新。
- **`--pad-x` 对齐架构：** 内容左右内边距由 `max(16px, calc((100vw - var(--maxw)) / 2 + 16px))` 统一计算，基于 `100vw` 而非 `100%`（百分比会在半宽面板里二次缩进，曾导致文字被挤成一列）。新增全宽区块直接用 `var(--pad-x)`。
- **图片路径是相对的**（`./assets/...`），`vite.config.ts` 里 `base: './'`，以支持 Pages 子路径。不要改成绝对路径。
- **隐藏立场没有插画。** 图片包只覆盖 26 个常规主义。隐藏立场在结果/分享/维基页用 `hiddenBadgesHtml()` 渲染成「黑色卡 + 彩色徽章块」（颜色/符号来自 `ideologies.json` 的 `hidden` 块）。若将来补图，放 `public/assets/char/<id>.webp` 即可切换。
- **`设计方案/` 不进 git。** 原始素材（含生图 prompt、原型）已 gitignore，只在本地。仓库里可引用的是 `docs-reference/`。`scripts/assets.ts` 会读 `设计方案/AI意识形态26个图/`，所以重新生成图片只在本地可行。
- **`derived-colors.json` 是生成物**，由 `bun run assets` 写出；它不参与计分，只是配色来源之一。
- **不要在界面上印内部编号。** `C-V1-01`、`IDEOLOGY_07`、`V10`、`M1`、`HIDDEN · <slug>`、`v1 · 48 CORE` 这类串只用来标识数据行，用户既看不懂也用不上，**一律不渲染**（设计系统 §9 里 `IDEOLOGY_17` 那种 mono 示例是视觉语言参考，不是让你把主键印出来）。要显示身份就显示用户能用的东西：主义名、谱系、通俗轴名、`核心题 3 / 48` 这样的步骤计数。编号仍保留在 `frozen/` 数据与 `ProtoScore` 里，只是不上屏。
- **移动端样式集中在文件末尾的条件块里**，不要为此改基础规则：
  - `@media (max-width: 640px)`（`/* ---------- compact phone layout for the test ---------- */`）压缩做题页，`@media (max-width: 640px) and (max-height: 700px)` 为矮屏（iPhone SE 类）再紧一档。**88 道题（48 核心 + 24 判别 + 16 专题）在 360×640 下都能让「上一题/下一题」留在首屏**——改做题页间距/字号后请重新扫一遍。
  - `body[data-view='test']` 在手机上去掉页脚；`.test__hint`（键盘快捷键）在 `(max-width: 640px), (hover: none)` 下隐藏。
  - `@media (max-width: 639px)` 把图鉴压成单列 ~150px 紧凑卡（否则手机上一页 6000+px 高）。
  - `@media (max-width: 640px)` 里还有一档 `:root` 阴影降级（`--sh-*` 3–4px），对应设计系统 §21「Mobile Shadow 3–4px」。
- **图鉴海报一律等大。** 设计系统 §19 推荐的是 Asymmetric Masonry（Tall/Wide/Square/Small/Feature 五种形状），但 26 个主义是**平级**的，用大小区分会暗示一个不存在的层级；而且旧的 `posterSize()` 是按 `id % 8` 取模分配的，还额外给 4 个主义多渲染一行英文宣言——等于随机挑 4 个白得信息。现在所有海报同尺寸、同字段，`posterHtml()` 不带形状参数，列数随断点 1/2/3/4 变化。

## 6. 命令

```bash
bun install
bun run dev          # Vite 开发服务器，127.0.0.1:5173
bun run build        # tsc --noEmit && vite build → dist/
bun test             # 16 个引擎测试
bun run typecheck    # 仅类型检查
bun run assets       # 重新生成 WebP 资产（需要本地 设计方案/ 目录）
bun run preview      # 预览 dist
```

视觉验证（改 UI 后建议做）：

```bash
bun run dev &                              # 先起服务
bun run scripts/shoot.ts --base=http://127.0.0.1:5173          # 多视口截图
bun run scripts/shoot.ts --base=http://127.0.0.1:5173 --seed   # 先走完测试再截图
# 输出在 _scratch/shots/，并报告 console 错误与横向溢出
```

**要渲染「真实结果」的页面时**，可在浏览器里 `import('/src/scoring/engine.ts')` 等模块、构造 answers、`computeResult` 后 `setState({result})`，再用 Playwright 截图（见 `scripts/shoot.ts` 的 seed 思路）。

## 7. 测试覆盖了什么（改引擎时的护栏）

`tests/scoring.test.ts` 分四组：

- **内容完整性**：48/24/16 题数、每轴 3 题、判别题目标都是真实原型。
- **AxisFit 冻结保证**：全中间 → 所有原型 50；轴分 0 被计为「已作答」而非缺失。
- **判别力**：加速主义形/暂停主义形的画像各自排第一；形成画像不会选到矛盾原型；全中间不算高置信单主；隐藏徽章只在「前置 + 专题支持」齐备时触发。
- **全 26 原型扫描**：每个原型形画像都进 top 3，≥24/26 排第一，5 种结果类型都可达。
- **判别题规划**：始终规划 6–10 道不重复的题。

## 8. 部署

- 仓库：`git@github.com:ai-ideology/AIdeology.git`（public），分支 `main`。
- 推送 `main` 触发 `.github/workflows/deploy.yml`（bun 安装 → `bun test` → `bun run build` → 部署 `dist`）。
- 需在仓库 Settings → Pages 把 Source 设为 **GitHub Actions**。
- 线上地址：`https://ai-ideology.github.io/AIdeology/`
- 提交身份在本仓库内固定为 `ZCode <zcode@local>`（`git config --local`），不暴露个人信息。

## 9. 改动的推荐路径

| 想做的事 | 改哪里 |
|---|---|
| 改文案 / 加题 | `src/content/*.json`（题库改 `frozen/` 需产品方确认） |
| 改计分或阈值 | `src/scoring/engine.ts` + 同步 `docs/DECISIONS.md`；跑 `bun test` |
| 加页面 | `src/views/` 新增 `renderX` + `src/main.ts` 的 `Route` 联合类型与 `render()` 分支 |
| 加交互 | 模板里加 `data-act`，`main.ts` 的 click 委托里加分支 |
| 改样式 | `src/styles/app.css`（令牌在文件顶部 `:root`） |
| 加轴解释 / 关系文案 | `axis-copy.json` / `relations.json` |

**提交前自检：** `bun run typecheck && bun test && bun run build` 全绿；改了 UI 就再跑一次 `scripts/shoot.ts` 看截图与控制台。
