import type { GameState } from '../types';
import type { StepContext } from '../context';
import { C } from '../constants';
import { clamp } from '../util';
import { getCountry } from '../../data/countries';

/** Conflict resolution. A very hostile relation (<= -75) can erupt into war; once at
 *  war the front swings on relative military power, costs GDP/reserves/exhaustion, and
 *  resolves into victory (reparations + prestige) or defeat (losses; a fragile regime
 *  can fall). Runs after military (current strength) and before score. */
export function stepWar(s: GameState, ctx: StepContext): GameState {
  if (!s.warWith) {
    const enemies = Object.entries(s.relations)
      .filter(([, r]) => r <= -75)
      .map(([id]) => id);
    if (enemies.length > 0 && ctx.rng.next() < C.WAR_START_CHANCE) {
      s.warWith = ctx.rng.pick(enemies, enemies.map(() => 1));
      s.warScore = 0;
      ctx.log.push({ kind: 'event', msg: `⚔️ 战争爆发：与 ${getCountry(s.warWith).nameZh} 开战。` });
    } else {
      s.warExhaustion = clamp(s.warExhaustion - C.WAR_RECOVER, 0, 100);
      return s;
    }
  }

  const enemy = getCountry(s.warWith);
  const myPower = s.militaryStrength * (s.militaryReadiness / 100);
  const enemyPower = enemy.start.militaryStrength * (enemy.start.militaryReadiness / 100);
  s.warScore = clamp(
    s.warScore + C.K_WAR * (myPower - enemyPower) + ctx.rng.normal(0, C.WAR_NOISE),
    -100,
    100,
  );

  // wartime costs
  s.gdp *= 1 - C.WAR_GDP_DRAG;
  s.reserves -= C.WAR_RESERVE_DRAG * s.gdp;
  s.warExhaustion = clamp(s.warExhaustion + C.WAR_EXHAUST, 0, 100);
  s.approval = clamp(s.approval - 1 + (s.warScore > 20 ? 2 : 0), 0, 100);
  s.unrest = clamp(s.unrest + s.warExhaustion * 0.03, 0, 100);

  if (s.warScore >= 80) {
    s.reserves += 0.05 * s.gdp;
    s.approval = clamp(s.approval + 10, 0, 100);
    s.relations[s.warWith] = clamp((s.relations[s.warWith] ?? 0) + 40, -100, 100);
    ctx.log.push({ kind: 'event', msg: `🏆 战争胜利：击败 ${enemy.nameZh}，赢得赔款与威望。` });
    s.warWith = null;
    s.warScore = 0;
    s.warExhaustion = clamp(s.warExhaustion - 30, 0, 100);
  } else if (s.warScore <= -80) {
    const wasUnstable = s.stability < 25;
    s.gdp *= 0.92;
    s.reserves -= 0.05 * s.gdp;
    s.approval = clamp(s.approval - 15, 0, 100);
    s.relations[s.warWith] = clamp((s.relations[s.warWith] ?? 0) + 20, -100, 100);
    ctx.log.push({ kind: 'fail', msg: `🏳️ 战败：向 ${enemy.nameZh} 求和，割地赔款。` });
    s.warWith = null;
    s.warScore = 0;
    if (wasUnstable) {
      s.status = 'defeated';
      s.endReason = `一场灾难性的战败击垮了本已脆弱的政权（${ctx.year} 年）。`;
    }
  }
  return s;
}
