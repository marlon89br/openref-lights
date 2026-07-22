import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { SessionManager } from './session-manager.service';
import { LiftService } from './lift.service';
import { LiftSnapshot } from '../shared/lift.types';
import {
  RefereePosition,
  Decision,
  ALL_REFEREE_POSITIONS,
  ALL_DECISIONS,
  SESSION_ID_PATTERN,
} from '../shared/lift.constants';

interface ClientData {
  sessionId?: string;
  position?: RefereePosition;
}

/** Type guard to validate referee position strings from client. */
function isValidPosition(position: string): position is RefereePosition {
  return ALL_REFEREE_POSITIONS.includes(position as RefereePosition);
}

/** Type guard to validate decision strings from client. */
function isValidDecision(decision: string): decision is Decision {
  return ALL_DECISIONS.includes(decision as Decision);
}

/** Type guard to validate session/platform ID strings from client. */
function isValidSessionId(sessionId: string): boolean {
  return SESSION_ID_PATTERN.test(sessionId);
}

/**
 * WebSocket gateway for real-time lift state management.
 *
 * Handles WebSocket connections from referees, jury, and displays.
 * Each client joins a session/platform ID, which scopes it to a Socket.IO
 * room and to that session's own LiftService instance - multiple platforms
 * can run concurrently without seeing each other's state. Validates
 * incoming messages, forwards them to the service layer, and broadcasts
 * state updates to every client in that session's room.
 *
 * Supports optional token-based authentication via AUTH_TOKEN env variable.
 */
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: (process.env.CORS_ORIGIN || '*') !== '*',
  },
})
export class LiftGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(LiftGateway.name);

  @WebSocketServer()
  server!: Server;

  private clients = new Map<string, ClientData>();
  private subscribedSessions = new Set<string>();

  constructor(private readonly sessionManager: SessionManager) {}

  /**
   * Handle new WebSocket connections.
   * Validates authentication token if AUTH_TOKEN env variable is set.
   *
   * @param client Socket.IO client connection
   */
  handleConnection(client: Socket) {
    const authToken = process.env.AUTH_TOKEN;

    // If auth token is configured, validate it
    if (authToken) {
      const clientToken = client.handshake.auth?.token || client.handshake.query?.token;

      if (clientToken !== authToken) {
        this.logger.warn(`Client ${client.id} rejected: invalid token`);
        client.emit('error', { message: 'Invalid authentication token' });
        client.disconnect();
        return;
      }
    }

    this.logger.log(`Client connected: ${client.id}`);
  }

  /**
   * Handle WebSocket disconnections.
   * Notifies the session's service if a referee disconnects so connection tracking stays accurate.
   *
   * @param client Socket.IO client connection
   */
  handleDisconnect(client: Socket) {
    const clientData = this.clients.get(client.id);
    if (clientData?.sessionId && clientData.position) {
      this.sessionManager.getOrCreate(clientData.sessionId).refereeDisconnected(clientData.position);
      // No need to manually broadcast - the subscription will handle it
    }
    this.clients.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Handle 'join' event when a client identifies which session/platform it belongs to.
   * Sends current state to the new client and registers referee connections.
   *
   * @param client Socket.IO client
   * @param data Contains the session/platform ID and an optional position (left, chief, right) for referees
   * @returns Success response or error if the session ID or position is invalid
   */
  @SubscribeMessage('join')
  async handleJoin(@ConnectedSocket() client: Socket, @MessageBody() data: { sessionId?: string; position?: string }) {
    if (!data.sessionId || !isValidSessionId(data.sessionId)) {
      return { success: false, error: 'Invalid session ID' };
    }
    if (data.position && !isValidPosition(data.position)) {
      return { success: false, error: 'Invalid position' };
    }

    const sessionId = data.sessionId;
    const position = data.position as RefereePosition | undefined;

    // Leave a previously-joined session (e.g. the jury switching platforms) before joining the new one.
    const previous = this.clients.get(client.id);
    if (previous?.sessionId && previous.sessionId !== sessionId) {
      client.leave(previous.sessionId);
      if (previous.position) {
        this.sessionManager.getOrCreate(previous.sessionId).refereeDisconnected(previous.position);
      }
    }

    this.clients.set(client.id, { sessionId, position });
    client.join(sessionId);

    const liftService = this.sessionManager.getOrCreate(sessionId);
    this.ensureSubscribed(sessionId, liftService);

    // Send current state to newly connected client
    client.emit('stateUpdate', this.serializeState(liftService.getState()));

    // Register referee connection after sending initial state
    if (position) {
      liftService.refereeConnected(position);
    }

    return { success: true };
  }

  /**
   * Handle 'decision' event when a referee makes a decision.
   * Validates position and decision before forwarding to service.
   *
   * @param client Socket.IO client
   * @param data Contains position and decision
   * @returns Success response or error if validation fails
   */
  @SubscribeMessage('decision')
  async handleDecision(@ConnectedSocket() client: Socket, @MessageBody() data: { position: string; decision: string }) {
    const liftService = this.requireSession(client);
    if (!liftService) return { success: false, error: 'Not joined to a session' };
    if (!isValidPosition(data.position)) {
      return { success: false, error: 'Invalid position' };
    }
    if (!isValidDecision(data.decision)) {
      return { success: false, error: 'Invalid decision' };
    }

    liftService.makeDecision(data.position, data.decision);
    return { success: true };
  }

  /**
   * Handle 'resetRefereeDecision' event when a referee retracts their decision.
   *
   * @param client Socket.IO client
   * @param data Contains position to reset
   * @returns Success response or error if position is invalid
   */
  @SubscribeMessage('resetRefereeDecision')
  async handleResetDecision(@ConnectedSocket() client: Socket, @MessageBody() data: { position: string }) {
    const liftService = this.requireSession(client);
    if (!liftService) return { success: false, error: 'Not joined to a session' };
    if (!isValidPosition(data.position)) {
      return { success: false, error: 'Invalid position' };
    }

    liftService.resetRefereeDecision(data.position);
    return { success: true };
  }

  /** Handle 'revealDecisions' event to display the lights when all decisions are in. */
  @SubscribeMessage('revealDecisions')
  async handleRevealDecisions(@ConnectedSocket() client: Socket) {
    const liftService = this.requireSession(client);
    if (!liftService) return { success: false, error: 'Not joined to a session' };

    liftService.revealDecisions();
    return { success: true };
  }

  /** Handle 'resetAll' event to clear all decisions and return to awaiting decisions. */
  @SubscribeMessage('resetAll')
  async handleReset(@ConnectedSocket() client: Socket) {
    const liftService = this.requireSession(client);
    if (!liftService) return { success: false, error: 'Not joined to a session' };

    liftService.resetAll();
    return { success: true };
  }

  /**
   * Handle 'juryOverrule' event when jury overrules with a specific decision.
   *
   * @param client Socket.IO client
   * @param data Contains the jury's decision
   * @returns Success response or error if decision is invalid
   */
  @SubscribeMessage('juryOverrule')
  async handleJuryOverrule(@ConnectedSocket() client: Socket, @MessageBody() data: { decision: string }) {
    const liftService = this.requireSession(client);
    if (!liftService) return { success: false, error: 'Not joined to a session' };
    if (!isValidDecision(data.decision)) {
      return { success: false, error: 'Invalid decision' };
    }

    liftService.juryOverrule(data.decision);
    return { success: true };
  }

  /** Handle 'clearJuryOverrule' event to exit jury overrule mode. */
  @SubscribeMessage('clearJuryOverrule')
  async handleClearJuryOverrule(@ConnectedSocket() client: Socket) {
    const liftService = this.requireSession(client);
    if (!liftService) return { success: false, error: 'Not joined to a session' };

    liftService.clearJuryOverrule();
    return { success: true };
  }

  /** Handle 'startTimer' event when the jury/table starts the 1-minute lift timer. */
  @SubscribeMessage('startTimer')
  async handleStartTimer(@ConnectedSocket() client: Socket) {
    const liftService = this.requireSession(client);
    if (!liftService) return { success: false, error: 'Not joined to a session' };

    liftService.startTimer();
    return { success: true };
  }

  /** Handle 'stopTimer' event when the jury/table stops/resets the lift timer. */
  @SubscribeMessage('stopTimer')
  async handleStopTimer(@ConnectedSocket() client: Socket) {
    const liftService = this.requireSession(client);
    if (!liftService) return { success: false, error: 'Not joined to a session' };

    liftService.stopTimer();
    return { success: true };
  }

  /** Resolves the LiftService for the session a client has joined, or null if it hasn't joined one yet. */
  private requireSession(client: Socket): LiftService | null {
    const sessionId = this.clients.get(client.id)?.sessionId;
    if (!sessionId) return null;

    return this.sessionManager.getOrCreate(sessionId);
  }

  /** Subscribes to a session's state changes exactly once, broadcasting updates to its room. */
  private ensureSubscribed(sessionId: string, liftService: LiftService) {
    if (this.subscribedSessions.has(sessionId)) return;
    this.subscribedSessions.add(sessionId);

    liftService.subscribe((snapshot) => {
      this.logger.log(`[${sessionId}] State changed: ${snapshot.state}, decisions: ${snapshot.context.decisions.size}`);
      this.server.to(sessionId).emit('stateUpdate', this.serializeState(snapshot));
    });
  }

  /**
   * Serialize state for WebSocket transmission.
   * Converts Map and Set to arrays since they don't serialize to JSON.
   *
   * @param snapshot State snapshot from machine
   * @returns JSON-serializable state object
   */
  private serializeState(snapshot: LiftSnapshot) {
    return {
      state: snapshot.state,
      context: {
        decisions: Array.from(snapshot.context.decisions.entries()).map(([pos, dec]) => ({
          position: pos,
          decision: dec,
        })),
        connectedReferees: Array.from(snapshot.context.connectedReferees),
        juryOverrule: snapshot.context.juryOverrule,
        timer: snapshot.context.timer,
      },
    };
  }
}
