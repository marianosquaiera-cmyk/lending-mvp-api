import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { LoansService } from './loans.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Decimal } from '@prisma/client/runtime/library';

@Controller('loans')
@UseGuards(JwtGuard)
export class LoansController {
  constructor(private loansService: LoansService) {}

  @Get('pre-offer')
  async getPreOffer(@CurrentUser() user: any):Promise<any> {
    return this.loansService.getPreOffer(user.merchantId);
  }

  @Post()
  async createLoan(
    @CurrentUser() user: any,
    @Body() dto: { planDays: number; desiredAmount?: string },
  ) {
    const desiredAmount = dto.desiredAmount
      ? new Decimal(dto.desiredAmount)
      : undefined;

    return this.loansService.createLoan(
      user.merchantId,
      dto.planDays,
      desiredAmount,
    );
  }

  @Get(':loanId')
  async getLoanDetails(
    @Param('loanId') loanId: string,
    @CurrentUser() user: any,
  ) {
    return this.loansService.getLoanDetails(loanId, user.merchantId);
  }

  @Post(':loanId/manual-payment')
  async recordManualPayment(
    @Param('loanId') loanId: string,
    @CurrentUser() user: any,
    @Body() dto: { amount: string; reference?: string },
  ) {
    const amount = new Decimal(dto.amount);
    return this.loansService.recordManualPayment(
      loanId,
      user.merchantId,
      amount,
      dto.reference,
    );
  }
}
