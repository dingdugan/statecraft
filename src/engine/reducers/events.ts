import type { GameState } from '../types';
import type { StepContext } from '../context';
import { Rng } from '../rng';
import { C } from '../constants';
import { EVENTS, getEvent } from '../../data/events';
import { checkFailStates } from '../failStates';

/** Select at most one eligible event per turn and mark it pending for the UI. */
export function maybeFireEvent(s: GameState, ctx: StepContext): GameState {
  if (s.status !== 'playing' || s.pendingEventId) return s;
  // chained follow-ups: tick the queue down; a due one fires unconditionally (it was
  // scheduled by an earlier choice), bypassing condition() + EVENT_CHANCE.
  if (s.chainQueue.length) {
    for (const item of s.chainQueue) item.turnsLeft--;
    const dueIdx = s.chainQueue.findIndex((i) => i.turnsLeft <= 0);
    if (dueIdx >= 0) {
      const [due] = s.chainQueue.splice(dueIdx, 1);
      const ce = getEvent(due.eventId);
      if (ce) {
        s.pendingEventId = ce.id;
        ctx.log.push({ kind: 'event', msg: `⚡ 事件：${ce.titleZh}` });
        return s;
      }
    }
  }
  const eligible = EVENTS.filter(
    (e) => (!e.oncePerGame || !s.usedEventIds.includes(e.id)) && e.condition(s),
  );
  if (eligible.length === 0) return s;
  if (ctx.rng.next() > C.EVENT_CHANCE) return s;
  const picked = ctx.rng.pick(
    eligible,
    eligible.map((e) => e.weight),
  );
  s.pendingEventId = picked.id;
  ctx.log.push({ kind: 'event', msg: `⚡ 事件：${picked.titleZh}` });
  return s;
}

/** Apply the player's choice to a pending event. Pure: returns a new state. */
export function resolveEventChoice(state: GameState, eventId: string, optionIdx: number): GameState {
  if (state.pendingEventId !== eventId) return state;
  const s: GameState = structuredClone(state);
  const ev = getEvent(eventId);
  const ctx: StepContext = { rng: new Rng(s.rng), year: s.year, decisions: {}, log: [] };
  if (ev) {
    const opt = ev.options[optionIdx] ?? ev.options[0];
    opt.apply(s, ctx);
    if (!s.usedEventIds.includes(eventId)) s.usedEventIds.push(eventId);
    ctx.log.push({ kind: 'event', msg: `↳ ${ev.titleZh}：${opt.labelZh}` });
  }
  s.pendingEventId = undefined;
  s.rng = ctx.rng.state;
  s.log = ctx.log;
  return checkFailStates(s, ctx);
}
