import { Module } from '@nestjs/common';
import { SessionManager } from './api/session-manager.service';
import { LiftGateway } from './api/lift.gateway';
import { DecisionLogModule } from '../decision-log/decision-log.module';

@Module({
  imports: [DecisionLogModule],
  providers: [SessionManager, LiftGateway],
})
export class LiftModule {}
