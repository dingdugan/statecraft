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

### MVP（本轮 overnight session 目标 —— 见 docs/design-engine.md 为构建契约）

- [ ] 脚手架 Vite + TS 项目（package.json / vite.config / tsconfig / vitest.config / index.html / src 目录结构）
      验收: `npm run dev` 起本地服务器、`npm run build` 出静态 bundle、`npm test` 能跑
      证据: <file:line / 终端输出>
- [ ] 实现 src/engine/rng.ts —— Mulberry32 `Rng` + `RngState`（next/range/normal/pick）
      验收: 同 seed 同序列；cursor 单调推进；可序列化
      证据: <测试名 rng.test.ts>
- [ ] 实现 src/engine/types.ts + constants.ts —— 全部接口 + v0 系数表
      验收: 类型编译通过；constants 覆盖 design-engine §6 全部常量
      证据: <file:line>
- [ ] 写 src/data/countries.ts —— 6 个真实国家（DE/JP/NG/SG/SA/CN），每字段标注 approximate + baseline 2024
      验收: 6 国起始数值量级合理；含 govType/traits；allocation 和=1；文件头有数据来源/口径声明
      证据: <file:line>
- [ ] 实现引擎 reducers（demographics/economy/fiscal/politics/score）按 design-engine §4 公式
      验收: 各 reducer 纯函数；数值钳制生效；debt 用标准 debt/GDP 递推
      证据: <file:line + 测试名>
- [ ] 实现事件系统：src/data/events.ts（≥4 事件）+ engine 事件 reducer + `resolveEventChoice`
      验收: 事件按 condition 过滤、weight 抽样、每回合最多 1 个、阻塞推进直到解决
      证据: <file:line + 测试名 events.test.ts>
- [ ] 实现 src/data/policies.ts（≥3 政策含 austerity / education_reform）+ apply 接入 applyDecisions
      验收: 政策 available 门控生效；enact 后状态按 apply 改变
      证据: <file:line>
- [ ] 实现 src/engine/advanceTurn.ts + failStates.ts + index.ts（newGame/advanceTurn/resolveEventChoice 公共 API）
      验收: 解算顺序符合 design-engine §3；破产/革命/voted_out/ended 判定按 §9
      证据: <file:line>
- [ ] 写 Vitest 测试套件（design-engine §10 的 7 个门槛 a–g）
      验收: 决定性、存档往返一致、破产可达、革命可达、归一化、50 回合 fuzz 钳制、繁荣不退化
      证据: <`npm test` 全绿输出 + 测试名>
- [ ] 实现选国屏 src/ui/countrySelect.ts —— 列出 6 国 + 一句话困境 + 起始核心数值
      验收: 点选某国 → newGame(seed) → 进入仪表盘
      证据: <截图路径>
- [ ] 实现仪表盘 src/ui/dashboard.ts —— 按系统分组的国家体征 + 内阁简报（ministerial briefings）文案层
      验收: 显示经济/人口/政治/财政各组数值；简报点出需注意项
      证据: <截图路径>
- [ ] 实现决策面板 src/ui/decisions.ts —— 税率 / 支出占比 / 6 类预算分配 / 可选政策
      验收: 调整后归一化 100%；显示对下一年的预期；点「推进一年」生效
      证据: <截图路径>
- [ ] 实现事件弹窗 src/ui/eventModal.ts + 年度报告 src/ui/yearReport.ts + 结束屏
      验收: 事件触发弹窗、选项改变轨迹；年报解释主要变化与原因；fail/end 显示终局分数+墓志铭
      证据: <截图路径>
- [ ] 实现存档 src/ui/saveLoad.ts —— localStorage 多槽位存/读/删 + 接入 main.ts
      验收: 存档后刷新页面可读回；读回的局面与存前逐字节一致（决定性）
      证据: <截图路径 + 测试名>
- [ ] 冷启动 walkthrough：dev 起服 → 选国 → 做决策 → 推进数年 → 触发事件 → 达成一个 fail/end
      验收: 全链路无断点、可玩；spec 验收标准全部可勾
      证据: <截图路径序列>

## Done

<!-- 把已勾选的条目挪到这里归档，保持 Active 段简洁 -->
