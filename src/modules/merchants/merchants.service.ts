import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TiendanubeService } from '../tiendanube/tiendanube.service';
import { AfipService } from '../tiendanube/afip.service';
import { BcraService } from '../tiendanube/bcra.service';

@Injectable()
export class MerchantsService {
  private readonly logger = new Logger(MerchantsService.name);

  constructor(
    private prisma: PrismaService,
    private tiendanubeService: TiendanubeService,
    private afipService: AfipService,
    private bcraService: BcraService,
  ) {}

  async registerMerchant(data: {
    cuit: string;
    businessName: string;
    email: string;
    phone: string;
    cbu: string;
    brandName?: string;
  }) {
    const existing = await this.prisma.merchant.findUnique({
      where: { cuit: data.cuit },
    });

    if (existing) {
      throw new BadRequestException('CUIT already registered');
    }

    const merchant = await this.prisma.merchant.create({
      data: {
        cuit: data.cuit,
        businessName: data.businessName,
        email: data.email,
        phone: data.phone,
        cbu: data.cbu,
        brandName: data.brandName,
        status: 'pending',
      },
    });

    this.analyzeRiskProfile(merchant.id).catch((err) =>
      this.logger.error(`Risk analysis failed for ${merchant.id}`, err),
    );

    return merchant;
  }

  private async analyzeRiskProfile(merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
    });

    if (!merchant) return;

    try {
      const afipData = await this.afipService.getInfo(merchant.cuit);
      await this.prisma.riskProfile.upsert({
        where: {
          merchantId_source: { merchantId, source: 'AFIP' },
        },
        update: { rawData: afipData },
        create: {
          merchantId,
          source: 'AFIP',
          rawData: afipData,
        },
      });
    } catch (e) {
      this.logger.warn(`AFIP lookup failed for ${merchant.cuit}`);
    }

    try {
      const bcraData = await this.bcraService.getInfo(merchant.cuit);
      await this.prisma.riskProfile.upsert({
        where: {
          merchantId_source: { merchantId, source: 'BCRA' },
        },
        update: { rawData: bcraData },
        create: {
          merchantId,
          source: 'BCRA',
          rawData: bcraData,
        },
      });
    } catch (e) {
      this.logger.warn(`BCRA lookup failed for ${merchant.cuit}`);
    }
  }

  async activateMerchantIfReady(merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
    });

    if (
      merchant?.tiendanubeId &&
      merchant?.monthlyRevenue &&
      merchant.monthlyRevenue.greaterThan(0)
    ) {
      await this.prisma.merchant.update({
        where: { id: merchantId },
        data: { status: 'active' },
      });
    }
  }

  async getMerchantWithOferta(merchantId: string) {
    return this.prisma.merchant.findUnique({
      where: { id: merchantId },
      include: {
        loans: {
          where: { status: 'ACTIVE' },
          take: 1,
        },
        riskProfiles: true,
      },
    });
  }

  getTiendanubeAuthUrl(merchantId: string) {
    return this.tiendanubeService.getOAuthUrl(merchantId);
  }

  async handleTiendanubeCallback(merchantId: string, code: string) {
    const res = await this.tiendanubeService.handleOAuthCallback(
      merchantId,
      code,
    );
    await this.activateMerchantIfReady(merchantId);
    return res;
  }
}