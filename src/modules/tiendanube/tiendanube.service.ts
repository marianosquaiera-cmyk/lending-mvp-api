import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class TiendanubeService {
  private readonly logger = new Logger(TiendanubeService.name);
  private readonly apiBase =
    process.env.TIENDANUBE_API_BASE || 'https://api.tiendanube.com';

  constructor(private prisma: PrismaService) {}

  getOAuthUrl(merchantId: string): string {
    const clientId = process.env.TIENDANUBE_CLIENT_ID;
    const redirectUri = `${process.env.FRONTEND_URL || 'https://example.com'}/integrations/tiendanube/callback`;

    return (
      `https://tiendanube.com/oauth/authorize?` +
      `client_id=${clientId}&` +
      `redirect_uri=${redirectUri}&` +
      `response_type=code&` +
      `state=${merchantId}`
    );
  }

  async handleOAuthCallback(merchantId: string, code: string) {
    try {
      const response = await axios.post(
        'https://tiendanube.com/oauth/access_token',
        {
          client_id: process.env.TIENDANUBE_CLIENT_ID,
          client_secret: process.env.TIENDANUBE_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
        },
      );

      const { access_token, user_id } = response.data;

      await this.prisma.merchant.update({
        where: { id: merchantId },
        data: {
          tiendanubeId: user_id.toString(),
          tiendanubeToken: access_token,
        },
      });

      await this.syncRecentOrders(merchantId, 180);

      return { success: true, tiendanubeId: user_id };
    } catch (error) {
      this.logger.error('OAuth error', error);
      throw new BadRequestException('OAuth error');
    }
  }

  async syncRecentOrders(merchantId: string, daysBack: number = 30) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
    });

    if (!merchant?.tiendanubeToken || !merchant.tiendanubeId) {
      throw new BadRequestException('Tiendanube not connected');
    }

    try {
      const createdAtMin = new Date();
      createdAtMin.setDate(createdAtMin.getDate() - daysBack);

      const response = await axios.get(
        `${this.apiBase}/v1/${merchant.tiendanubeId}/orders`,
        {
          headers: {
            Authorization: `Bearer ${merchant.tiendanubeToken}`,
          },
          params: {
            created_at_min: createdAtMin.toISOString(),
            status: 'closed',
            per_page: 250,
          },
        },
      );

      const orders = response.data.orders || [];
      let processedCount = 0;

      for (const order of orders) {
        const date = new Date(order.created_at);
        date.setHours(0, 0, 0, 0);

        const existing = await this.prisma.dailySales.findUnique({
          where: {
            merchantId_date: {
              merchantId,
              date,
            },
          },
        });

        const totalAmount = new Decimal(order.total || 0);

        if (existing) {
          await this.prisma.dailySales.update({
            where: { id: existing.id },
            data: {
              grossAmount: existing.grossAmount.add(totalAmount),
              ordersCount: (existing.ordersCount || 0) + 1,
            },
          });
        } else {
          await this.prisma.dailySales.create({
            data: {
              merchantId,
              date,
              grossAmount: totalAmount,
              ordersCount: 1,
              source: 'tiendanube',
            },
          });
        }

        processedCount++;
      }

      await this.recalculateMerchantRevenue(merchantId);

      this.logger.log(
        `Synced ${processedCount} orders for merchant ${merchantId}`,
      );

      return { success: true, processedCount };
    } catch (error) {
      this.logger.error(`Sync failed for merchant ${merchantId}`, error);
      throw error;
    }
  }

  async recalculateMerchantRevenue(merchantId: string) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const result = await this.prisma.dailySales.aggregate({
      where: {
        merchantId,
        date: { gte: sixMonthsAgo },
      },
      _sum: { grossAmount: true },
    });

    const sixMonthRevenue = new Decimal(
      result._sum.grossAmount?.toString() || '0',
    );
    const monthlyRevenue = sixMonthRevenue.div(6);
    const dailyRevenue = monthlyRevenue.div(30);

    await this.prisma.merchant.update({
      where: { id: merchantId },
      data: {
        sixMonthRevenue,
        monthlyRevenue,
        dailyRevenue,
        lastSalesSync: new Date(),
      },
    });

    this.logger.log(
      `Revenue updated for merchant ${merchantId}: 6m=${sixMonthRevenue}, monthly=${monthlyRevenue}`,
    );
  }
}

@Injectable()
export class AfipService {
  async getInfo(cuit: string): Promise<any> {
    return {
      cuit,
      status: 'active',
      activity: 'Comercio Electrónico',
      inscriptionDate: '2020-01-15',
      deudaIVA: 0,
      apocrifo: false,
    };
  }
}

@Injectable()
export class BcraService {
  async getInfo(cuit: string): Promise<any> {
    return {
      cuit,
      deudaTotal: 0,
      chequesRechazados: 0,
      situacionCrediticia: 'sin_deuda',
    };
  }
}