import { Module } from '@nestjs/common';
import { DailySettlementJob, DailySalesSyncJob } from './daily-settlement.job';
import { TiendanubeModule } from '../tiendanube/tiendanube.module';

@Module({
  imports: [TiendanubeModule],
  providers: [DailySettlementJob, DailySalesSyncJob],
})
export class JobsModule {}