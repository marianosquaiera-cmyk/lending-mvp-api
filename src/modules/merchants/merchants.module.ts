import { Module } from '@nestjs/common';
import { MerchantsController } from './merchants.controller';
import { MerchantsService } from './merchants.service';
import { PrismaService } from '../../database/prisma.service';

@Module({
  controllers: [MerchantsController],
  providers: [MerchantsService, PrismaService],
  exports: [MerchantsService],
})
export class MerchantsModule {}
