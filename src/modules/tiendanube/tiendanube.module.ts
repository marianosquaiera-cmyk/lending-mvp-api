import { Module } from '@nestjs/common';
import { TiendanubeService, AfipService, BcraService } from './tiendanube.service';

@Module({
  providers: [TiendanubeService, AfipService, BcraService],
  exports: [TiendanubeService, AfipService, BcraService],
})
export class TiendanubeModule {}