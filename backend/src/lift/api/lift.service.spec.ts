import { LiftService } from './lift.service';
import { DecisionLogService } from '../../decision-log/decision-log.service';
import { LiftState, TimerStatus } from '../shared/lift.types';
import { RefereePosition, Decision } from '../shared/lift.constants';

describe('LiftService', () => {
  const SESSION_ID = 'SESSION1';
  let service: LiftService;
  let decisionLog: jest.Mocked<DecisionLogService>;

  beforeEach(() => {
    decisionLog = { record: jest.fn() } as unknown as jest.Mocked<DecisionLogService>;
    service = new LiftService(SESSION_ID, decisionLog);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getState', () => {
    it('should return initial state', () => {
      const state = service.getState();
      expect(state.state).toBe(LiftState.AWAITING_DECISIONS);
      expect(state.context.decisions.size).toBe(0);
    });
  });

  describe('makeDecision', () => {
    it('should record a decision', () => {
      service.makeDecision(RefereePosition.LEFT, Decision.WHITE);
      const state = service.getState();

      expect(state.context.decisions.get(RefereePosition.LEFT)).toBe(Decision.WHITE);
    });

    it('should accept all decision types', () => {
      service.makeDecision(RefereePosition.LEFT, Decision.WHITE);
      service.makeDecision(RefereePosition.CHIEF, Decision.RED);
      service.makeDecision(RefereePosition.RIGHT, Decision.BLUE);

      const state = service.getState();
      expect(state.context.decisions.get(RefereePosition.LEFT)).toBe(Decision.WHITE);
      expect(state.context.decisions.get(RefereePosition.CHIEF)).toBe(Decision.RED);
      expect(state.context.decisions.get(RefereePosition.RIGHT)).toBe(Decision.BLUE);
    });

    it('should change state to collecting decisions on first decision', () => {
      service.makeDecision(RefereePosition.LEFT, Decision.WHITE);
      expect(service.getState().state).toBe(LiftState.COLLECTING_DECISIONS);
    });

    it('should change state to ready to reveal when all 3 decide', () => {
      service.makeDecision(RefereePosition.LEFT, Decision.WHITE);
      service.makeDecision(RefereePosition.CHIEF, Decision.WHITE);
      service.makeDecision(RefereePosition.RIGHT, Decision.WHITE);

      expect(service.getState().state).toBe(LiftState.READY_TO_REVEAL);
    });

    it('should log the decision with the session ID', () => {
      service.makeDecision(RefereePosition.LEFT, Decision.WHITE);

      expect(decisionLog.record).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        eventType: 'decision',
        position: RefereePosition.LEFT,
        decision: Decision.WHITE,
      });
    });
  });

  describe('resetRefereeDecision', () => {
    it('should clear a referee decision', () => {
      service.makeDecision(RefereePosition.LEFT, Decision.WHITE);
      service.resetRefereeDecision(RefereePosition.LEFT);

      const state = service.getState();
      expect(state.context.decisions.has(RefereePosition.LEFT)).toBe(false);
    });

    it('should log the reset', () => {
      service.resetRefereeDecision(RefereePosition.LEFT);

      expect(decisionLog.record).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        eventType: 'decision_reset',
        position: RefereePosition.LEFT,
      });
    });
  });

  describe('revealDecisions', () => {
    it('should transition to revealing decisions state', () => {
      service.makeDecision(RefereePosition.LEFT, Decision.WHITE);
      service.makeDecision(RefereePosition.CHIEF, Decision.WHITE);
      service.makeDecision(RefereePosition.RIGHT, Decision.WHITE);
      service.revealDecisions();

      expect(service.getState().state).toBe(LiftState.REVEALING_DECISIONS);
    });

    it('should log the reveal', () => {
      service.revealDecisions();

      expect(decisionLog.record).toHaveBeenCalledWith({ sessionId: SESSION_ID, eventType: 'reveal' });
    });
  });

  describe('resetAll', () => {
    it('should clear all decisions', () => {
      service.makeDecision(RefereePosition.LEFT, Decision.WHITE);
      service.makeDecision(RefereePosition.CHIEF, Decision.RED);
      service.resetAll();

      const state = service.getState();
      expect(state.context.decisions.size).toBe(0);
      expect(state.state).toBe(LiftState.AWAITING_DECISIONS);
    });

    it('should log the reset', () => {
      service.resetAll();

      expect(decisionLog.record).toHaveBeenCalledWith({ sessionId: SESSION_ID, eventType: 'reset_all' });
    });
  });

  describe('juryOverrule', () => {
    it('should set jury overrule', () => {
      service.juryOverrule(Decision.WHITE);

      const state = service.getState();
      expect(state.state).toBe(LiftState.JURY_OVERRULE);
      expect(state.context.juryOverrule?.decision).toBe(Decision.WHITE);
    });

    it('should accept all decision types', () => {
      service.juryOverrule(Decision.YELLOW);

      const state = service.getState();
      expect(state.context.juryOverrule?.decision).toBe(Decision.YELLOW);
    });

    it('should log the overrule', () => {
      service.juryOverrule(Decision.RED);

      expect(decisionLog.record).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        eventType: 'jury_overrule',
        decision: Decision.RED,
      });
    });
  });

  describe('clearJuryOverrule', () => {
    it('should clear jury overrule', () => {
      service.juryOverrule(Decision.RED);
      service.clearJuryOverrule();

      const state = service.getState();
      expect(state.state).toBe(LiftState.AWAITING_DECISIONS);
      expect(state.context.juryOverrule).toBeUndefined();
    });

    it('should log the cleared overrule', () => {
      service.clearJuryOverrule();

      expect(decisionLog.record).toHaveBeenCalledWith({ sessionId: SESSION_ID, eventType: 'clear_jury_overrule' });
    });
  });

  describe('startTimer/stopTimer', () => {
    it('should start the lift timer', () => {
      service.startTimer();

      const state = service.getState();
      expect(state.context.timer.status).toBe(TimerStatus.RUNNING);
      expect(state.context.timer.endsAt).toBeDefined();
    });

    it('should stop and reset the lift timer', () => {
      service.startTimer();
      service.stopTimer();

      const state = service.getState();
      expect(state.context.timer.status).toBe(TimerStatus.STOPPED);
      expect(state.context.timer.endsAt).toBeUndefined();
    });

    it('should not write to the decision log', () => {
      service.startTimer();
      service.stopTimer();

      expect(decisionLog.record).not.toHaveBeenCalled();
    });
  });

  describe('refereeConnected/Disconnected', () => {
    it('should track connected referees', () => {
      service.refereeConnected(RefereePosition.LEFT);
      service.refereeConnected(RefereePosition.CHIEF);

      const state = service.getState();
      expect(state.context.connectedReferees.size).toBe(2);
    });

    it('should remove disconnected referees', () => {
      service.refereeConnected(RefereePosition.LEFT);
      service.refereeDisconnected(RefereePosition.LEFT);

      const state = service.getState();
      expect(state.context.connectedReferees.size).toBe(0);
    });
  });
});
