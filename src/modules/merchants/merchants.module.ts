import { Module } from '@nestjs/common';
import { MerchantsService } from './merchants.service';
import { MerchantsController } from './merchants.controller';
import { TiendanubeModule } from '../tiendanube/tiendanube.module';

@Module({
  imports: [TiendanubeModule],
  providers: [MerchantsService],[TiendanubeService],[AfipService],[BCRAService],[PrismaService],
  controllers: [MerchantsController],
  exports: [MerchantsService],
})
export class MerchantsModule {}
