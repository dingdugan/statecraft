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

### v2 可玩性大迭代（完整世界模拟 —— 见 docs/design-world-v2.md，深度优先自驱）

- [x] v2.1 世界重构（包装复用策略）：WorldState + advanceWorld 对16国各跑现有 advanceTurn + worldSync(关系对称化/战争双向卷入) + aiDecide 骨架 + newWorld + 世界存档；UI 接 world(玩家=countries[playerId])
      验收: tsc 干净；15/15 测试绿(9单国+6世界: determinism/存档往返/16国齐步推进/玩家 fail&victory 可达/16国×30回合 fuzz)；浏览器 选DE→推进 无报错
      证据: src/engine/world.ts(advanceWorld/worldSync/genNews)；ai.ts(aiDecide)；index.ts(newWorld)；save.ts(serializeWorld/deserializeWorld/worldFingerprint)；main.ts+saveLoad.ts 接 WorldState；world.test.ts 6 门槛
- [x] v2.2 世界面板 + 新闻流 UI：「本国/世界」切换；列国表(按GDP排名: 国家/政体/GDP/对你关系/态势/评分, 玩家行高亮) + 世界新闻流(world.news)
      验收: 浏览器验证——德国局切「世界」显示全 16 国排名(美国#1)、对你关系、态势；tsc 干净、15/15 测试绿
      证据: src/ui/view.ts(worldViewHTML/REL_TIER/STATUS_ZH)；main.ts(app.view+viewtabs)；style.css(viewtabs/news/nations)；eval 验证 nationRows=16 + 截图列国表
- [x] v2.3 AI 完善 + 国家间真交互：aiDecide 理性财政启发式(衰退刺激/通胀赤字紧缩/可持续收敛)；WorldState.rng + stepWorldRelations(每年外交漂移 + 偶发爆发点危机压破 −75 战争线) → NPC 彼此开战(worldSync 双向卷入)；genNews 结盟/交恶
      验收: 平衡 sim(12世界×16国×40年) 真崩溃=0、宣战=28(avg 2.3/世界)；浏览器跑16年→2041 世界面板显示 🇰🇷⚔️🇧🇷、关系游走；tsc 干净 17/17 测试绿
      证据: src/engine/ai.ts(aiDecide)；world.ts(stepWorldRelations/genNews)；index.ts(newWorld rng)；save.ts(deserializeWorld/worldFingerprint rng)；world.test.ts 测试 (g) dynamic-but-not-degenerate + (h) wars ignite
- [x] v2.4 事件库扩充：8 → 34 事件(经济/政治/外交/灾害/社会/科技/军事)；多回合事件链(chainQueue: banking_crisis→bailout_aftermath、corruption_scandal→investigation_result)；世界事件(WORLD_EVENTS 6 个，advanceWorld ~14%/年波及全 16 国 + world.news 头条)
      验收: 平衡 sim(12世界×40年) 真崩溃=0、世界事件 avg 3/世界、玩家 ~11 事件/局；浏览器 modal 渲染新事件「外资涌入」+2选项；tsc 干净 21/21 测试绿
      证据: src/data/events.ts(EVENTS 34 + WORLD_EVENTS + chain/randomRel)；types.ts+index.ts(chainQueue)；reducers/events.ts(maybeFireEvent 链触发)；world.ts(stepWorldEvent)；save.ts(chainQueue backfill)；events.test.ts (a)(b)(c) + world.test.ts (i)
- [x] v2.5 主动行动系统：politicalCapital(每回合按 approval+stability 产出，上限30) + 9 行动库(外交:示好/制裁/调解；军事:动员/宣战/求和；国内:宣传/整肃/改革) + UI 行动面板(成本徽章/分类色/前置置灰)
      验收: 浏览器跑到 2029，面板渲染 9 行动、政治资本 5→21、选「舆论宣传」(成本3)、推进后 21→24(花费+产出)；tsc 干净 25/25 测试绿
      证据: src/data/actions.ts(ACTIONS 9 + getAction)；types.ts(politicalCapital/actions)；reducers/decisions.ts(花资本+产出)；save.ts(backfill)；view.ts+main.ts+style.css(行动面板)；actions.test.ts (a)(b)(c)(d)
- [x] v2.6 叙事层：年度叙事句(📜 按增长/通胀/支持/动荡/战争/债务生成) 入年报；一次性里程碑(首战/评分70·85/债务破百/动荡临界/科技前沿/繁荣顶尖/政变阴云) 入编年史(带年份) + UI 编年史面板
      验收: 浏览器跑到 2029，年报显示「📜 政府广受拥戴」、编年史显示「2025 ⭐ 治国评分首次站上 70」「🌟 繁荣顶尖」；tsc 干净 28/28 测试绿
      证据: src/engine/reducers/narrative.ts(stepNarrative/yearNarrative/MILESTONES)；types.ts(ChronicleEntry/chronicle)；advanceTurn.ts(接入)；save.ts(backfill)；view.ts+main.ts(chronicleHTML)；narrative.test.ts (a)(b)(c)
- [ ] （并入 v2.5/平衡）让强国也需主动经营：当前强国可较被动夺胜，靠世界压力+行动成本提升维持难度

## v3 可玩性重构（用户反馈：可玩性差 = 缺「问题→抉择→反馈」循环；症状=不知道该干嘛/调了没张力/看不懂数字为啥动）

- [x] v3.0 第一刀 · 决策预览 + 任期目标 + 回合归因（A目标+C反馈，翻译已有系统、不堆新模拟）
      验收: 浏览器(德国)使命「缔造盛世 86% · 评分73/85」、拖税率滑块到58%预览实时变(previewChanged=true)、推进后归因「评分▼4·支持率−2」；tsc 干净 32/32 测试绿
      证据: index.ts(previewTurn 纯干运行)；mandates.ts(MANDATES 5+pickMandate)；types.ts+save.ts(mandateId+backfill)；view.ts(mandateHTML/previewHTML/decisionsHTML预览块)；main.ts(updatePreview实时/currentDecisions/attribution)；style.css；preview.test.ts (a)纯(b)==真实advance(c)null-when-blocked + mandate(a)bounded
- [x] v3.1 第二刀 · 决策张力（B）：① 年度国策(六选一互斥:拼经济/稳政治/强军备/修财政/惠民生/攻科技，每个一维猛涨一维疼的真取舍) ② 动态危机(债务/动荡/政变逼近临界→顶部红横幅+倒计时，超时直接破产/革命/政变)
      验收: 浏览器(NG)国策6单选+选拼经济预览当场变(previewChanged)；(JP)开局即触发「⚠️债务危机·还剩3年扭转」红横幅+警告；tsc 干净 36/36 测试绿
      证据: focuses.ts(FOCUSES 6+getFocus)；reducers/crisis.ts(CRISES+stepCrisis 开/化解/超时)；types.ts(PendingDecisions.focus+activeCrisis)；advanceTurn.ts(接入)；index.ts+save.ts(init+backfill)；view.ts(focus面板+crisisHTML+预览含focus)；main.ts(toggleFocus单选+crisis渲染)；style.css；tension.test.ts focus(a)(b)+crisis(a)(b)

- [x] v3.2 可操作性修复（试玩反馈：找不到怎么降排放）：使命分配债务优先(日本债务242%→「休养生息·降债」而非死局「绿色转型」)；每个使命加「怎么推进」hint；green 去掉债务死局惩罚
      验收: 浏览器 JP→「休养生息」+ hint「把支出压到税收以下…」；37/37 测试绿
      证据: mandates.ts(pickMandate债务优先+hintZh+green progress)；view.ts/style.css(m-hint)；preview.test.ts mandate(b) JP→deleverage+每使命有hint

## v4 架空世界 + 政治人物（用户拍板：去真实国家避敏感 + 给游戏「人和故事」破闷）

- [x] v4a 架空换皮：16 真实国→虚构国（保留内部 id + 全部数值，只换 name/nameZh/flag/blurb；真实国旗→象征 emoji）
      验收: 浏览器菜单全虚构名(北河联邦/东屿共和国…)、anyRealFlag=false；tsc 干净 37/37 测试绿、存档兼容(id 未变)
      证据: countries.ts(16国显示字段虚构化+架空声明注释)；UK/MX blurb 去脱欧/美国指代
- [ ] v4a-docs 文档措辞扫尾：CLAUDE.md/spec/README 里「真实国家」→「架空世界」（与 v4b 一起）
- [x] v4b.1 人物模型+生成：GameState.figures(虚构政客 id/nameZh/title/stance/personality/loyalty −100..100) + characters.ts 确定性程序生成(每国 4-6 人，独立派生 rng 不碰主 rng，恒含反对党领袖+军方统帅，名字音节拼接)；newGame 生成 + deserialize backfill
      验收: tsc 干净 39/39 测试绿(characters a 确定性+字段合法+有反对党&军方, b newGame 填充+各国 cast 不同)
      证据: types.ts(PoliticalFigure+figures)；data/characters.ts(generateFigures)；index.ts(newGame 调用)；save.ts(backfill)；characters.test.ts (a)(b)
- [x] v4b.2 政坛面板 UI：figuresHTML(人物列表:名+头衔+立场+性格+对你忠诚标签 盟友/支持/中立/不满/敌对) 接入本国视图
      验收: 浏览器北河联邦显示 5 政客(穆文澜·反对党领袖·不满−38 / 沈谌·军方统帅·支持13 / 林安伦·媒体大亨·盟友42…)；tsc 干净 39/39 绿
      证据: view.ts(figuresHTML+LOYALTY_TIER)；main.ts(接入 leftMain)；style.css(.figures/.fig)
- [ ] v4b.3 事件/危机绑人物（"财长X警告…""将军Y异动"，选择影响 loyalty）
- [ ] v4b.4 戏剧行动（stepFigures：loyalty 跌破临界→倒戈/不信任投票/逼宫政变）
- [ ] v4b.5 人物贯穿叙事 + 结局命运 + 编年史

## Done

### 复盘 + 后续改进（review/QA 之后）

- [x] Review/QA pass：对抗式代码评审 + 平衡 sim + 浏览器 QA；修 P0 存档迁移崩溃、P1 胜利过易、P1 K_RESOURCE 量纲、P2 年份差一
      证据: commit 26ccb83；engine.test.ts (j) 存档迁移回归测试；9/9 绿；浏览器结束屏已验证
- [x] 实际-GDP 再平衡：priceLevel 通缩因子；score 财富项与 PROSPERITY 胜利改用实际人均GDP
      证据: economy.ts(priceLevel)/score.ts/failStates.ts/save.ts；平衡 sim 显示被动 play 结局多样化
- [x] 扩展国家集 6 → 16：加 US/IN/UK/FR/BR/RU/KR/ZA/ID/MX，全字段真实量级 + 标注；校准默认支出近平衡
      证据: src/data/countries.ts；fuzz 50回合×16国 0 异常；sim 结局 11胜/3下台/1到期/1破产

### Loop 迭代（overnight，深度优先）

- [x] Social 系统：健康指数 / 不平等(Gini) / 生活质量 / 合法性；接入 unrest 与 score
      验收: 新 reducer 纯函数、UI「社会」组、score 升级为 3 因子 cbrt(繁荣×稳定×合法性)、fuzz 钳制新字段
      证据: src/engine/reducers/social.ts；reducers/score.ts(legitimacy)；advanceTurn.ts(stepSocial 插入 fiscal→politics 之间)；engine.test.ts NUMERIC_FIELDS+bounds → 6/6 绿；浏览器尼日利亚「社会」组截图(生活质量43/健康45/基尼0.42/合法性45)

- [x] Technology/R&D 系统：techLevel 由 R&D 支出+教育驱动，喂入增长(techBonus)与生产率
      验收: R&D 的增长效应改经 techLevel(存量)而非直接 flow；生产率跟随 techLevel；新字段进 fuzz 钳制
      证据: src/engine/reducers/tech.ts(stepTech 插入 demographics→economy 之间)；economy.ts(techBonus 取代 rndEff)；constants.ts(TECH_*)；6 国 techLevel 起始数据；UI 经济组「科技水平」；engine.test.ts techLevel bounds → 6/6 绿；build 干净

- [x] Military 系统：军力指数 / 战备 / 政变风险 + 新增 'coup' fail-state
      验收: stepMilitary 在 politics 后(政变风险读当年稳定度)；战备随军费、军力随战备+科技+人口；coupRisk≥90→政变；政体调节(民主几乎不政变)；新字段进 fuzz
      证据: src/engine/reducers/military.ts；advanceTurn.ts(stepMilitary 在 politics→score 间)；failStates.ts(coup)；6 国军事起始数据；UI「军事」组(军力/战备/政变风险)+国防大臣简报+coup 结束屏；engine.test.ts 军事字段 bounds → 6/6 绿；浏览器中国仪表盘已验证

- [x] Diplomacy & trade 系统：与各国关系(-100..100) / 国际声望 / 贸易差额 / 制裁压力
      验收: stepDiplomacy 在 tech→economy 间；关系按政体对齐基线漂移；贸易喂入增长、制裁拖累；newGame 按对齐播种关系；determinism 往返 relations map
      证据: src/engine/reducers/diplomacy.ts(stepDiplomacy/initRelations/computeDiplomacy)；economy.ts(K_TRADE/K_SANCTION 接入 potential)；data/events.ts(trade_dispute)；UI「外交」组+外交大臣简报；engine.test.ts relations bounds → 6/6 绿；浏览器德国加载无报错

- [x] War 系统：militaryStrength+relations 触发战争，按实力对比推进，胜/败结算 + 'defeated' fail-state
      验收: stepWar 在 military→score 间；关系≤-75 概率开战；战局按 (军力×战备) 对比+噪声推进；战时拖累 GDP/储备/疲劳→动荡；warScore≥80 胜(赔款+威望)/≤-80 败(损失，稳定<25 则亡国)；war_council 事件给玩家战时杠杆
      证据: src/engine/reducers/war.ts；advanceTurn.ts(stepWar)；data/events.ts(war_council)；UI「战争」组+总参谋部简报+defeated 结束屏；engine.test.ts gate (h) 强制战争收敛 → 7/7 绿；浏览器沙特加载无报错

- [x] Resources & environment 系统：大宗价格周期 / 资源收入 / 枯竭 / 碳排放 / 气候压力
      验收: stepResources 在 diplomacy→economy 间；oil/resource 国按大宗价格得资源收入(喂储备+增长)并随开采枯竭；高工业+低绿色投入→高排放，排放累积成气候压力，拖累增长(economy)与生活质量(social)
      证据: src/engine/reducers/resources.ts(stepResources/computeResources)；economy.ts(K_RESOURCE/K_CLIMATE)；social.ts(qol 气候扣减)；6 国 resourceDepletion/climateStress 起始；UI「资源环境」组+资源环境部简报；engine.test.ts 5 字段 bounds → 7/7 绿

- [x] Scenarios & victory：4 个胜利条件 + 'victory' 状态 + 3 个开局剧本
      验收: checkFailStates 内每回合检查胜利(超级强国/富庶之邦/世界调停者/绿色文明)，败局优先于胜利；victoryStreak 连击计；菜单可选剧本(现代/债务危机/冷战)扰动起始数值
      证据: failStates.ts(victory 块+victoryStreak)；data/scenarios.ts；index.ts(newGame scenarioId 参数+apply 重算)；UI 菜单「开局剧本」选择器+victory 结束屏+国务院简报；engine.test.ts gate (i) DE 40 回合夺胜、(g) 容忍 victory → 8/8 绿；浏览器剧本选择器已验证

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
