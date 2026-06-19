---
status: active
updated: 2026-06-19
---

# Design: Simulation Engine — the build contract

> This is the **authoritative numeric model**. [spec-nation-sim.md](spec-nation-sim.md)
> is the product vision; *this* is what you implement. Every formula here is **v0 and
> tunable** (balance happens in the loop), but the shapes/contracts are fixed. Goal: an
> engineer (or the overnight loop) can build the MVP with zero clarifying questions.

All money in **USD billions** unless noted. All `0..100` fields are indices. All
`fraction` fields are decimals (`0.021` = 2.1%). The engine is **pure**: no `Date.now()`,
no `Math.random()`, no I/O. The only entropy source is the seeded RNG carried *inside*
`GameState` — this makes save→reload bit-identical by construction.

---

## 1. Types

```ts
export type GovType = 'democracy' | 'authoritarian' | 'monarchy' | 'hybrid';
export type Status  = 'playing' | 'bankrupt' | 'revolution' | 'voted_out' | 'ended';
export type Sector  = 'agriculture' | 'industry' | 'services';
export type SpendCategory =
  | 'military' | 'education' | 'healthcare' | 'infrastructure' | 'welfare' | 'rnd';

export interface RngState { seed: number; cursor: number; } // serialized Mulberry32

export interface Allocation {           // shares of total spend, MUST sum to 1
  military: number; education: number; healthcare: number;
  infrastructure: number; welfare: number; rnd: number;
}

export interface GameState {
  // meta
  countryId: string;
  govType: GovType;
  year: number;                 // starts 2025
  turn: number;                 // 0-based
  rng: RngState;
  status: Status;
  endReason?: string;

  // economy
  gdp: number;                  // nominal, USD bn
  gdpGrowthReal: number;        // last realized real growth (fraction)
  sectors: Record<Sector, number>;   // shares, sum=1
  productivity: number;         // index, 1.00 = baseline
  unemployment: number;         // fraction [0.01, 0.45]
  inflation: number;            // fraction [-0.05, 0.40]

  // population
  population: number;           // millions
  popGrowth: number;            // fraction (may be negative)
  medianAge: number;            // years (aging proxy)
  laborParticipation: number;   // fraction
  educationLevel: number;       // index 0..100 (static-ish in MVP)

  // government / politics
  approval: number;             // 0..100
  stability: number;            // 0..100
  unrest: number;               // 0..100 accumulator
  termYearsLeft: number;        // democracies: years to next election (else unused)

  // fiscal — player levers: taxRate, spendingPctGdp, allocation
  taxRate: number;              // target revenue as fraction of GDP [0.10, 0.60]
  spendingPctGdp: number;       // primary spending envelope, fraction of GDP [0.10, 0.70]
  allocation: Allocation;
  debtPctGdp: number;           // govt debt / GDP (fraction, e.g. 1.20 = 120%)
  creditRating: number;         // 0..20 (20=AAA, 0=D)
  deficitPctGdp: number;        // last realized total deficit / GDP (fraction)
  reserves: number;             // USD bn buffer
  marketAccessLostYears: number;

  // scoring
  prosperity: number;           // 0..100 (derived each turn)
  score: number;                // 0..100 composite

  // event awaiting player resolution (blocks next advance)
  pendingEventId?: string;
}

export interface PendingDecisions {
  taxRate?: number;
  spendingPctGdp?: number;
  allocation?: Allocation;
  enactPolicyIds?: string[];
}

export interface LogEntry { kind: 'econ'|'fiscal'|'politics'|'event'|'fail'|'info'; msg: string; }

export interface StepContext {
  rng: Rng;                     // wraps RngState, advances cursor
  year: number;
  decisions: PendingDecisions;
  log: LogEntry[];
}
```

