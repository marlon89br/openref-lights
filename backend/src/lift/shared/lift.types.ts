import { EVENT_TYPES, RefereePosition, Decision } from './lift.constants';

/** Possible states in the lift lifecycle. */
export enum LiftState {
  AWAITING_DECISIONS = 'awaitingDecisions',
  COLLECTING_DECISIONS = 'collectingDecisions',
  READY_TO_REVEAL = 'readyToReveal',
  REVEALING_DECISIONS = 'revealingDecisions',
  JURY_OVERRULE = 'juryOverrule',
}

/** Possible states of the lift timer. */
export enum TimerStatus {
  STOPPED = 'stopped',
  RUNNING = 'running',
}

/** Timer that tracks the 1-minute window a lifter has to start their lift. */
export interface TimerState {
  status: TimerStatus;
  durationMs: number;
  /** Epoch ms when the timer will expire. Only set while running. */
  endsAt?: number;
}

/** Context data maintained throughout the lift lifecycle. */
export interface LiftContext {
  decisions: Map<RefereePosition, Decision>;
  connectedReferees: Set<RefereePosition>;
  juryOverrule?: { decision: Decision; timestamp: number };
  timer: TimerState;
}

/** Immutable snapshot of state machine state and context. */
export interface LiftSnapshot {
  state: LiftState;
  context: LiftContext;
}

/**
 * Discriminated union of all possible events that can be sent to the state machine.
 *
 * This pattern provides type safety - TypeScript can narrow the type based on
 * the `type` discriminator, ensuring only valid properties are accessed for each event.
 *
 * @example
 * ```ts
 * const event: LiftEvent = { type: EVENT_TYPES.DECISION, position: RefereePosition.LEFT, decision: Decision.WHITE };
 * // TypeScript knows position and decision exist
 * ```
 */
export type LiftEvent =
  | { type: typeof EVENT_TYPES.REFEREE_CONNECTED; position: RefereePosition }
  | { type: typeof EVENT_TYPES.REFEREE_DISCONNECTED; position: RefereePosition }
  | { type: typeof EVENT_TYPES.DECISION; position: RefereePosition; decision: Decision }
  | { type: typeof EVENT_TYPES.RESET_REFEREE_DECISION; position: RefereePosition }
  | { type: typeof EVENT_TYPES.REVEAL_DECISIONS }
  | { type: typeof EVENT_TYPES.RESET_ALL }
  | { type: typeof EVENT_TYPES.JURY_OVERRULE; decision: Decision }
  | { type: typeof EVENT_TYPES.CLEAR_JURY_OVERRULE }
  | { type: typeof EVENT_TYPES.START_TIMER }
  | { type: typeof EVENT_TYPES.STOP_TIMER };
