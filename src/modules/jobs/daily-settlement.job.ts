import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { TiendanubeService } from '../tiendanube/tiendanube.service';

@Injectable()
export class DailySettlementJob {
  private readonly logger = new Logger(DailySettlementJob.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processDailySettlement() {
    this.logger.log('🔄 Starting daily settlement process...');

    try {
      const activeLoans = await this.prisma.loan.findMany({
        where: { status: 'ACTIVE' },
        include: { merchant: true },
      });

      this.logger.log(`Found ${activeLoans.length} active loans`);

      for (const loan of activeLoans) {
        try {
          await this.processLoanSettlement(loan);
        } catch (error: any) {
          this.logger.error(
            `Error settling loan ${loan.id}: ${error.message}`,
          );
        }
      }

      this.logger.log('✅ Daily settlement completed');
    } catch (error: any) {
      this.logger.error(`Fatal error in daily settlement: ${error.message}`);
    }
  }

  private async processLoanSettlement(loan: any) {
    const merchantId = loan.merchantId;
    const loanId = loan.id;

    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    yesterday.setUTCHours(0, 0, 0, 0);

    const dailySale = await this.prisma.dailySales.findUnique({
      where: {
        merchantId_date: {
          merchantId,
          date: yesterday,
        },
      },
    });

    const ventas_dia = dailySale?.grossAmount || new Decimal(0);

    const autoAmount = ventas_dia.mul(loan.dailyPercentage);

    const manualPayment = await this.prisma.payment.findUnique({
      where: {
        loanId_date: {
          loanId,
          date: yesterday,
        },
      },
    });

    const manualAmount = manualPayment?.manualAmount || new Decimal(0);

    const totalPaymentBefore = autoAmount.add(manualAmount);
    const totalPayment = totalPaymentBefore.greaterThan(loan.remainingBalance)
      ? loan.remainingBalance
      : totalPaymentBefore;

    await this.prisma.payment.upsert({
      where: {
        loanId_date: {
          loanId,
          date: yesterday,
        },
      },
      update: {
        autoAmount,
        amount: totalPayment,
      },
      create: {
        loanId,
        date: yesterday,
        amount: totalPayment,
        autoAmount,
        manualAmount,
      },
    });

    const newBalance = loan.remainingBalance.minus(totalPayment);
    const newStatus = newBalance.lte(0) ? 'PAID' : 'ACTIVE';

    await this.prisma.loan.update({
      where: { id: loanId },
      data: {
        remainingBalance: newBalance.max(0),
        status: newStatus,
        endDate: newStatus === 'PAID' ? new Date() : null,
      },
    });

    const percentPaid = loan.totalToRepay.isZero()
      ? new Decimal(0)
      : loan.totalToRepay
          .minus(newBalance.max(0))
          .div(loan.totalToRepay)
          .mul(100);

    this.logger.log(
      `✅ Loan ${loanId} settled: Auto=${autoAmount.toFixed(
        2,
      )} + Manual=${manualAmount.toFixed(2)} = Total=${totalPayment.toFixed(
        2,
      )} | New Balance=${newBalance.max(0).toFixed(2)} | Paid=${percentPaid.toFixed(
        1,
      )}% | Status=${newStatus}`,
    );
  }
}

@Injectable()
export class DailySalesSyncJob {
  private readonly logger = new Logger(DailySalesSyncJob.name);

  constructor(
    private prisma: PrismaService,
    private tiendanubeService: TiendanubeService,
  ) {}

  @Cron('30 0,6,12,18 * * *')
  async syncRecentSales() {
    this.logger.log('🔄 Starting sales sync...');

    try {
      const merchants = await this.prisma.merchant.findMany({
        where: {
          status: 'active',
          tiendanubeId: { not: null },
          tiendanubeToken: { not: null },
        },
      });

      this.logger.log(`Syncing sales for ${merchants.length} merchants`);

      for (const merchant of merchants) {
        try {
          await this.tiendanubeService.syncRecentOrders(merchant.id);
        } catch (error: any) {
          this.logger.error(
            `Error syncing merchant ${merchant.id}: ${error.message}`,
          );
        }
      }

      this.logger.log('✅ Sales sync completed');
    } catch (error: any) {
      this.logger.error(`Fatal error in sales sync: ${error.message}`);
    }
  }
}