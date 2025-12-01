import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { AdminGuard } from '../../common/guards/admin.guard';

@Controller('admin')
@UseGuards(JwtGuard, AdminGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('dashboard')
  async getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('loans')
  async getLoans(@Query('status') status?: string) {
    return this.adminService.getAllLoans(status);
  }

  @Get('merchants')
  async getMerchants(@Query('status') status?: string) {
    return this.adminService.getAllMerchants(status);
  }

  @Get('stats')
  async getStats() {
    return this.adminService.getStats();
  }

  @Get('payments')
  async getPayments() {
    return this.adminService.getRecentPayments();
  }
}