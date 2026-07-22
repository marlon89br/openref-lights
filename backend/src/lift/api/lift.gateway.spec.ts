import { Test, TestingModule } from '@nestjs/testing';
import { LiftGateway } from './lift.gateway';
import { SessionManager } from './session-manager.service';
import { DecisionLogService } from '../../decision-log/decision-log.service';
import { Socket } from 'socket.io';
import { RefereePosition, Decision } from '../shared/lift.constants';

const SESSION_ID = 'SESSION1';

describe('LiftGateway', () => {
  let gateway: LiftGateway;
  let sessionManager: SessionManager;
  let mockClient: Partial<Socket>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LiftGateway, SessionManager, { provide: DecisionLogService, useValue: { record: jest.fn() } }],
    }).compile();

    gateway = module.get<LiftGateway>(LiftGateway);
    sessionManager = module.get<SessionManager>(SessionManager);

    // Mock Socket.IO client
    mockClient = {
      id: 'test-client-id',
      emit: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
      disconnect: jest.fn(),
      handshake: {
        auth: {},
        query: {},
      } as any,
    };

    // Mock server
    gateway.server = {
      emit: jest.fn(),
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    } as any;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should allow connection when no auth token is configured', () => {
      delete process.env.AUTH_TOKEN;
      gateway.handleConnection(mockClient as Socket);

      expect(mockClient.disconnect).not.toHaveBeenCalled();
    });

    it('should reject connection with invalid token', () => {
      process.env.AUTH_TOKEN = 'secret-token';
      mockClient.handshake!.auth = { token: 'wrong-token' };

      gateway.handleConnection(mockClient as Socket);

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        message: 'Invalid authentication token',
      });
      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it('should allow connection with valid token', () => {
      process.env.AUTH_TOKEN = 'secret-token';
      mockClient.handshake!.auth = { token: 'secret-token' };

      gateway.handleConnection(mockClient as Socket);

      expect(mockClient.disconnect).not.toHaveBeenCalled();
    });

    it('should accept token from query params', () => {
      process.env.AUTH_TOKEN = 'secret-token';
      mockClient.handshake!.query = { token: 'secret-token' };

      gateway.handleConnection(mockClient as Socket);

      expect(mockClient.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('handleJoin', () => {
    it('should accept a valid session ID and position', async () => {
      const result = await gateway.handleJoin(mockClient as Socket, {
        sessionId: SESSION_ID,
        position: RefereePosition.LEFT,
      });

      expect(result?.success).toBe(true);
      expect(mockClient.join).toHaveBeenCalledWith(SESSION_ID);
      expect(mockClient.emit).toHaveBeenCalledWith('stateUpdate', expect.any(Object));
    });

    it('should reject a missing session ID', async () => {
      const result = await gateway.handleJoin(mockClient as Socket, {});

      expect(result).toEqual({ success: false, error: 'Invalid session ID' });
    });

    it('should reject an invalid session ID', async () => {
      const result = await gateway.handleJoin(mockClient as Socket, { sessionId: '!!' });

      expect(result).toEqual({ success: false, error: 'Invalid session ID' });
    });

    it('should reject invalid position', async () => {
      const result = await gateway.handleJoin(mockClient as Socket, {
        sessionId: SESSION_ID,
        position: 'invalid',
      });

      expect(result).toEqual({ success: false, error: 'Invalid position' });
    });

    it('should work without position (for display/jury)', async () => {
      const result = await gateway.handleJoin(mockClient as Socket, { sessionId: SESSION_ID });

      expect(result?.success).toBe(true);
      // Verify referee was not connected when no position provided
      const state = sessionManager.getOrCreate(SESSION_ID).getState();
      expect(state.context.connectedReferees.size).toBe(0);
    });

    it('should keep separate state for different session IDs', async () => {
      await gateway.handleJoin(mockClient as Socket, { sessionId: 'PLAT-A', position: RefereePosition.LEFT });
      await gateway.handleDecision(mockClient as Socket, { position: RefereePosition.LEFT, decision: Decision.WHITE });

      const platformA = sessionManager.getOrCreate('PLAT-A').getState();
      const platformB = sessionManager.getOrCreate('PLAT-B').getState();
      expect(platformA.context.decisions.size).toBe(1);
      expect(platformB.context.decisions.size).toBe(0);
    });

    it('should leave the previous session when switching to a new one', async () => {
      await gateway.handleJoin(mockClient as Socket, { sessionId: 'PLAT-A', position: RefereePosition.LEFT });
      await gateway.handleJoin(mockClient as Socket, { sessionId: 'PLAT-B', position: RefereePosition.LEFT });

      expect(mockClient.leave).toHaveBeenCalledWith('PLAT-A');
      const platformA = sessionManager.getOrCreate('PLAT-A').getState();
      expect(platformA.context.connectedReferees.has(RefereePosition.LEFT)).toBe(false);
    });
  });

  describe('handleDecision', () => {
    beforeEach(async () => {
      await gateway.handleJoin(mockClient as Socket, { sessionId: SESSION_ID });
    });

    it('should accept valid decision', async () => {
      const result = await gateway.handleDecision(mockClient as Socket, {
        position: RefereePosition.LEFT,
        decision: Decision.WHITE,
      });

      expect(result.success).toBe(true);
      expect(gateway.server.to).toHaveBeenCalledWith(SESSION_ID);
    });

    it('should reject invalid position', async () => {
      const result = await gateway.handleDecision(mockClient as Socket, {
        position: 'invalid',
        decision: 'white',
      });

      expect(result).toEqual({ success: false, error: 'Invalid position' });
    });

    it('should reject invalid decision', async () => {
      const result = await gateway.handleDecision(mockClient as Socket, {
        position: RefereePosition.LEFT,
        decision: 'invalid',
      });

      expect(result).toEqual({ success: false, error: 'Invalid decision' });
    });

    it('should accept all decision types', async () => {
      const decisions = [Decision.WHITE, Decision.RED, Decision.BLUE, Decision.YELLOW];

      for (const decision of decisions) {
        const result = await gateway.handleDecision(mockClient as Socket, {
          position: RefereePosition.LEFT,
          decision,
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('actions without a prior join', () => {
    it('should reject a decision from a client that has not joined a session', async () => {
      const result = await gateway.handleDecision(mockClient as Socket, {
        position: RefereePosition.LEFT,
        decision: Decision.WHITE,
      });

      expect(result).toEqual({ success: false, error: 'Not joined to a session' });
    });

    it('should reject startTimer from a client that has not joined a session', async () => {
      const result = await gateway.handleStartTimer(mockClient as Socket);
      expect(result).toEqual({ success: false, error: 'Not joined to a session' });
    });
  });

  describe('handleResetDecision', () => {
    beforeEach(async () => {
      await gateway.handleJoin(mockClient as Socket, { sessionId: SESSION_ID });
    });

    it('should reset decision for valid position', async () => {
      await gateway.handleDecision(mockClient as Socket, {
        position: RefereePosition.LEFT,
        decision: Decision.WHITE,
      });

      const result = await gateway.handleResetDecision(mockClient as Socket, {
        position: RefereePosition.LEFT,
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid position', async () => {
      const result = await gateway.handleResetDecision(mockClient as Socket, {
        position: 'invalid',
      });

      expect(result).toEqual({ success: false, error: 'Invalid position' });
    });
  });

  describe('handleRevealDecisions', () => {
    it('should trigger reveal decisions event', async () => {
      await gateway.handleJoin(mockClient as Socket, { sessionId: SESSION_ID });
      const result = await gateway.handleRevealDecisions(mockClient as Socket);

      expect(result.success).toBe(true);
      expect(gateway.server.to).toHaveBeenCalledWith(SESSION_ID);
    });
  });

  describe('handleReset', () => {
    it('should reset the system', async () => {
      await gateway.handleJoin(mockClient as Socket, { sessionId: SESSION_ID });
      const result = await gateway.handleReset(mockClient as Socket);

      expect(result.success).toBe(true);
      expect(gateway.server.to).toHaveBeenCalledWith(SESSION_ID);
    });
  });

  describe('handleJuryOverrule', () => {
    beforeEach(async () => {
      await gateway.handleJoin(mockClient as Socket, { sessionId: SESSION_ID });
    });

    it('should accept valid jury overrule', async () => {
      const result = await gateway.handleJuryOverrule(mockClient as Socket, {
        decision: Decision.WHITE,
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid decision', async () => {
      const result = await gateway.handleJuryOverrule(mockClient as Socket, {
        decision: 'invalid',
      });

      expect(result).toEqual({ success: false, error: 'Invalid decision' });
    });
  });

  describe('handleClearJuryOverrule', () => {
    it('should clear jury overrule', async () => {
      await gateway.handleJoin(mockClient as Socket, { sessionId: SESSION_ID });
      await gateway.handleJuryOverrule(mockClient as Socket, {
        decision: Decision.WHITE,
      });

      const result = await gateway.handleClearJuryOverrule(mockClient as Socket);

      expect(result.success).toBe(true);
    });
  });

  describe('handleStartTimer/handleStopTimer', () => {
    beforeEach(async () => {
      await gateway.handleJoin(mockClient as Socket, { sessionId: SESSION_ID });
    });

    it('should start the lift timer', async () => {
      const result = await gateway.handleStartTimer(mockClient as Socket);

      expect(result.success).toBe(true);
      expect(sessionManager.getOrCreate(SESSION_ID).getState().context.timer.status).toBe('running');
    });

    it('should stop and reset the lift timer', async () => {
      await gateway.handleStartTimer(mockClient as Socket);
      const result = await gateway.handleStopTimer(mockClient as Socket);

      expect(result.success).toBe(true);
      expect(sessionManager.getOrCreate(SESSION_ID).getState().context.timer.status).toBe('stopped');
    });
  });

  describe('handleDisconnect', () => {
    it('should remove referee on disconnect', async () => {
      await gateway.handleJoin(mockClient as Socket, { sessionId: SESSION_ID, position: RefereePosition.LEFT });

      gateway.handleDisconnect(mockClient as Socket);

      const state = sessionManager.getOrCreate(SESSION_ID).getState();
      expect(state.context.connectedReferees.has(RefereePosition.LEFT)).toBe(false);
    });

    it('should do nothing when the client never joined a session', () => {
      expect(() => gateway.handleDisconnect(mockClient as Socket)).not.toThrow();
    });
  });
});
