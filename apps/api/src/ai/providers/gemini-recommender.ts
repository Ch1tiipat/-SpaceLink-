import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BookingStatus,
  BoothStatus,
  RecommendationSource,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_RECOMMENDATION_LIMIT } from '../zone-recommender.interface';
import type {
  RecommendedBooth,
  ZoneRecommendationInput,
  ZoneRecommender,
} from '../zone-recommender.interface';

const GEMINI_API_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta/models';
const REQUEST_TIMEOUT_MS = 4000;
const ACTIVE_BOOKING_STATUSES = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.CONFIRMED,
];

type Candidate = {
  boothId: string;
  boothCode: string;
  price: string;
  zoneCode: string;
  zoneName: string | null;
  categories: { id: string; name: string }[];
};

type GeminiResponse = {
  candidates?: {
    content?: {
      parts?: { text?: unknown }[];
    };
  }[];
};

type GeminiRecommendation = {
  boothId?: unknown;
  score?: unknown;
  reason?: unknown;
};

/**
 * Gemini Flash adapter. It sends only public booth/zone/category data and
 * returns the model result without persistence or fallback; the surrounding
 * ZoneRecommendationService owns both.
 */
@Injectable()
export class GeminiZoneRecommender implements ZoneRecommender {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.apiKey = required(config, 'GEMINI_API_KEY');
    this.model = config.get<string>('GEMINI_MODEL') ?? 'gemini-3.5-flash-lite';

    if (!isAllowedModel(this.model)) {
      throw new Error(
        'GEMINI_MODEL must be a Gemini Flash or Flash-Lite model. Pro models are forbidden.',
      );
    }
  }

  async recommend(input: ZoneRecommendationInput): Promise<RecommendedBooth[]> {
    const limit = boundedLimit(input.limit);
    if (limit === 0) return [];

    const candidates = await this.candidateBooths(input.eventId);
    if (candidates.length === 0) return [];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(
        `${GEMINI_API_BASE_URL}/${encodeURIComponent(this.model)}:generateContent`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          body: JSON.stringify(
            requestBody(candidates, input.productCategoryIds, limit),
          ),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new Error(`Gemini returned HTTP ${response.status}`);
      }

      const payload: unknown = await response.json();
      const recommendations = parseResponse(payload);
      const candidateIds = new Set(
        candidates.map((candidate) => candidate.boothId),
      );

      if (
        recommendations.some(
          (recommendation) => !candidateIds.has(recommendation.boothId),
        )
      ) {
        throw new Error('Gemini returned a booth outside the candidate list');
      }

      return dedupe(recommendations).slice(0, limit);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async candidateBooths(eventId: string): Promise<Candidate[]> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { venueId: true },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const booths = await this.prisma.booth.findMany({
      where: {
        zone: { venueId: event.venueId },
        status: BoothStatus.AVAILABLE,
        bookings: {
          none: {
            eventId,
            status: { in: ACTIVE_BOOKING_STATUSES },
          },
        },
      },
      orderBy: [{ zone: { code: 'asc' } }, { code: 'asc' }],
      select: {
        id: true,
        code: true,
        boothPrice: true,
        zone: {
          select: {
            code: true,
            name: true,
            categories: {
              select: {
                category: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    return booths.map((booth) => ({
      boothId: booth.id,
      boothCode: booth.code,
      price: booth.boothPrice.toString(),
      zoneCode: booth.zone.code,
      zoneName: booth.zone.name,
      categories: booth.zone.categories.map(({ category }) => category),
    }));
  }
}

function requestBody(
  candidates: Candidate[],
  productCategoryIds: string[],
  limit: number,
) {
  const prompt = {
    task: 'จัดอันดับบูธที่เหมาะกับร้านค้า คืนเฉพาะบูธจาก candidates และเขียนเหตุผลภาษาไทยที่อ้างอิงโซน หมวดสินค้า ราคา หรือการมองเห็น ห้ามสร้างข้อมูลใหม่',
    vendorCategoryIds: [...new Set(productCategoryIds)],
    limit,
    candidates,
  };

  return {
    contents: [
      {
        role: 'user',
        parts: [{ text: JSON.stringify(prompt) }],
      },
    ],
    generationConfig: {
      maxOutputTokens: 1200,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'ARRAY',
        maxItems: limit,
        items: {
          type: 'OBJECT',
          required: ['boothId', 'score', 'reason'],
          properties: {
            boothId: { type: 'STRING' },
            score: { type: 'NUMBER', minimum: 0, maximum: 100 },
            reason: { type: 'STRING' },
          },
        },
      },
    },
  };
}

function parseResponse(value: unknown): RecommendedBooth[] {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Gemini returned a malformed response');
  }

  const payload = value as GeminiResponse;
  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .find((part): part is string => typeof part === 'string');

  if (!text) {
    throw new Error('Gemini response did not contain JSON text');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Gemini returned invalid JSON');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Gemini response must be an array');
  }

  return parsed.map((value: GeminiRecommendation) => {
    if (
      typeof value !== 'object' ||
      value === null ||
      typeof value.boothId !== 'string' ||
      typeof value.score !== 'number' ||
      !Number.isFinite(value.score) ||
      value.score < 0 ||
      value.score > 100 ||
      typeof value.reason !== 'string' ||
      value.reason.trim().length === 0
    ) {
      throw new Error('Gemini returned a malformed recommendation');
    }

    return {
      boothId: value.boothId,
      score: Math.round(value.score * 100) / 100,
      reason: value.reason.trim(),
      source: RecommendationSource.AI_GEMINI,
    };
  });
}

function dedupe(booths: RecommendedBooth[]): RecommendedBooth[] {
  const seen = new Set<string>();
  return booths.filter((booth) => {
    if (seen.has(booth.boothId)) return false;
    seen.add(booth.boothId);
    return true;
  });
}

function boundedLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_RECOMMENDATION_LIMIT;
  if (!Number.isFinite(limit) || limit <= 0) return 0;
  return Math.floor(limit);
}

function required(config: ConfigService, key: string): string {
  const value = config.get<string>(key);
  if (!value) {
    throw new Error(`${key} is required when ZONE_RECOMMENDER=gemini`);
  }
  return value;
}

function isAllowedModel(model: string): boolean {
  return /^gemini-[a-z0-9.-]*flash(?:-lite)?(?:-[a-z0-9.-]+)?$/i.test(model);
}
