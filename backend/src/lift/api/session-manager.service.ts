import { Injectable } from '@nestjs/common';
import { LiftService } from './lift.service';
import { DecisionLogService } from '../../decision-log/decision-log.service';

/**
 * Owns one LiftService (and its state machine) per session/platform ID.
 * Sessions are created lazily on first use - there is no explicit "create"
 * step, so a jury, referee, or display simply joining an ID is enough to
 * stand up that platform's state.
 */
@Injectable()
export class SessionManager {
  private readonly sessions = new Map<string, LiftService>();

  constructor(private readonly decisionLog: DecisionLogService) {}

  /** Returns the LiftService for a session, creating it if it doesn't exist yet. */
  getOrCreate(sessionId: string): LiftService {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = new LiftService(sessionId, this.decisionLog);
      this.sessions.set(sessionId, session);
    }

    return session;
  }

  /** Whether a session has already been created (as opposed to about to be lazily created). */
  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }
}
