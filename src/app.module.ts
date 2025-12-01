import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './database/prisma.module';
import { MerchantsModule } from './modules/merchants/merchants.module';
import { LoansModule } from './modules/loans/loans.module';
import { TiendanubeModule } from './modules/tiendanube/tiendanube.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    MerchantsModule,
    LoansModule,
    TiendanubeModule,
    JobsModule,
    AdminModule,
    AuthModule,
  ],
})
export class AppModule {}