import { Module } from '@nestjs/common';
import { DecisionLogService } from './decision-log.service';

@Module({
  providers: [DecisionLogService],
  exports: [DecisionLogService],
})
export class DecisionLogModule {}
