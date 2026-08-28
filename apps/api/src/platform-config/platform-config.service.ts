import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePlatformConfigDto } from './dto/update-platform-config.dto';

export const DEFAULT_BILLING_CONFIG = {
  baseFee: '500',
  perZoneRate: '50',
  perDayRate: '100',
  priceMin: '500',
  priceMax: '15000',
} as const;

type StoredBillingConfig = {
  id: string;
  baseFee: Prisma.Decimal;
  perZoneRate: Prisma.Decimal;
  perDayRate: Prisma.Decimal;
  priceMin: Prisma.Decimal;
  priceMax: Prisma.Decimal;
  updatedAt: Date;
};

export type BillingConfigResponse = {
  id: string | null;
  baseFee: string;
  perZoneRate: string;
  perDayRate: string;
  priceMin: string;
  priceMax: string;
  updatedAt: Date | null;
};

@Injectable()
export class PlatformConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async findBillingConfig(): Promise<BillingConfigResponse> {
    const config = await this.prisma.platformConfig.findFirst({
      orderBy: { createdAt: 'asc' },
      select: BILLING_CONFIG_SELECT,
    });

    return config ? serializeConfig(config) : defaultConfigResponse();
  }

  async updateBillingConfig(
    input: UpdatePlatformConfigDto,
  ): Promise<BillingConfigResponse> {
    const current = await this.prisma.platformConfig.findFirst({
      orderBy: { createdAt: 'asc' },
      select: BILLING_CONFIG_SELECT,
    });
    const values = mergeConfig(current, input);

    if (values.priceMin.greaterThan(values.priceMax)) {
      throw new BadRequestException(
        'priceMin must be less than or equal to priceMax',
      );
    }

    const data = {
      baseFee: values.baseFee,
      perZoneRate: values.perZoneRate,
      perDayRate: values.perDayRate,
      priceMin: values.priceMin,
      priceMax: values.priceMax,
    };
    const saved = current
      ? await this.prisma.platformConfig.update({
          where: { id: current.id },
          data,
          select: BILLING_CONFIG_SELECT,
        })
      : await this.prisma.platformConfig.create({
          data,
          select: BILLING_CONFIG_SELECT,
        });

    return serializeConfig(saved);
  }
}

const BILLING_CONFIG_SELECT = {
  id: true,
  baseFee: true,
  perZoneRate: true,
  perDayRate: true,
  priceMin: true,
  priceMax: true,
  updatedAt: true,
} satisfies Prisma.PlatformConfigSelect;

function defaultConfigResponse(): BillingConfigResponse {
  return {
    id: null,
    ...DEFAULT_BILLING_CONFIG,
    updatedAt: null,
  };
}

function mergeConfig(
  current: StoredBillingConfig | null,
  input: UpdatePlatformConfigDto,
) {
  return {
    baseFee: decimal(
      input.baseFee ?? current?.baseFee ?? DEFAULT_BILLING_CONFIG.baseFee,
    ),
    perZoneRate: decimal(
      input.perZoneRate ??
        current?.perZoneRate ??
        DEFAULT_BILLING_CONFIG.perZoneRate,
    ),
    perDayRate: decimal(
      input.perDayRate ??
        current?.perDayRate ??
        DEFAULT_BILLING_CONFIG.perDayRate,
    ),
    priceMin: decimal(
      input.priceMin ?? current?.priceMin ?? DEFAULT_BILLING_CONFIG.priceMin,
    ),
    priceMax: decimal(
      input.priceMax ?? current?.priceMax ?? DEFAULT_BILLING_CONFIG.priceMax,
    ),
  };
}

function decimal(value: string | Prisma.Decimal): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

function serializeConfig(config: StoredBillingConfig): BillingConfigResponse {
  return {
    id: config.id,
    baseFee: config.baseFee.toString(),
    perZoneRate: config.perZoneRate.toString(),
    perDayRate: config.perDayRate.toString(),
    priceMin: config.priceMin.toString(),
    priceMax: config.priceMax.toString(),
    updatedAt: config.updatedAt,
  };
}
