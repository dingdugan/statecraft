import { Rng } from './rng';
import type { LogEntry, LogKind, PendingDecisions } from './types';

export interface StepContext {
  rng: Rng;
  year: number;
  decisions: PendingDecisions;
  log: LogEntry[];
}

export function logMsg(ctx: StepContext, kind: LogKind, msg: string): void {
  ctx.log.push({ kind, msg });
}
