import { SessionManager } from './session-manager.service';
import { LiftService } from './lift.service';
import { DecisionLogService } from '../../decision-log/decision-log.service';
import { RefereePosition, Decision } from '../shared/lift.constants';

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let decisionLog: jest.Mocked<DecisionLogService>;

  beforeEach(() => {
    decisionLog = { record: jest.fn() } as unknown as jest.Mocked<DecisionLogService>;
    sessionManager = new SessionManager(decisionLog);
  });

  it('should create a new LiftService for a session that does not exist yet', () => {
    const service = sessionManager.getOrCreate('PLAT-A');

    expect(service).toBeInstanceOf(LiftService);
    expect(sessionManager.has('PLAT-A')).toBe(true);
  });

  it('should return the same LiftService instance on repeated calls for the same session', () => {
    const first = sessionManager.getOrCreate('PLAT-A');
    const second = sessionManager.getOrCreate('PLAT-A');

    expect(first).toBe(second);
  });

  it('should keep separate state for different sessions', () => {
    const platformA = sessionManager.getOrCreate('PLAT-A');
    const platformB = sessionManager.getOrCreate('PLAT-B');

    platformA.makeDecision(RefereePosition.LEFT, Decision.WHITE);

    expect(platformA.getState().context.decisions.size).toBe(1);
    expect(platformB.getState().context.decisions.size).toBe(0);
  });

  it('should report a session as not existing before it has been created', () => {
    expect(sessionManager.has('NEVER-JOINED')).toBe(false);
  });
});
