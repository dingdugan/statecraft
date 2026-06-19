---
status: active
updated: 2026-06-19
---

# Design: Playability v2 — 完整世界模拟（构建契约）

> 目标：把可玩性提上来。**可玩性 = 可操作 + 随机性 + 反馈**。当前游戏强在「财政数值深度」，
> 弱在「能动性广度 / 世界活性 / 事件与叙事」。本文是 v2 的**权威架构契约**——把单国引擎
> 升级成完整世界模拟，并在其上叠 4 个可玩性系统。loop 按本文分迭代施工，每迭代 build+test
> 全绿才 commit。已定的关键取舍：**完整模拟 16 国**、**手写模板叙事（不接 LLM，保持纯前端·
> 零依赖·离线·存档可复现）**、**全做·深度优先自驱**。

## 一、4 个方向 → 4 个系统（建在世界模拟之上）

1. **世界活性 + 反馈**（用户方向③）：16 国每回合都演化；世界新闻流 + 世界面板（各国
   GDP/政体/对你关系/战争 + 排名 + 关系矩阵）。纯文字数值版「世界地图」。
2. **事件库大扩充**（方向②）：~8 → 几十，分类（国内政治/经济/社会/科技/自然/国际/军事）+
   多回合**事件链**。
3. **主动行动系统**（方向①）：每回合除调滑块，花「政治资本」做跨系统行动——外交（结盟/制裁/
   贸易协定/斡旋他国冲突）、军事（动员/宣战/求和）、国内（更大政策库）。
4. **叙事层**（方向④）：政策/行动/事件/里程碑带**文字后果**；年报升级为「编年史」；重大时刻
   触发「历史卡片」。手写模板 + 状态参数拼装，确定可控。

依赖顺序（也是迭代顺序）：世界活性 → 事件 → 行动 → 叙事（后者建在「活的世界」上才有意义）。

## 二、核心重构：`GameState`（单国） → `WorldState`（世界）

### 字段归属
- **世界级**（提升/共享）：`year, turn, rng, commodityPrice`、国家间 `relations`（对称矩阵）、
  `wars`（世界级战争列表）、`news`、玩家的 `playerId / playerStatus / pendingEventId / usedEventIds`。
- **每国保留**（`CountryState`）：现有 `GameState` 里所有**国内**字段——economy（gdp/growth/
  sectors/productivity/techLevel/unemployment/inflation/priceLevel→改全局/...）、population、social
  （inequality/healthIndex/qualityOfLife/legitimacy）、fiscal（taxRate/spending/allocation/debt/
  rating/reserves/...）、politics（approval/stability/unrest/termYearsLeft/...）、military
  （strength/readiness/coupRisk）、resources（resourceDepletion/resourceIncome/emissions/
  climateStress）、tech（techLevel）、score/prosperity/victoryStreak、govType/traits/trendGrowth、
  usedPolicyIds。**去掉** year/turn/rng/status/relations/warWith/warScore/warExhaustion/commodityPrice
  （这些上提到世界级）。

```ts
interface CountryState { /* 现 GameState 的国内字段子集，外加该国的 score/status-flags */ }

interface War { a: string; b: string; score: number; exhaustion: number; } // score 从 a 视角 -100..100

interface WorldState {
  year: number; turn: number; rng: RngState; commodityPrice: number;
  playerId: string;
  playerStatus: Status; playerEndReason?: string;
  countries: Record<string, CountryState>;     // 全部 16 国
  relations: Record<string, number>;            // key = `${min}|${max}` 排序，对称 -100..100
  wars: War[];
  pendingEventId?: string; usedEventIds: string[];   // 玩家
  news: NewsItem[];                              // 本回合世界新闻
  log: LogEntry[];                               // 玩家本回合纪要
}
interface NewsItem { kind: 'econ'|'war'|'diplo'|'politics'|'disaster'; who: string; msg: string; }
```

