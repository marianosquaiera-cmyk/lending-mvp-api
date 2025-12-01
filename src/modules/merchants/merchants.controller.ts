import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { MerchantsService } from './merchants.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('merchants')
export class MerchantsController {
  constructor(private merchantsService: MerchantsService) {}

  @Post('register')
  async register(@Body() dto: any) {
    return this.merchantsService.registerMerchant({
      cuit: dto.cuit,
      businessName: dto.businessName,
      email: dto.email,
      phone: dto.phone,
      cbu: dto.cbu,
      brandName: dto.brandName,
    });
  }

  @Get('me')
  @UseGuards(JwtGuard)
  async getCurrentMerchant(@CurrentUser() user: any) {
    return this.merchantsService.getMerchantWithOferta(user.merchantId);
  }

  @Get('tiendanube/auth-url')
  @UseGuards(JwtGuard)
  async getTiendanubeAuthUrl(@CurrentUser() user: any) {
    const url = this.merchantsService.getTiendanubeAuthUrl(user.merchantId);
    return { authUrl: url };
  }
}