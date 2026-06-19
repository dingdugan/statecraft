---
status: done
updated: 2026-06-19
---

# Overnight build report — Statecraft / 庙堂

The `/LFG` compound-engineering flow ran end-to-end (brainstorm → plan → build → review →
improve), then a self-paced overnight loop stacked simulation systems depth-first. This
is the morning summary. **The game is playable now** (`npm run dev`, or it was served on
`localhost:5173`).

## What shipped (commit by commit)

| Commit | What |
| --- | --- |
| `0391f9f` | Plan: product spec (`spec-nation-sim.md`) + numeric-model contract (`design-engine.md`) + checklist |
| `0a4fac8` | Engine: pure reducer core, seeded RNG, 6 real countries, Vitest gates |
| `ae72a30` | UI: dark text+numbers dashboard, decisions, events, save/load (MVP playable) |
| `65c083d` | Review fixes: P0 corrupt-save crash, P1 policy-ratchet exploit, slider desync, migration |
| `6b37d0f` | loop[1] Social — health, inequality (Gini), quality of life, legitimacy |
| `5be0b28` | loop[2] Technology — techLevel drives growth + productivity |
| `7a4b077` | loop[3] Military — strength, readiness, coup risk + coup fail-state |
| `4e7349a` | loop[4] Diplomacy & trade — relations, standing, trade, sanctions |
| `193bf89` | loop[5] War — conflict resolution, victory/defeat + defeated fail-state |
| `5c905b4` | loop[6] Resources & environment — commodities, depletion, emissions, climate |
| `62eeeb6` | loop[7] Scenarios & victory — 4 win conditions + 3 start scenarios |

## Systems now simulated

Turn resolution order (`advanceTurn.ts`): decisions → demographics → tech → diplomacy →
resources → economy → fiscal → social → politics → military → war → score → events → end-states.

- **Economy** — GDP, real growth, sectors, unemployment, inflation, productivity; debt
  dynamics with a credit-rating → interest curve.
- **Population** — growth, aging (median age), education, labor.
- **Technology** — R&D + education drive a techLevel stock that feeds growth/productivity.
- **Social** — health, inequality (Gini), quality of life, legitimacy.
- **Fiscal** — tax/spend/6-way allocation, deficit, debt, rating, reserves, market access.
- **Politics** — approval, unrest, stability, elections (democracies).
- **Military** — strength, readiness, coup risk.
- **Diplomacy & trade** — per-country relations, global standing, trade balance, sanctions.
- **War** — relation-triggered conflict resolved on relative power; victory/defeat.
- **Resources & environment** — commodity-price cycle, resource income, depletion,
  emissions → cumulative climate stress.
- **Score & end-states** — composite score (prosperity × stability × legitimacy);
  fail-states bankrupt / revolution / coup / defeated / voted-out; **4 victory conditions**
  (Superpower / Prosperity / Peacemaker / Green); 3 start scenarios.

## Status

- **`npm run build`**: clean (tsc + vite, ~43 KB JS gzip ~17 KB, zero runtime deps).
- **`npm test`**: 8/8 Vitest gates green — determinism, save/reload identity, bankruptcy
  reachable, revolution reachable, allocation normalization, 50-turn × 6-country fuzz
  (every bounded field stays in range, no NaN), prosperity non-degenerate, war resolves,
  victory reachable.
- Each loop iteration added a reducer + state + 6-country data + UI group + briefings +
  deserialize backfill (old saves stay loadable) + tests, committed atomically.

## Known balance caveats (deferred — within the spec's "v0, tunable" license)

- **Score snowball / nominal GDP**: the wealth sub-score uses nominal GDP, which compounds
  with inflation over decades; strong countries (e.g. China, Saudi) trend to a maxed score.
  Real fix = deflate to real GDP. Sub-bands are now clamped so it can't exceed 100.
- **Victory thresholds** (Superpower 85×5y, Prosperity $100k/cap) can trigger mid-game for
  strong states. That is by design (winning is the goal) but the numbers are tunable.
- **Credit-rating notch cap** can be exceeded slightly by event/policy +1 bumps in a single
  year (bounded by the 0..20 clamp). Cosmetic.
- **War is semi-automatic** — triggered by very hostile relations, resolved by relative
  power + the `war_council` event lever. No explicit declare-war / peace-terms UI yet.
- **Diplomacy is closed-world** — relations only vs the 6 playable countries.
- **Event library is small** (~8 events). More authored content would deepen replay.

## Suggested next steps

1. **Expand the country set 6 → ~16** (`data/countries.ts`) — the deferred breadth item
   (depth was prioritized per the chosen overnight focus). Verify figures vs World Bank /
   IMF / SIPRI per the data-grounding note.
2. **Balance pass**: real-GDP scoring, victory-threshold tuning, war frequency, a play-test
   sweep (the engine is deterministic + seeded, so balance runs are reproducible).
3. **Deeper player agency**: explicit declare-war / sue-for-peace, alliances & treaties as
   actions, persistent policy modifiers (an active-effects registry vs today's one-shot patches).
4. **Content**: a larger authored event/crisis library; multi-year event chains.
5. **History view**: track key stats across turns (a text sparkline keeps it on-theme).
6. **Ship it**: run `/qa` + `/code-review` over the full game, then deploy the static bundle.

## How to run / play

```bash
cd /Users/bytedance/Codes/culture.sandbox
npm install   # if needed
npm run dev   # play at the printed localhost URL
npm test      # 8 engine gates
npm run build # static bundle in dist/
```

Pick a country (and a start scenario), set tax / spending / budget allocation / policies,
advance year by year, and steer toward a victory while avoiding bankruptcy, revolution,
a coup, military defeat, or (in democracies) the ballot box.
