# Statecraft / 庙堂 — 国家模拟游戏

一个纯文字 + 数值的「文明系列」式国家模拟器：扮演真实国家的政府首脑，做真实的国家级别决策（预算 / 税收 / 政策 / 危机），逐年推进，看经济·人口·政治等互锁系统的连锁反应。无地图、无图形。Web 单页应用（TypeScript + Vite，无后端，localStorage 存档）。

> 本项目继承 `~/.claude/CLAUDE.md`（Execution Discipline + Plan→Code→Ship 工作流）。下面只补充本项目特有的规则。

## 文档约定（活文档）

所有项目文档放 `docs/`，**扁平 + 前缀**，不开子目录：

| 前缀 | 用途 | 例 |
| --- | --- | --- |
| `spec-<feature>.md` | 功能规格 / PRD | `spec-plant-capture.md` |
| `decision-<topic>.md` | 决策快照（选 X 不选 Y 的 why） | `decision-image-storage.md` |
| `research-<topic>.md` | 调研、外部参考 | `research-cv-models.md` |
| `design-<feature>.md` | UI/交互稿、视觉规范 | `design-onboarding.md` |
| `_archive/` | 过期/被取代的文档（不删，仍可回查） | |

每份文档**头部必须有 frontmatter**：
```yaml
---
status: active | draft | superseded | done
updated: YYYY-MM-DD
---
```

`status` 含义：
- `active` —— 当前权威源，写代码必须信它
- `draft` —— 还在草稿，**不构成承诺**，AI 看到 draft 不要当作 spec 执行
- `superseded` —— 已被 `<指向新文档>` 取代，挪去 `_archive/`
- `done` —— 描述的功能已落地（用作历史记录而非待办）

## 强制规则（防止"聊半天没实现"）

### ① Checklist 条目自带验收证据

`IMPLEMENTATION_CHECKLIST.md` 每条按下面格式写，**没"证据"行不准打 `[x]`**：

```markdown
- [ ] <动词 + 屏幕/文件 + 行为>
      验收: <可观察的标准，如截图/跳转/数值>
      证据: <填截图路径 / file:line / 测试名>
```

打 `[x]` 时必须把"证据"行的占位符替换为可核对的内容。**Stop hook 会自动审计**：缺证据或证据是占位符（`<...>`），harness 拦下来不让本轮结束。

### ② Plan→Code 切换点必须"封板"

用户说「开工 / 写吧 / 干」等切换信号 → AI 在调 Edit/Write 之前必须：
1. 把本次共识落成 checklist 的具体条目
2. **逐字引用**本次要做的 N 条（quote，不总结），并显式说"不做 M, K，原因 X"
3. 等用户回 OK 才动手

### ③ Code 结束输出对齐表

报告完成时**禁止**只用"已实现 / 搞定 / done"。必须输出：

| checklist 条目 | 改了什么 (file:line) | 证据 |
| --- | --- | --- |

任何条目缺"改了什么"或"证据"列 = 未完成，明说"未做"或"做不了，原因 X"。

## docs index（每次新增文档同步更新）

<!-- AI 进项目时第一站读这个 index 而不是 ls docs/ —— 列出每篇活文档 + 一句话用途 -->

- [spec-nation-sim.md](docs/spec-nation-sim.md) — **产品愿景源**。游戏概念、范围（MVP vs 后续）、核心循环、系统清单、国家集、深度优先 roadmap。
- [design-engine.md](docs/design-engine.md) — **构建契约（权威数值模型）**。`GameState` schema、各 reducer 的 v0 公式、`advanceTurn` 解算顺序、种子 RNG、信用评级/利率、破产/革命判定、计分、Policy/Event 类型与样例、模块图与测试门槛。写引擎代码信它。
- [research-overnight-report.md](docs/research-overnight-report.md) — overnight LFG 构建报告：逐 commit 清单、系统全貌（11 系统）、测试/构建状态、遗留平衡项、后续建议。
- [design-world-v2.md](docs/design-world-v2.md) — **v2 构建契约**。完整世界模拟（GameState 单国 → WorldState 重构）+ 世界反馈/事件扩充/主动行动/叙事层 4 系统 roadmap。可玩性大迭代信它。
- [research-v2-report.md](docs/research-v2-report.md) — **v2 收官报告**。v2.1–v2.6 逐 commit、线上 URL、28/28 测试、平衡数据、遗留项。v2 全部落地后的总览。

## 项目特定上下文

**Stack:** TypeScript + Vite，纯前端单页应用，无后端。存档走 `localStorage`。测试用 Vitest。

**架构（权威）:** 纯函数引擎 + 薄 UI。
- `src/engine/` —— 无 DOM 的模拟引擎。单一 `GameState`；每个系统是 `step(state, ctx) → state` reducer；`advanceTurn` 按固定依赖顺序组合它们。种子化 RNG。100% 可单测。
- `src/data/` —— `countries.ts`（带「approximate + baseline year」标注的真实国家数据）、`events.ts`、`policies.ts`。
- `src/ui/` —— DOM 渲染，每回合整体重渲染（回合离散、用户触发，无需响应式框架）。
- `src/main.ts` —— 装配、存档/读档、选国。

**关键命令:**
- `npm run dev` —— 本地开发服务器
- `npm run build` —— 产出静态 bundle
- `npm test` —— Vitest 单测

**数值现实性原则:** 国家起始数值是「真实量级的近似值」，baseline ≈ 2024，数据文件里每个数都标注 approximate + baseline year。不编造伪精确数字；具体数值的核实/精修在 overnight loop 里对照公开来源（World Bank / IMF WEO / SIPRI）逐步做。

**深度优先 roadmap:** 见 spec 末尾。每轮迭代加一个系统（engine reducer + data + UI panel + tests + commit）。
