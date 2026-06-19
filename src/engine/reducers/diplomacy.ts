import type { GameState } from '../types';
import type { StepContext } from '../context';
import { C } from '../constants';
import { clamp, moveToward } from '../util';
import { COUNTRY_IDS, getCountry } from '../../data/countries';

/** Ideological-alignment baseline relation toward another country. */
function alignmentBaseline(s: GameState, otherId: string): number {
  const o = getCountry(otherId);
  let b = 0;
  if (o.govType === s.govType) b += 20;
  if ((s.govType === 'democracy') !== (o.govType === 'democracy')) b -= 12;
  return clamp(b, -40, 40);
}

/** Pure: derive standing, trade balance, sanction pressure from relations + economy. */
export function computeDiplomacy(s: GameState): void {
  const rels = Object.values(s.relations);
  const avgRel = rels.length ? rels.reduce((a, b) => a + b, 0) / rels.length : 0;
  const softPower = 10 * Math.tanh(s.gdp / 8000) + 0.1 * s.militaryStrength;
  s.globalStanding = clamp(50 + avgRel / 3 + softPower, 0, 100);
  const hostile = rels.filter((r) => r < -40);
  s.sanctionPressure = clamp(hostile.reduce((a, r) => a + (-r - 40), 0) * 0.8, 0, 100);
  s.tradeBalance = clamp(
    (s.sectors.industry * 0.1 + s.sectors.services * 0.03 - 0.04) * (s.globalStanding / 60) -
      (s.sanctionPressure / 100) * 0.06,
    -0.1,
    0.12,
  );
}

/** Relations drift toward alignment baselines; then derive standing/trade/sanctions.
 *  Runs after tech, before economy (trade + sanctions feed this year's growth). */
export function stepDiplomacy(s: GameState, ctx: StepContext): GameState {
  for (const id of COUNTRY_IDS) {
    if (id === s.countryId) continue;
    const base = alignmentBaseline(s, id);
    const cur = s.relations[id] ?? base;
    s.relations[id] = clamp(
      moveToward(cur, base, C.REL_STEP) + ctx.rng.normal(0, C.REL_NOISE),
      -100,
      100,
    );
  }
  computeDiplomacy(s);
  return s;
}

/** Seed relations from alignment baselines at game start. */
export function initRelations(s: GameState): void {
  s.relations = {};
  for (const id of COUNTRY_IDS) {
    if (id === s.countryId) continue;
    s.relations[id] = alignmentBaseline(s, id);
  }
  computeDiplomacy(s);
}
