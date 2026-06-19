# Implementation Checklist

> 规则：每条「动词 + 屏幕/文件 + 行为」+ 验收 + 证据三件套。
> 没填证据不准打 `[x]` —— Stop hook 会自动审计、拦截。

## 模板（复制下面一段开始一条新条目）

```markdown
- [ ] <动词 + 屏幕/文件 + 行为>
      验收: <可观察的标准>
      证据: <填截图路径 / file:line / 测试名>
```

---

## Active

### 后续（overnight loop，深度优先 —— 见 docs/spec-nation-sim.md roadmap）

- [ ] 扩展国家集 6 → ~16（src/data/countries.ts），并核实/精修数值对照公开来源
      验收: 新增国家起始数值量级合理、govType/traits 完整、allocation 和=1
      证据: <file:line + 来源标注>
- [ ] 加 Military / Diplomacy / War / Resources / Scenarios（按 roadmap 逐个）
      验收: 每个系统 reducer+data+UI+测试+commit
      证据: <逐条补>

## Done

### Loop 迭代（overnight，深度优先）

- [x] Social 系统：健康指数 / 不平等(Gini) / 生活质量 / 合法性；接入 unrest 与 score
      验收: 新 reducer 纯函数、UI「社会」组、score 升级为 3 因子 cbrt(繁荣×稳定×合法性)、fuzz 钳制新字段
      证据: src/engine/reducers/social.ts；reducers/score.ts(legitimacy)；advanceTurn.ts(stepSocial 插入 fiscal→politics 之间)；engine.test.ts NUMERIC_FIELDS+bounds → 6/6 绿；浏览器尼日利亚「社会」组截图(生活质量43/健康45/基尼0.42/合法性45)

- [x] Technology/R&D 系统：techLevel 由 R&D 支出+教育驱动，喂入增长(techBonus)与生产率
      验收: R&D 的增长效应改经 techLevel(存量)而非直接 flow；生产率跟随 techLevel；新字段进 fuzz 钳制
      证据: src/engine/reducers/tech.ts(stepTech 插入 demographics→economy 之间)；economy.ts(techBonus 取代 rndEff)；constants.ts(TECH_*)；6 国 techLevel 起始数据；UI 经济组「科技水平」；engine.test.ts techLevel bounds → 6/6 绿；build 干净

### MVP — 全部完成并经浏览器冷启动 walkthrough 验证（2026-06-19）

- [x] 脚手架 Vite + TS 项目（package.json / vite.config / tsconfig / index.html / src 结构）
      验收: dev/build/test 三命令可用
      证据: `npm run build` 成功（26 modules，dist 29KB）；vite.config.ts:1；package.json:8-14
- [x] src/engine/rng.ts —— Mulberry32 `Rng` + `RngState`
      验收: 同 seed 同序列、可序列化
      证据: src/engine/rng.ts:6；测试 gate (a) determinism 绿
- [x] src/engine/types.ts + constants.ts —— 全部接口 + v0 系数表
      验收: 类型编译通过；constants 覆盖 design-engine §6
      证据: src/engine/types.ts；constants.ts:6；`tsc --noEmit` exit 0
- [x] src/data/countries.ts —— 6 真实国家，每字段标注 approximate + baseline 2024
      验收: 量级合理、govType/traits、allocation 和=1、头部数据口径声明
      证据: src/data/countries.ts:1-21（口径声明）；菜单截图 6 国数据正确
- [x] 引擎 reducers（demographics/economy/fiscal/politics/score）按 design-engine §4
      验收: 纯函数、钳制生效、标准 debt/GDP 递推
      证据: src/engine/reducers/*.ts；测试 gate (e)(f) 50 回合 fuzz 钳制绿
- [x] 事件系统：src/data/events.ts（6 事件）+ engine 事件 reducer + resolveEventChoice
      验收: condition 过滤、weight 抽样、每回合≤1、阻塞推进直到解决
      证据: src/data/events.ts；reducers/events.ts:9；浏览器实测 科技繁荣 事件触发+解决
- [x] src/data/policies.ts（4 政策）+ apply 接入 applyDecisions
      验收: available 门控生效；enact 后状态按 apply 改变
      证据: policies.ts；浏览器实测 紧缩/财政刺激 正确置灰、教育改革/反腐 可选
- [x] advanceTurn.ts + failStates.ts + index.ts（newGame/advanceTurn/resolveEventChoice）
      验收: 解算顺序符合 §3；破产/革命/voted_out/ended 判定符合 §9
      证据: advanceTurn.ts:14；failStates.ts；测试 gate (c) 破产 (d) 革命 绿
- [x] Vitest 测试套件（§10 的 7 个门槛 a–g）
      验收: 决定性/存档往返/破产可达/革命可达/归一化/fuzz钳制/繁荣不退化
      证据: src/engine/engine.test.ts；`npm test` → 6 passed
- [x] 选国屏 src/ui/view.ts:menuHTML —— 6 国 + 困境 + 起始数值
      验收: 点选 → newGame → 进仪表盘
      证据: view.ts:18；菜单截图；实测点 德国 进入
- [x] 仪表盘 dashboardHTML —— 按系统分组体征 + 内阁简报
      验收: 经济/人口/财政/政治分组 + 简报点出注意项 + 语义配色
      证据: view.ts:60；format.ts:briefings;仪表盘截图（评分83/AAA/各组数值）
- [x] 决策面板 decisionsHTML —— 税率/支出/6类分配/政策
      验收: 归一化100%、显示说明、点推进生效
      证据: view.ts:130；main.ts:attachPlayListeners；截图（分配和=100%）
- [x] 事件弹窗 eventModalHTML + 年度报告 reportHTML + 结束屏 endHTML
      验收: 事件弹窗+选项改轨迹；年报解释变化；终局显示分数+墓志铭
      证据: view.ts:eventModalHTML/reportHTML/endHTML；实测弹窗+「2026纪要」日志
- [x] 存档 src/ui/saveLoad.ts —— localStorage 多槽位存/读/删 + 接入 main.ts
      验收: 存档后可读回；读回局面与存前逐字节一致（决定性）
      证据: saveLoad.ts；engine/save.ts；测试 gate (b) save/reload identity 绿；实测槽1存档显示「德国·2026年·评分79」
- [x] 冷启动 walkthrough：dev起服→选国→决策→推进→触发事件→存档
      验收: 全链路无断点、可玩、无 console 报错
      证据: 浏览器 walkthrough 全程截图；preview_logs 无 server error