`CountryStaticInfo` (in `data/countries.ts`) carries `id, name, nameZh, flag, govType,
traits: string[]` plus the **starting values** for every mutable field above. Traits are
flavor/modifier tags consumed by events and a few formulas: `resource_rich`, `oil_exporter`,
`aging`, `tech_hub`, `young_population`, `trade_hub`, `fragile_institutions`,
`sovereign_wealth`, `manufacturing`.

---

## 2. RNG (deterministic, serialized)

Mulberry32 — 32-bit, tiny, good enough for a game, fully reproducible.

```ts
export class Rng {
  constructor(public state: RngState) {}
  next(): number {                       // float in [0,1)
    this.state.cursor = (this.state.cursor + 0x6D2B79F5) | 0;
    let t = this.state.cursor;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min: number, max: number) { return min + (max - min) * this.next(); }
  normal(mean = 0, sd = 1) {             // Box-Muller, one draw
    const u = 1 - this.next(), v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  pick<T>(items: T[], weights: number[]): T { /* weighted sample using next() */ }
}
```

`RngState` lives in `GameState`; `cursor` advances monotonically. One stream, drawn in
fixed reducer order. Save = JSON of `GameState` (rng included) → reload is identical.

---

## 3. `advanceTurn` — resolution order (FIXED)

```ts
export function advanceTurn(state: GameState, decisions: PendingDecisions): GameState {
  // guard: if pendingEventId set, throw — UI must resolveEvent first
  let s = structuredClone(state);
  const ctx: StepContext = { rng: new Rng(s.rng), year: s.year, decisions, log: [] };
  s = applyDecisions(s, ctx);   // 0
  s = stepDemographics(s, ctx); // 1
  s = stepEconomy(s, ctx);      // 2
  s = stepFiscal(s, ctx);       // 3
  s = stepPolitics(s, ctx);     // 4  (approval, unrest, stability, elections)
  s = stepScore(s, ctx);        // 5
  s = maybeFireEvent(s, ctx);   // 6  (sets pendingEventId; effects applied on resolve)
  s = checkFailStates(s, ctx);  // 7
  s.year += 1; s.turn += 1;
  s.rng = ctx.rng.state;        // persist advanced cursor
  s.lastLog = ctx.log;          // (transient, not part of determinism hash)
  return s;
}
```

Each `step*` is pure `(GameState, StepContext) → GameState`. Adding a system later =
add a `stepX` in the right slot + its fields + a UI panel. That's the whole extension model.

---

## 4. v0 formulas (per reducer)

Helper: `clamp(x,lo,hi)`. `trendGrowth(country)` = the country's baseline real growth.
All coefficients in §6 are tunable.

**0. applyDecisions** — set `taxRate`, `spendingPctGdp` (clamped to ranges), `allocation`
(normalized to sum 1). Apply any `enactPolicyIds` (see §7). Log changes.

**1. stepDemographics**
```
population  *= (1 + popGrowth)
medianAge   += AGE_DRIFT * (TREND_POP_REF - popGrowth)   // low/neg growth → ages faster
// laborForce is derived where needed: population*1e6 * laborParticipation
```

**2. stepEconomy** (compute realized real growth, then nominal GDP)
```
infraEff = sens('infrastructure')   // see spendEffect()
rndEff   = sens('rnd')
eduEff   = K_EDU * (educationLevel-50)/50
agingDrag= K_AGE * max(0, medianAge - 42)/10
taxDrag  = K_TAXDRAG * max(0, taxRate - 0.45)        // Laffer-ish high-tax drag
instDrag = K_INST * (100 - stability)/100
potential = trendGrowth + infraEff + rndEff + eduEff - agingDrag - taxDrag - instDrag
realGrowth = clamp(potential + rng.normal(0, GROWTH_SD) + shockDrag, -0.15, 0.15)
gdpGrowthReal = realGrowth
// inflation: overheating + deficit pressure - slack
inflation = clamp(inflation*INFL_PERSIST + K_INFL_GAP*(realGrowth - trendGrowth)
                  + K_INFL_DEF*max(0, deficitPctGdp - 0.03) + rng.normal(0,INFL_SD), -0.05, 0.40)
gdp *= (1 + realGrowth) * (1 + inflation)            // nominal
// unemployment: Okun-ish reaction + mean reversion to natural rate
unemployment = clamp(unemployment + K_OKUN*(trendGrowth - realGrowth)
                     + MEANREV*(NAT_U - unemployment), 0.01, 0.45)
productivity += K_PROD_EDU*(educationLevel-50)/50/100 + sens('rnd')*0.5   // slow
```

