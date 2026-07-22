import { TestBed } from '@angular/core/testing';
import { LiftService } from './lift.service';
import { LiftStateType, Decision, RefereePosition } from '../models/lift.model';

const SESSION_ID = 'SESSION1';

// Mock socket.io-client
const mockSocket = {
  connected: false,
  id: 'mock-socket-id',
  on: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

describe('LiftService', () => {
  let service: LiftService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LiftService);
    vi.clearAllMocks();
  });

  afterEach(() => {
    service.disconnect();
  });

  describe('Connection Management', () => {
    it('should create the service', () => {
      expect(service).toBeTruthy();
    });

    it('should connect to backend with a session and position', () => {
      service.connect(SESSION_ID, RefereePosition.LEFT);
      expect(service.isConnected()).toBeDefined();
    });

    it('should not connect if already connected', () => {
      mockSocket.connected = true;
      service.connect(SESSION_ID);
      const firstCallCount = mockSocket.on.mock.calls.length;

      service.connect(SESSION_ID);
      expect(mockSocket.on.mock.calls.length).toBe(firstCallCount);

      mockSocket.connected = false;
    });

    it('should disconnect properly', () => {
      service.connect(SESSION_ID);
      service.disconnect();
      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(service.state()).toBeNull();
    });
  });

  describe('State Management', () => {
    it('should initialize with null state', () => {
      expect(service.state()).toBeNull();
    });

    it('should update state on stateUpdate event', () => {
      service.connect(SESSION_ID);

      const stateUpdateHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'stateUpdate')?.[1];

      const mockState = {
        state: LiftStateType.AWAITING_DECISIONS,
        context: {
          decisions: [],
          juryOverrule: null,
        },
      };

      stateUpdateHandler?.(mockState);
      expect(service.state()).toEqual(mockState);
    });

    it('should compute current state correctly', () => {
      service.connect(SESSION_ID);

      const stateUpdateHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'stateUpdate')?.[1];

      stateUpdateHandler?.({
        state: LiftStateType.COLLECTING_DECISIONS,
        context: { decisions: [], juryOverrule: null },
      });

      expect(service.currentState()).toBe(LiftStateType.COLLECTING_DECISIONS);
    });

    it('should compute decisions correctly', () => {
      service.connect(SESSION_ID);

      const stateUpdateHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'stateUpdate')?.[1];

      const mockDecisions = [{ position: RefereePosition.LEFT, decision: Decision.WHITE }];

      stateUpdateHandler?.({
        state: LiftStateType.COLLECTING_DECISIONS,
        context: { decisions: mockDecisions, juryOverrule: null },
      });

      expect(service.decisions()).toEqual(mockDecisions);
    });
  });

  describe('Event Emission', () => {
    beforeEach(() => {
      service.connect(SESSION_ID);
    });

    it('should emit decision event', () => {
      service.makeDecision(RefereePosition.LEFT, Decision.WHITE);
      expect(mockSocket.emit).toHaveBeenCalledWith('decision', {
        position: RefereePosition.LEFT,
        decision: Decision.WHITE,
      });
    });

    it('should emit resetRefereeDecision event', () => {
      service.resetRefereeDecision(RefereePosition.LEFT);
      expect(mockSocket.emit).toHaveBeenCalledWith('resetRefereeDecision', {
        position: RefereePosition.LEFT,
      });
    });

    it('should emit revealDecisions event', () => {
      service.revealDecisions();
      expect(mockSocket.emit).toHaveBeenCalledWith('revealDecisions');
    });

    it('should emit resetAll event', () => {
      service.resetAll();
      expect(mockSocket.emit).toHaveBeenCalledWith('resetAll');
    });

    it('should emit juryOverrule event', () => {
      service.juryOverrule(Decision.RED);
      expect(mockSocket.emit).toHaveBeenCalledWith('juryOverrule', {
        decision: Decision.RED,
      });
    });

    it('should emit startTimer event', () => {
      service.startTimer();
      expect(mockSocket.emit).toHaveBeenCalledWith('startTimer');
    });

    it('should emit stopTimer event', () => {
      service.stopTimer();
      expect(mockSocket.emit).toHaveBeenCalledWith('stopTimer');
    });
  });

  describe('Socket Event Handlers', () => {
    it('should handle connect event', () => {
      service.connect(SESSION_ID, RefereePosition.CHIEF);

      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1];

      connectHandler?.();
      expect(mockSocket.emit).toHaveBeenCalledWith('join', {
        sessionId: SESSION_ID,
        position: RefereePosition.CHIEF,
      });
    });

    it('should handle disconnect event', () => {
      service.connect(SESSION_ID);

      const disconnectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'disconnect')?.[1];

      expect(disconnectHandler).toBeDefined();
      disconnectHandler?.('transport close');
    });

    it('should handle reconnect event', () => {
      service.connect(SESSION_ID, RefereePosition.RIGHT);

      const reconnectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'reconnect')?.[1];

      reconnectHandler?.(1);
      expect(mockSocket.emit).toHaveBeenCalledWith('join', {
        sessionId: SESSION_ID,
        position: RefereePosition.RIGHT,
      });
    });

    it('should handle error event', () => {
      service.connect(SESSION_ID);

      const errorHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'error')?.[1];

      const mockError = new Error('Test error');

      expect(() => errorHandler?.(mockError)).not.toThrow();
    });
  });
});
