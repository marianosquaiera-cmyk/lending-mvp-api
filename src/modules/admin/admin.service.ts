import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboard() {
    const activeLoans = await this.prisma.loan.count({
      where: { status: 'ACTIVE' },
    });
    const totalCapital = await this.prisma.loan.aggregate({
      _sum: { capitalAmount: true },
    });
    const totalRepaid = await this.prisma.payment.aggregate({
      _sum: { amount: true },
    });

    return {
      stats: {
        activeLoans,
        totalCapital: totalCapital._sum.capitalAmount,
        totalRepaid: totalRepaid._sum.amount,
      },
    };
  }

  async getAllLoans(status?: string) {
    return this.prisma.loan.findMany({
      where: status ? { status } : {},
      include: { merchant: true },
    });
  }

  async getAllMerchants(status?: string) {
    return this.prisma.merchant.findMany({
      where: status ? { status } : {},
      include: { loans: true },
    });
  }

  async getStats() {
    const merchantsByStatus = await this.prisma.merchant.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    const loansByStatus = await this.prisma.loan.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    return { merchantsByStatus, loansByStatus };
  }

  async getRecentPayments() {
    return this.prisma.payment.findMany({
      include: {
        loan: {
          include: {
            merchant: true,
          },
        },
      },
      orderBy: { date: 'desc' },
      take: 50,
    });
  }
}