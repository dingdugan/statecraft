---
status: done
updated: 2026-06-19
---

# v2「完整世界模拟」改造报告

Statecraft / 庙堂 的 v2 迭代：从「单国引擎」升级为「16 国并行世界模拟 + 可玩性四件套」。
通过 /LFG 风格的自驱 loop，逐迭代端到端落地（引擎 reducer + 数据 + UI + Vitest + 提交）。

## 线上

- **https://culturesandbox.vercel.app** （Vercel 生产别名，已验证跑 v2.6：线上 bundle `index-CnLi4Wju.js` == 本地 v2.6 build）
- GitHub: `dingdugan/culture.sandbox`（main，公开）

## 各迭代（逐 commit）

| 迭代 | 内容 | commit |
| --- | --- | --- |
| v2.1 | 世界重构：`GameState` → `WorldState`，`advanceWorld` 每回合跑全 16 国 + `worldSync` 调和关系/战争；`aiDecide`；世界存档 | `1235155` |
| v2.2 | 世界面板 + 新闻流 UI：「本国/世界」切换、列国按 GDP 排名(政体/GDP/对你关系/态势/评分)、`world.news` | `cbc4561` |
| v2.3 | AI 理性化 + 国家间真交互：`aiDecide` 财政启发式；世界级 RNG + `stepWorldRelations`(外交漂移 + 爆发点危机) → NPC 彼此开战；`genNews` 结盟/交恶 | `4b87ed6` |
| v2.4 | 事件库扩充：8 → 34 事件(7 类) + 多回合事件链(`chainQueue`) + 世界事件(`WORLD_EVENTS` 波及全国) | `e151225` |
| v2.5 | 主动行动系统：`politicalCapital` + 9 行动(外交/军事/国内) + UI 行动面板 | `30aa723` |
| v2.6 | 叙事层：年度叙事句(📜) + 一次性里程碑编年史(8 种) + UI 编年史面板 | `63d7f8b` |

（v2 规划 commit：`dd1d9f8`。契约文档 `docs/design-world-v2.md`。）

## 测试 / 构建状态

- `npm run build`（tsc）：**干净**
- `npm test`（Vitest）：**28/28 绿**
  - `engine.test.ts` 9（单国：决定性/存档/破产/革命/fuzz/胜利/存档迁移）
  - `world.test.ts` 9（世界：决定性/存档/全16国推进/玩家fail·victory可达/fuzz/动态不退化/NPC战争/世界事件）
  - `events.test.ts` 3（库完整性/每选项无NaN/事件链触发）
  - `actions.test.ts` 4（库完整性/政治资本产出/求和结束战争/宣战门槛）
  - `narrative.test.ts` 3（年度叙事句/里程碑去重/战争里程碑）

## 可玩性四件套（对应用户诉求）

1. **每回合能 tweak 的更多** → v2.5 主动行动系统（预算 + 政策 + 9 主动行动，政治资本驱动）。
2. **随机性 / 事件更丰富** → v2.4 事件 8→34 + 事件链 + 世界事件。
3. **看到世界在发生什么** → v2.2 世界面板（列国排名/关系/态势）+ v2.3 真实的 NPC 间外交与战争 + 新闻流。
4. **文字后果 / 叙事** → v2.6 年度叙事句 + 里程碑编年史。

## 平衡数据（构建期 sim）

- v2.3 sim（12 世界 × 16 国 × 40 年）：真崩溃 = 0，宣战 = 28（avg 2.3/世界）—— 世界有战争动态但不大面积瞬崩。
- v2.4 sim：真崩溃 = 0，世界事件 avg 3/世界，玩家每局遇 ~11 事件。
- 玩家 fail（voted_out 等）与 victory 均可达；默认推进非退化。

## 遗留项 / 后续建议（诚实记录）

- **NPC 不使用主动行动库**：`aiDecide` 只调财政；NPC 间的结盟/交恶/开战由世界层 `stepWorldRelations` 模拟，未走 `actions.ts`。后续可让 NPC 也会主动出牌。
- **强国仍可较被动夺胜**：评分不随时间衰减，世界压力 + 行动成本提升了维持难度但未根治（见 checklist 平衡项）。建议加评分时间衰减 / 难度曲线。
- **关系 UI 只玩家视角**：世界面板显示「各国对你」，未呈现完整 16×16 关系矩阵 / NPC 间联盟图。
- **叙事为手写模板**（按既定设计，非 LLM）：里程碑/叙事句可继续扩充变体。
- 事件库、世界事件、国家集仍可继续堆深度。
