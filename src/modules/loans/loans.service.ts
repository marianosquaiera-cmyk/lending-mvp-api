import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

interface PreOfferDTO {
  monthlyRevenue: string;
  maxLoanCapital: string;
  plans: {
    plan120: PlanOffer;
    plan180: PlanOffer;
  };
}

interface PlanOffer {
  planDays: number;
  capital: string;
  totalToRepay: string;
  periodRate: string;
  dailyPercentage: string;
  estimatedDaysToRepay: number;
}

@Injectable()
export class LoansService {
  private readonly MAX_LOAN_CAPITAL = new Decimal(10_000_000);
  private readonly LOAN_PERCENTAGE = new Decimal(0.30);
  private readonly TNA = new Decimal(0.80);
  private readonly MAX_DAILY_PERCENTAGE = new Decimal(0.10);
  private readonly DAYS_PER_YEAR = 365;

  constructor(private prisma: PrismaService) {}

  async getPreOffer(merchantId: string): Promise<PreOfferDTO> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    if (!merchant.monthlyRevenue || merchant.monthlyRevenue.isZero()) {
      throw new BadRequestException(
        'No sales data. Connect Tiendanube and sync sales.',
      );
    }

    const F = merchant.monthlyRevenue;
    const dailyRevenue = F.div(30);

    const capitalBruto = F.mul(this.LOAN_PERCENTAGE);
    const capital = capitalBruto.greaterThan(this.MAX_LOAN_CAPITAL)
      ? this.MAX_LOAN_CAPITAL
      : capitalBruto;

    const plan120 = this.calculatePlan(capital, dailyRevenue, 120);
    const plan180 = this.calculatePlan(capital, dailyRevenue, 180);

