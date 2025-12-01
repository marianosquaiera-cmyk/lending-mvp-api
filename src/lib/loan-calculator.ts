import { Decimal } from '@prisma/client/runtime/library';

export class LoanCalculator {
  static readonly MAX_LOAN_CAPITAL = new Decimal(10_000_000);
  static readonly LOAN_PERCENTAGE = new Decimal(0.30);
  static readonly TNA = new Decimal(0.80);
  static readonly MAX_DAILY_PERCENTAGE = new Decimal(0.10);
  static readonly DAYS_PER_YEAR = 365;

  static calculateMonthlyRevenue(sixMonthRevenue: Decimal): Decimal {
    return sixMonthRevenue.div(6);
  }

  static calculateDailyRevenue(monthlyRevenue: Decimal): Decimal {
    return monthlyRevenue.div(30);
  }

  static calculateMaxCapital(monthlyRevenue: Decimal): Decimal {
    const capitalBruto = monthlyRevenue.mul(this.LOAN_PERCENTAGE);
    return capitalBruto.greaterThan(this.MAX_LOAN_CAPITAL)
      ? this.MAX_LOAN_CAPITAL
      : capitalBruto;
  }

  static calculatePeriodRate(planDays: number): Decimal {
    return this.TNA.mul(new Decimal(planDays).div(this.DAYS_PER_YEAR));
  }

  static calculateTotalToRepay(capital: Decimal, planDays: number): Decimal {
    const periodRate = this.calculatePeriodRate(planDays);
    return capital.mul(new Decimal(1).add(periodRate));
  }

  static calculateDailyPercentage(
    totalToRepay: Decimal,
    dailyRevenue: Decimal,
    planDays: number,
  ): Decimal {
    if (dailyRevenue.isZero()) {
      return this.MAX_DAILY_PERCENTAGE;
    }

    let dailyPercentage = totalToRepay
      .div(dailyRevenue)
      .div(new Decimal(planDays));

    if (dailyPercentage.greaterThan(this.MAX_DAILY_PERCENTAGE)) {
      dailyPercentage = this.MAX_DAILY_PERCENTAGE;
    }

    return dailyPercentage;
  }

  static calculateAutoPayment(
    dailySales: Decimal,
    dailyPercentage: Decimal,
  ): Decimal {
    return dailySales.mul(dailyPercentage);
  }

  static estimateDaysToRepay(
    totalToRepay: Decimal,
    dailyRevenue: Decimal,
    dailyPercentage: Decimal,
  ): number {
    if (dailyRevenue.isZero() || dailyPercentage.isZero()) {
      return 999;
    }

    const dailyRepayment = dailyRevenue.mul(dailyPercentage);
    const daysToRepay = totalToRepay.div(dailyRepayment);

    return Math.ceil(daysToRepay.toNumber());
  }

  static calculateRepaymentProgress(
    amountRepaid: Decimal,
    totalToRepay: Decimal,
  ): Decimal {
    if (totalToRepay.isZero()) {
      return new Decimal(0);
    }

    return amountRepaid.div(totalToRepay).mul(100);
  }

  static isValidLoanAmount(amount: Decimal, maxCapital: Decimal): boolean {
    return amount.greaterThan(0) && amount.lessThanOrEqualTo(maxCapital);
  }

  static isValidPlanDays(planDays: number): boolean {
    return [120, 180].includes(planDays);
  }
}

export class LoanValidator {
  static canRequestLoan(
    merchantStatus: string,
    monthlyRevenue: Decimal | null,
    hasActiveLoan: boolean,
  ): { valid: boolean; reason?: string } {
    if (merchantStatus !== 'active') {
      return { valid: false, reason: 'Merchant is not active' };
    }

    if (!monthlyRevenue || monthlyRevenue.isZero()) {
      return { valid: false, reason: 'No sales data. Connect Tiendanube.' };
    }

    if (hasActiveLoan) {
      return {
        valid: false,
        reason: 'Merchant already has an active loan',
      };
    }

    return { valid: true };
  }

  static isValidEmail(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  static isValidCuit(cuit: string): boolean {
    const cleaned = cuit.replace(/[^0-9]/g, '');
    return cleaned.length === 11;
  }

  static isValidCbu(cbu: string): boolean {
    const cleaned = cbu.replace(/[^0-9]/g, '');
    return cleaned.length === 22;
  }
}

export class LoanFormatter {
  static formatARS(amount: Decimal | string | number): string {
    const num =
      typeof amount === 'string'
        ? parseFloat(amount)
        : amount instanceof Decimal
        ? amount.toNumber()
        : amount;

    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  }

  static formatPercentage(value: Decimal | number, decimals: number = 2): string {
    const num = typeof value === 'number' ? value : value.toNumber();
    return `${num.toFixed(decimals)}%`;
  }
}

export const LoanMessages = {
  MERCHANT_NOT_FOUND: 'Comercio no encontrado',
  MERCHANT_NOT_ACTIVE: 'Comercio no está activo',
  NO_SALES_DATA: 'Sin historial de ventas. Conecta tu Tiendanube.',
  LOAN_NOT_FOUND: 'Préstamo no encontrado',
  ACTIVE_LOAN_EXISTS: 'Ya tienes un préstamo activo',
  INVALID_AMOUNT: 'Monto inválido',
  AMOUNT_EXCEEDS_MAX: 'El monto supera el máximo permitido',
  INVALID_PLAN: 'Plan debe ser 120 o 180 días',
};