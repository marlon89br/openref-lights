import { RefereePosition, Decision } from '../lift/shared/lift.constants';

/** Kinds of decision events worth keeping a permanent, timestamped record of. */
export type DecisionLogEventType =
  | 'decision'
  | 'decision_reset'
  | 'reveal'
  | 'reset_all'
  | 'jury_overrule'
  | 'clear_jury_overrule';

export interface DecisionLogEntry {
  sessionId: string;
  eventType: DecisionLogEventType;
  position?: RefereePosition;
  decision?: Decision;
}