    return {
      monthlyRevenue: F.toFixed(2),
      maxLoanCapital: capital.toFixed(2),
      plans: {
        plan120,
        plan180,
      },
    };
  }

  async createLoan(
    merchantId: string,
    planDays: number,
    desiredAmount?: Decimal,
  ) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    if (merchant.status !== 'active') {
      throw new ForbiddenException('Merchant is not active');
    }

    const activeLoan = await this.prisma.loan.findFirst({
      where: {
        merchantId,
        status: 'ACTIVE',
      },
    });

    if (activeLoan) {
      throw new BadRequestException('Merchant already has an active loan');
    }

    const offer = await this.getPreOffer(merchantId);
    const maxCapital = new Decimal(offer.maxLoanCapital);

    let capital = maxCapital;
    if (desiredAmount && desiredAmount.greaterThan(0)) {
      if (desiredAmount.greaterThan(maxCapital)) {
        throw new BadRequestException(
          `Desired amount exceeds maximum ${offer.maxLoanCapital}`,
        );
      }
      capital = desiredAmount;
    }

    if (![120, 180].includes(planDays)) {
      throw new BadRequestException('Plan must be 120 or 180 days');
    }

    const periodRateDecimal = this.calculatePeriodRate(planDays);
    const totalToRepay = capital.mul(new Decimal(1).add(periodRateDecimal));

    const dailyRevenue =
      merchant.dailyRevenue || merchant.monthlyRevenue.div(30);
    let dailyPercentage = totalToRepay.div(dailyRevenue).div(planDays);

    if (dailyPercentage.greaterThan(this.MAX_DAILY_PERCENTAGE)) {
      dailyPercentage = this.MAX_DAILY_PERCENTAGE;
    }

    const loan = await this.prisma.loan.create({
      data: {
        merchantId,
        capitalAmount: capital,
        totalToRepay,
        remainingBalance: totalToRepay,
        planDays,
        periodRate: periodRateDecimal,
        dailyPercentage,
        status: 'ACTIVE',
        startDate: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'loan_created',
        merchantId,
        details: {
          loanId: loan.id,
          capital: capital.toString(),
          total: totalToRepay.toString(),
          planDays,
        },
      },
    });

    return loan;
  }

  async getLoanDetails(loanId: string, merchantId: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        payments: {
          orderBy: { date: 'desc' },
          take: 30,
        },
      },
    });

    if (!loan || loan.merchantId !== merchantId) {
      throw new ForbiddenException('Loan not found or not accessible');
    }

    return this.formatLoan(loan);
  }

  async recordManualPayment(
    loanId: string,
    merchantId: string,
    amount: Decimal,
    reference?: string,
  ) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
    });

    if (!loan || loan.merchantId !== merchantId) {
      throw new ForbiddenException('Loan not found');
    }

    if (loan.status !== 'ACTIVE') {
      throw new BadRequestException('Loan is not active');
    }

    if (amount.lte(0)) {
      throw new BadRequestException('Amount must be positive');
    }

    const actualAmount = amount.greaterThan(loan.remainingBalance)
      ? loan.remainingBalance
      : amount;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let payment = await this.prisma.payment.findUnique({
      where: {
        loanId_date: {
          loanId,
          date: today,
        },
      },
    });

    if (payment) {
      payment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          manualAmount: payment.manualAmount.add(actualAmount),
          amount: payment.amount.add(actualAmount),
          reference,
        },
      });
    } else {
      payment = await this.prisma.payment.create({
        data: {
          loanId,
          date: today,
          amount: actualAmount,
          autoAmount: new Decimal(0),
          manualAmount: actualAmount,
          reference,
        },
      });
    }

    const newBalance = loan.remainingBalance.minus(actualAmount);
    const newStatus = newBalance.lte(0) ? 'PAID' : 'ACTIVE';

    await this.prisma.loan.update({
      where: { id: loanId },
      data: {
        remainingBalance: newBalance.max(0),
        status: newStatus,
        endDate: newStatus === 'PAID' ? new Date() : null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'manual_payment',
        merchantId,
        details: {
          loanId,
          amount: actualAmount.toString(),
          reference,
        },
      },
    });

    return payment;
  }

  private calculatePlan(
    capital: Decimal,
    dailyRevenue: Decimal,
    planDays: number,
  ): PlanOffer {
    const periodRate = this.calculatePeriodRate(planDays);
    const totalToRepay = capital.mul(new Decimal(1).add(periodRate));

    let dailyPercentage = totalToRepay.div(dailyRevenue).div(planDays);

    if (dailyPercentage.greaterThan(this.MAX_DAILY_PERCENTAGE)) {
      dailyPercentage = this.MAX_DAILY_PERCENTAGE;
    }

    const estimatedDays = Math.ceil(
      totalToRepay.div(dailyRevenue.mul(dailyPercentage)).toNumber(),
    );

    return {
      planDays,
      capital: capital.toFixed(2),
      totalToRepay: totalToRepay.toFixed(2),
      periodRate: periodRate.mul(100).toFixed(2),
      dailyPercentage: dailyPercentage.mul(100).toFixed(2),
      estimatedDaysToRepay: estimatedDays,
    };
  }

  private calculatePeriodRate(planDays: number): Decimal {
    return this.TNA.mul(new Decimal(planDays).div(this.DAYS_PER_YEAR));
  }

  private formatLoan(loan: any) {
    const percentPaid = loan.totalToRepay.isZero()
      ? new Decimal(0)
      : loan.totalToRepay
          .minus(loan.remainingBalance)
          .div(loan.totalToRepay)
          .mul(100);

    return {
      id: loan.id,
      capitalAmount: loan.capitalAmount.toFixed(2),
      totalToRepay: loan.totalToRepay.toFixed(2),
      remainingBalance: loan.remainingBalance.toFixed(2),
      planDays: loan.planDays,
      periodRate: loan.periodRate.mul(100).toFixed(2),
      dailyPercentage: loan.dailyPercentage.mul(100).toFixed(2),
      status: loan.status,
      startDate: loan.startDate,
      endDate: loan.endDate,
      percentPaid: percentPaid.toFixed(2),
      payments: loan.payments?.map((p: any) => ({
        date: p.date,
        amount: p.amount.toFixed(2),
        autoAmount: p.autoAmount.toFixed(2),
        manualAmount: p.manualAmount.toFixed(2),
      })),
    };
  }
}