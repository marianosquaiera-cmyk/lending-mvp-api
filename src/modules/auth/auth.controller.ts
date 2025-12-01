import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('merchant/login')
  async merchantLogin(@Body() dto: { email: string; password: string }) {
    return this.authService.merchantLogin(dto.email, dto.password);
  }

  @Post('admin/login')
  async adminLogin(@Body() dto: { email: string; password: string }) {
    return this.authService.adminLogin(dto.email, dto.password);
  }

  @Get('profile')
  @UseGuards(JwtGuard)
  async getProfile(@CurrentUser() user: any) {
    if (user.type === 'merchant') {
      return this.authService.getMerchantProfile(user.merchantId);
    } else {
      return this.authService.getAdminProfile(user.adminId);
    }
  }
}