**3. stepFiscal** (the debt-dynamics core — standard, correct)
```
laffer      = K_LAFFER * max(0, taxRate-0.45)
compliance  = clamp(0.60 + 0.30*(stability/100) + 0.10*(educationLevel/100) - laffer, 0.40, 1.00)
revenuePct  = taxRate * compliance
i           = interestRate(creditRating)               // §5
interestPct = debtPctGdp * i
primaryDef  = spendingPctGdp - revenuePct              // excludes interest
deficitPctGdp = primaryDef + interestPct
gNom        = (1+realGrowth)*(1+inflation) - 1
// standard debt/GDP recurrence:
debtPctGdp  = (debtPctGdp * (1 + i)) / (1 + gNom) + primaryDef
// reserves: surplus accrues, deficit drains (in $bn), plus events
reserves   += (revenuePct - spendingPctGdp - interestPct) * gdp
// credit rating drifts ≤1 notch/yr toward target:
target      = clamp(20 - debtPctGdp*8 - max(0,deficitPctGdp)*40 + govRatingBonus(govType), 0, 20)
creditRating= moveToward(creditRating, target, RATING_MAX_STEP)
// market access:
if (creditRating <= 3 && deficitPctGdp > 0) marketAccessLostYears++; else marketAccessLostYears = 0
// if locked out, deficit MUST be covered by reserves; if reserves<0 → forced austerity:
if (marketAccessLostYears>0 && reserves < 0) { spendingPctGdp = max(0.10, revenuePct); approval-=10; unrest+=15 }
```

**4. stepPolitics**
```
servicesSat = satisfaction(allocation, spendingPctGdp)   // §6, weighted adequacy 0..1, centered
taxPain     = K_TAXPAIN * max(0, taxRate-0.35)
dApproval   = W_GROWTH*(realGrowth*100) - W_UNEMP*(unemployment*100 - NAT_U*100)
            - W_INFL*max(0, inflation-0.04)*100 + W_SERV*(servicesSat-0.5)*40 - taxPain*40
approval    = clamp(approval + dApproval + MEANREV_A*(50-approval) + rng.normal(0,2), 0, 100)
// unrest accumulator
unrest      = clamp(unrest + max(0,(40-approval)/8) + max(0,(unemployment-0.10))*60
                    + max(0,(inflation-0.06))*40 - UNREST_DECAY*(stability/100), 0, 100)
// stability moves toward target
stabTarget  = clamp(0.6*approval + 0.4*(100-unrest) + govStabBonus(govType), 0, 100)
stability   = moveToward(stability, stabTarget, STAB_MAX_STEP)
// elections (democracy only)
if (govType==='democracy') { termYearsLeft--; if (termYearsLeft<=0) {
   if (approval < ELECTION_LOSE_BELOW) { s.status='voted_out'; s.endReason='Lost re-election' }
   else { termYearsLeft = TERM_LENGTH; approval -= 5 /* campaign cost */ } } }
```

**5. stepScore**
```
gdpPerCap   = gdp*1e9 / (population*1e6)               // USD
prosperity  = clamp( 40*log10(gdpPerCap/REF_PC+1)/log10(11)   // wealth, ~0..40
                    + 25*sigmoid(realGrowth/0.04)             // growth, 0..25
                    + 20*(1 - unemployment/0.25)              // jobs, 0..20
                    + 15*(1 - min(1,abs(inflation-0.02)/0.10)),// price stability 0..15
                    0, 100)
score       = clamp( sqrt(max(0,prosperity) * max(0,stability)), 0, 100)  // geo mean
```

