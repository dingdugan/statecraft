import type { GameState } from '../types';
import type { StepContext } from '../context';

interface CrisisDef {
  id: string;
  labelZh: string;
  warnZh: string;
  deadline: number; // years to reverse it
  trigger: (s: GameState) => boolean; // enters the danger band
  cleared: (s: GameState) => boolean; // pulled back to safety
  fail: (s: GameState) => void; // consequence if the timer runs out
}

export const CRISES: CrisisDef[] = [
  {
    id: 'debt', labelZh: '债务危机', deadline: 4,
    warnZh: '债务濒临失控、市场信心动摇——若不在期限内压降，将主权违约。',
    trigger: (s) => s.debtPctGdp > 1.3,
    cleared: (s) => s.debtPctGdp < 1.15,
    fail: (s) => { s.status = 'bankrupt'; s.endReason = '债务危机失控，主权违约破产。'; },
  },
  {
    id: 'unrest', labelZh: '动荡危机', deadline: 3,
    warnZh: '社会动荡逼近沸点——若不在期限内平息，将爆发革命。',
    trigger: (s) => s.unrest > 72,
    cleared: (s) => s.unrest < 55,
    fail: (s) => { s.status = 'revolution'; s.endReason = '动荡危机未能平息，政权在革命中倾覆。'; },
  },
  {
    id: 'coup', labelZh: '政变危机', deadline: 3,
    warnZh: '军中异动、政变阴云密布——若不在期限内安抚军方，将兵变夺权。',
    trigger: (s) => s.coupRisk > 55,
    cleared: (s) => s.coupRisk < 40,
    fail: (s) => { s.status = 'coup'; s.endReason = '政变危机失控，军方发动政变夺权。'; },
  },
];

export function getCrisis(id: string): CrisisDef | undefined {
  return CRISES.find((c) => c.id === id);
}

/** Escalating-threat layer (v3.1): when a metric enters a danger band, open a counting-down
 *  crisis; reverse it in time to clear it, or it fires its end-state when the timer hits 0.
 *  Runs before checkFailStates — the hard floors still apply at the extreme (unrest≥90 etc.). */
export function stepCrisis(s: GameState, ctx: StepContext): GameState {
  if (s.status !== 'playing') return s;
  if (s.activeCrisis) {
    const c = getCrisis(s.activeCrisis.id);
    if (!c) { s.activeCrisis = null; return s; }
    if (c.cleared(s)) {
      ctx.log.push({ kind: 'politics', msg: `✅ ${c.labelZh}已化解` });
      s.activeCrisis = null;
    } else {
      s.activeCrisis.turnsLeft -= 1;
      if (s.activeCrisis.turnsLeft <= 0) {
        c.fail(s);
        ctx.log.push({ kind: 'fail', msg: `💥 ${c.labelZh}失控` });
        s.activeCrisis = null;
      } else {
        ctx.log.push({ kind: 'politics', msg: `⏳ ${c.labelZh}：还剩 ${s.activeCrisis.turnsLeft} 年扭转` });
      }
    }
    return s;
  }
  for (const c of CRISES) {
    if (c.trigger(s)) {
      s.activeCrisis = { id: c.id, turnsLeft: c.deadline };
      ctx.log.push({ kind: 'fail', msg: `⚠️ ${c.labelZh}爆发：${c.warnZh}` });
      break;
    }
  }
  return s;
}