### `advanceWorld(world, playerDecisions)` 解算顺序（FIXED）
```
1. 决策：每国一份 PendingDecisions。玩家国 = playerDecisions；他国 = aiDecide(cs, world)。
2. stepWorldDiplomacy：更新 relations 矩阵（向对齐基线漂移 + 行动/事件改动）；为每国从世界
   关系算 globalStanding / tradeBalance / sanctionPressure，写回该国 CountryState。
3. 每国国内 reducers（按 COUNTRY_IDS 固定顺序，复用现有 reducer）：
   demographics → tech → economy → fiscal → social → politics → military。
4. stepWorldWar：推进 wars 的 score（按双方 militaryStrength×readiness）、触发新战争
   （relations ≤ -75 的国家对）、结算胜负（双方 GDP/approval/relations 受影响）。
5. stepResources（每国）+ 全球 commodityPrice 走一步（mean-reverting）。
6. genNews：扫描本回合显著变化（衰退/繁荣/结盟/交恶/开战/政变/革命/危机）→ news[]。
7. 每国 computeScore；玩家国 checkFailVictory（沿用 v1 规则：bankrupt/revolution/coup/
   defeated/voted_out/victory/ended，作用于 world.playerStatus）。
8. maybeFireEvent（玩家）。year++/turn++；持久化 rng。
```
**决定性**：单一世界 RNG，按 `COUNTRY_IDS` 固定顺序消费。`WorldState` 纯 JSON 可序列化 →
存档 round-trip 逐字节一致（沿用 v1 的 save 不变量）。

### AI 决策 `aiDecide(cs, world): PendingDecisions`
轻量理性启发式（确定，无 rng 依赖或仅用世界 rng）：维持财政可持续（spending ≈ revenue±）、
高失业→倾向刺激、高通胀/高赤字→倾向紧缩、按 govType 调军费、关系恶化时不主动挑衅。v2.1 先
给「维持现状」骨架，v2.3 完善为真正理性的他国行为。

## 三、迁移策略（控制风险）
- **复用国内 reducer**：demographics/tech/economy/fiscal/social/politics/military/resources/score
  的逻辑几乎不变，只是操作 `CountryState`，并从 `StepContext` 拿世界级 rng/year + 预先算好的
  standing/trade/sanction。
- **关系/战争上提**：diplomacy 的关系漂移改为世界级对称矩阵；war 改为世界级 `wars[]`，双方对称受影响。
- **入口替换**：`advanceTurn` → `advanceWorld`；`newGame` → `newWorld(playerId, seed, scenarioId)`。
- **存档/UI/测试适配**：save 序列化 `WorldState`；UI 先从 `world.countries[playerId]` 渲染现有仪表盘
  （v2.1 不改观感），世界面板留到 v2.2；测试改写到 `WorldState`（determinism / save round-trip /
  fail & victory 可达 / 50 回合×16 国 fuzz 钳制 / 非退化 全部要绿）。

## 四、迭代 roadmap（深度优先，每迭代 = reducer/逻辑 + UI + 测试 + commit）

- **v2.1 世界重构**：`WorldState`/`CountryState` 类型；`advanceWorld`（复用国内 reducer）；
  relations 对称矩阵 + wars 世界级；`aiDecide` 维持骨架；`newWorld`；存档=WorldState；UI 仍只渲染
  玩家国；测试全部适配并绿。**最大、最高风险——务必保持绿，必要时分多次 commit。**
- **v2.2 世界面板 + 新闻流**：UI「世界」视图——各国摘要（GDP/政体/对你关系/战争）、实力排名、
  关系矩阵、本回合世界新闻流。补「反馈」。
- **v2.3 AI 完善 + 国家间真交互**：他国理性决策；国家彼此（不只对玩家）会结盟/交恶/开战；新闻反映之。
- **v2.4 事件库扩充**：~8 → 几十，分类 + 多回合事件链 + 世界事件（影响多国）。补「随机性」。
- **v2.5 主动行动系统**：`politicalCapital` 资源 + 行动库（外交/军事/国内），UI 行动面板。补「可操作」。
- **v2.6 叙事层**：手写模板文字后果（政策/行动/事件/里程碑）+ 年报→编年史 + 历史卡片。补「史诗感」。

## 五、风险与守则
- 这是 v2 核心重构，触及引擎/存档/UI/测试。守则：**每迭代 build(tsc)+test 全绿才 commit**；
  v2.1 拆小步；测试门槛精神不降（决定性/存档一致/fail&victory 可达/fuzz 钳制/非退化）。
- 性能：16 国 × reducer 链 ≈ 数毫秒/回合，可接受。
- 兼容：旧 v1 单国存档不强制迁移（提示开新局）；deserialize 对非世界存档返回 null（视作无存档）。
- 叙事**不接 LLM**：纯手写模板 + 参数，保住纯前端/离线/确定性/零依赖/可静态部署。

## Changelog
- 2026-06-19: v2 契约初稿（完整世界模拟 + 4 可玩性系统 roadmap），承接用户「可玩性」诊断。