**6. maybeFireEvent** — see §8. **7. checkFailStates** — see §9.

---

## 5. Credit rating → interest rate

Rating is `0..20`. `interestRate(r) = 0.02 + (20 - r)/20 * 0.16` → AAA(20)=2%, mid(10)=10%,
D(0)=18%. **Market access** is cut when `creditRating ≤ 3` and a deficit persists.
`govRatingBonus`: democracy `+1`, monarchy `+1` (if `sovereign_wealth` `+3`), authoritarian
`-1`, hybrid `0`.

---

## 6. Coefficient table (v0 — TUNABLE)

| const | value | const | value | const | value |
|---|---|---|---|---|---|
| `GROWTH_SD` | 0.012 | `K_EDU` | 0.010 | `W_GROWTH` | 0.8 |
| `INFL_PERSIST` | 0.55 | `K_AGE` | 0.006 | `W_UNEMP` | 0.5 |
| `INFL_SD` | 0.008 | `K_INST` | 0.04 | `W_INFL` | 0.6 |
| `K_INFL_GAP` | 0.25 | `K_TAXDRAG` | 0.05 | `W_SERV` | 1.0 |
| `K_INFL_DEF` | 0.10 | `K_LAFFER` | 0.30 | `K_TAXPAIN` | 0.8 |
| `K_OKUN` | 0.40 | `NAT_U` | 0.05 | `MEANREV` | 0.20 |
| `MEANREV_A` | 0.10 | `RATING_MAX_STEP` | 2 | `STAB_MAX_STEP` | 8 |
| `UNREST_DECAY` | 6 | `TERM_LENGTH` | 4 | `ELECTION_LOSE_BELOW` | 35 |
| `REF_PC` | 5000 | `AGE_DRIFT` | 0.5 | `TREND_POP_REF` | 0.01 |

`spendEffect(cat)` / `sens(cat)`: compare category spend-%-GDP `a = spendingPctGdp*allocation[cat]`
to a healthy reference `REF[cat]` with diminishing returns:
`sens(cat) = GAIN[cat] * tanh((a - REF[cat]) / REF[cat])`. v0:
`REF = {infrastructure:0.04, rnd:0.02, education:0.05, healthcare:0.07, welfare:0.06, military:0.02}`,
`GAIN(growth-relevant infra/rnd) ≈ 0.015`. `satisfaction()` = weighted mean of per-category
adequacy `tanh(a/REF[cat])` over healthcare/education/welfare (the approval-relevant ones).

---

## 7. Policies (`data/policies.ts`)

