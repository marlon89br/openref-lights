import { LiftStateMachine } from '../core/lift.machine';
import { LiftSnapshot } from '../shared/lift.types';
import { EVENT_TYPES, RefereePosition, Decision } from '../shared/lift.constants';
import { DecisionLogService } from '../../decision-log/decision-log.service';

/**
 * Service layer that encapsulates one platform/meet's lift state machine.
 *
 * One instance exists per session ID (see SessionManager) so multiple
 * platforms can run concurrently without interfering with each other.
 * Provides a clean API for interacting with the state machine without
 * exposing its internal implementation, and records a permanent,
 * timestamped log entry for every decision-affecting event.
 */
export class LiftService {
  private machine = new LiftStateMachine();

  constructor(
    private readonly sessionId: string,
    private readonly decisionLog: DecisionLogService,
  ) {}

  /**
   * Subscribe to state changes.
   *
   * @param callback Function called with snapshot after each state change
   * @returns Unsubscribe function to clean up the subscription
   */
  subscribe(callback: (snapshot: LiftSnapshot) => void): () => void {
    return this.machine.subscribe(callback);
  }

  /**
   * Get current state snapshot.
   *
   * @returns Immutable snapshot of the current state
   */
  getState(): LiftSnapshot {
    return this.machine.getSnapshot();
  }

  /**
   * Record a referee's decision.
   *
   * @param position Referee position (left, chief, right)
   * @param decision Decision value (white, red, blue, yellow)
   */
  makeDecision(position: RefereePosition, decision: Decision) {
    this.machine.send({ type: EVENT_TYPES.DECISION, position, decision });
    this.decisionLog.record({ sessionId: this.sessionId, eventType: 'decision', position, decision });
  }

  /**
   * Allow a referee to retract their decision.
   *
   * @param position Referee position to reset
   */
  resetRefereeDecision(position: RefereePosition) {
    this.machine.send({ type: EVENT_TYPES.RESET_REFEREE_DECISION, position });
    this.decisionLog.record({ sessionId: this.sessionId, eventType: 'decision_reset', position });
  }

  /** Trigger display of lights once all decisions are made. */
  revealDecisions() {
    this.machine.send({ type: EVENT_TYPES.REVEAL_DECISIONS });
    this.decisionLog.record({ sessionId: this.sessionId, eventType: 'reveal' });
  }

  /** Clear all decisions and return to awaiting decisions state. */
  resetAll() {
    this.machine.send({ type: EVENT_TYPES.RESET_ALL });
    this.decisionLog.record({ sessionId: this.sessionId, eventType: 'reset_all' });
  }

  /**
   * Set a jury overrule decision.
   *
   * @param decision Jury's overrule decision
   */
  juryOverrule(decision: Decision) {
    this.machine.send({ type: EVENT_TYPES.JURY_OVERRULE, decision });
    this.decisionLog.record({ sessionId: this.sessionId, eventType: 'jury_overrule', decision });
  }

  /** Clear the jury overrule and return to awaiting decisions. */
  clearJuryOverrule() {
    this.machine.send({ type: EVENT_TYPES.CLEAR_JURY_OVERRULE });
    this.decisionLog.record({ sessionId: this.sessionId, eventType: 'clear_jury_overrule' });
  }

  /** Start (or restart) the 1-minute lift timer for the current lifter. */
  startTimer() {
    this.machine.send({ type: EVENT_TYPES.START_TIMER });
  }

  /** Stop the lift timer and reset it to a full minute, ready for the next lifter. */
  stopTimer() {
    this.machine.send({ type: EVENT_TYPES.STOP_TIMER });
  }

  /**
   * Register a referee as connected.
   *
   * @param position Referee position that connected
   */
  refereeConnected(position: RefereePosition) {
    this.machine.send({ type: EVENT_TYPES.REFEREE_CONNECTED, position });
  }

  /**
   * Register a referee as disconnected.
   *
   * @param position Referee position that disconnected
   */
  refereeDisconnected(position: RefereePosition) {
    this.machine.send({ type: EVENT_TYPES.REFEREE_DISCONNECTED, position });
  }
}
