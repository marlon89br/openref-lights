import { Injectable, Logger, Optional } from '@nestjs/common';
import { appendFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { DecisionLogEntry } from './decision-log.types';

/**
 * Appends a permanent, timestamped record of every referee/jury decision event
 * to a JSON-lines file on disk, so the history survives backend restarts and
 * can be inspected later if a call ever needs to be revisited.
 */
@Injectable()
export class DecisionLogService {
  private readonly logger = new Logger(DecisionLogService.name);
  private readonly logPath: string;

  constructor(@Optional() logPath?: string) {
    this.logPath = logPath || process.env.DECISION_LOG_PATH || join(process.cwd(), 'data', 'decision-log.jsonl');
    mkdirSync(dirname(this.logPath), { recursive: true });
  }

  /** Records an entry with the current timestamp. Never throws - a logging failure must not break a live decision. */
  record(entry: DecisionLogEntry): void {
    try {
      const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() });
      appendFileSync(this.logPath, line + '\n');
    } catch (error) {
      this.logger.error(`Failed to write decision log entry: ${(error as Error).message}`);
    }
  }
}