```ts
export interface Policy {
  id: string; name: string; nameZh: string; desc: string;
  oneShot: boolean;                                  // true = fires once; false = toggle/persistent
  available: (s: GameState) => boolean;              // gating
  apply: (s: GameState, ctx: StepContext) => void;   // immediate patch (mutate s)
}
```
Persistent policies are modeled as one-shot patches to the levers/state in MVP (no active-modifier
registry yet — that's a clean later addition). Two worked examples:

```ts
{ id:'austerity', name:'Austerity Package', nameZh:'紧缩方案', oneShot:true,
  desc:'Cut primary spending 3pp to repair the books. Painful now, credible later.',
  available:s=>s.deficitPctGdp>0.03,
  apply:(s)=>{ s.spendingPctGdp=clamp(s.spendingPctGdp-0.03,0.10,0.70); s.approval-=8; s.unrest+=10; s.creditRating=moveToward(s.creditRating,s.creditRating+1,1);} }

{ id:'education_reform', name:'Education Reform', nameZh:'教育改革', oneShot:true,
  desc:'Long-horizon human-capital bet. Raises education level; pays off in productivity years later.',
  available:s=>s.allocation.education>=0.10,
  apply:(s)=>{ s.educationLevel=clamp(s.educationLevel+6,0,100); s.reserves-=0.005*s.gdp; } }
```

---

## 8. Events (`data/events.ts`)

```ts
export interface EventOption { label:string; labelZh:string; requires?:(s:GameState)=>boolean;
  apply:(s:GameState,ctx:StepContext)=>void; }
export interface EventDef { id:string; title:string; titleZh:string; desc:string; descZh:string;
  weight:number; oncePerGame?:boolean; condition:(s:GameState)=>boolean; options:EventOption[]; }
```
**Selection** (`maybeFireEvent`): filter to `condition(s) === true` (and not already used if
`oncePerGame`); if none, no event. Else with probability `EVENT_CHANCE=0.55` weighted-sample
**one** by `weight`; set `s.pendingEventId`. UI presents it; `resolveEventChoice(s, eventId,
optionIdx)` runs the option's `apply`, marks used, clears `pendingEventId`. Default option
(idx 0) auto-applies if the player somehow advances (shouldn't happen — advance is blocked).
Max **1 event/turn** in MVP.

Worked example:
```ts
{ id:'oil_shock', title:'Oil Price Shock', titleZh:'油价冲击', weight:3,
  condition:s=>s.countryId==='SA'||s.countryId==='NG'|| hasTrait(s,'oil_exporter'),
  desc:'Global oil prices swing hard this year.', descZh:'今年国际油价剧烈波动。',
  options:[
   {label:'Ride the windfall (spend)',labelZh:'顺势增支',apply:s=>{s.reserves+=0.04*s.gdp; s.inflation+=0.01; s.approval+=4;}},
   {label:'Bank the surplus',labelZh:'存入主权基金',apply:s=>{s.reserves+=0.06*s.gdp; s.creditRating=moveToward(s.creditRating,s.creditRating+1,1);}},
  ]}
```

---

## 9. Fail / end states (`checkFailStates`)

```
bankrupt:   marketAccessLostYears >= 2 && reserves <= 0        → status='bankrupt'
revolution: unrest >= 90 || (stability <= 5 for 2 consecutive turns) → status='revolution'
voted_out:  set in stepPolitics on election loss
ended:      year > END_YEAR (default 2075) → status='ended' (sandbox conclusion, keep score)
```
Authoritarian/monarchy resist unrest longer (`govStabBonus`) but have no election valve, so
they tend to fail via revolution rather than vote-out. Each end sets `endReason` for the
end screen, which shows final `score` + a one-line epitaph.

---

## 10. Module map & tests

```
src/engine/
  rng.ts            Rng + Mulberry32
  types.ts          all interfaces above
  constants.ts      coefficient table (§6) — the tuning surface
  reducers/         demographics.ts economy.ts fiscal.ts politics.ts score.ts events.ts
  advanceTurn.ts    composition (§3)
  failStates.ts
  index.ts          public API: newGame(countryId, seed), advanceTurn, resolveEventChoice
src/data/           countries.ts policies.ts events.ts
src/ui/             render.ts dashboard.ts decisions.ts eventModal.ts countrySelect.ts yearReport.ts saveLoad.ts
src/main.ts
```

**Vitest coverage (MVP gate):** (a) determinism — same seed+decisions ⇒ identical state hash
over 20 turns; (b) save→reload identity; (c) debt-spiral reaches `bankrupt` from a bad-fiscal
script; (d) unrest path reaches `revolution`; (e) allocation always normalizes to 1;
(f) all clamps hold over a 50-turn fuzz with random decisions; (g) a prosperous script keeps
`status==='playing'` and rising `score` (proves the system isn't degenerate-to-death).

---

## Changelog
- 2026-06-19: Initial engine contract written in the LFG plan phase to resolve the
  adversarial spec review's "missing numeric model" finding.
