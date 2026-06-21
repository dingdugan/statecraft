import type { GameState } from '../types';
import type { StepContext } from '../context';
import { clamp } from '../util';

const TURNCOAT_TITLES = ['财政巨头', '媒体大亨', '地方实力派', '外交元老', '改革派旗手', '工会领袖', '国安首脑'];

/** v4b.4/.5 — political drama. Each turn:
 *  1) figures' loyalty DRIFTS with how the country is going (thriving → onside, failing →
 *     they turn). Deterministic (no rng) so existing balance/determinism are untouched.
 *  2) a figure whose loyalty collapses past a threshold makes a ONE-TIME, named move
 *     (coup / no-confidence / defection): logs it AND records it in the chronicle.
 *  `acted` marks them so it never repeats. Runs after stepCrisis, before events. */
export function stepFigures(s: GameState, ctx: StepContext): GameState {
  if (s.status !== 'playing') return s;
  const mood = (s.approval - 50) / 12 + (s.score - 55) / 18 - Math.max(0, s.unrest - 30) / 15;
  for (const f of s.figures) {
    f.loyalty = clamp(f.loyalty + mood, -100, 100);
    if (f.acted) continue;
    let drama: string | null = null;
    if (f.title === '军方统帅' && f.loyalty < -50) {
      f.acted = true;
      s.coupRisk = clamp(s.coupRisk + 30, 0, 100);
      s.stability = clamp(s.stability - 10, 0, 100);
      s.militaryReadiness = clamp(s.militaryReadiness - 6, 0, 100);
      drama = `⚔️ 军方统帅 ${f.nameZh} 公然逼宫——政变阴云骤起！`;
    } else if (f.title === '反对党领袖' && f.loyalty < -55) {
      f.acted = true;
      s.stability = clamp(s.stability - 12, 0, 100);
      s.approval = clamp(s.approval - 5, 0, 100);
      s.unrest = clamp(s.unrest + 6, 0, 100);
      drama = `🗳️ 反对党领袖 ${f.nameZh} 发起不信任投票，政局剧烈动荡。`;
    } else if (f.loyalty < -25 && TURNCOAT_TITLES.includes(f.title)) {
      f.acted = true;
      s.approval = clamp(s.approval - 6, 0, 100);
      s.unrest = clamp(s.unrest + 8, 0, 100);
      drama = `💔 ${f.title} ${f.nameZh} 与你决裂，公开倒戈。`;
    }
    if (drama) {
      ctx.log.push({ kind: 'politics', msg: drama });
      if (!s.chronicle.some((c) => c.id === `fig:${f.id}`)) {
        s.chronicle.push({ year: s.year, text: drama, id: `fig:${f.id}` });
      }
    }
  }
  return s;
}
