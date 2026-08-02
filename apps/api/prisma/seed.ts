import {
  BookingStatus,
  BoothStatus,
  EventStatus,
  Prisma,
  PrismaClient,
  UserRole,
} from '@prisma/client';

const prisma = new PrismaClient();

type BoothTier = 'S' | 'A' | 'B' | 'C';

type ZoneSeed = {
  id: string;
  code: string;
  name: string;
  description: string;
  posX: string;
  posY: string;
  categoryNames: string[];
};

type OrganizationSeed = {
  id: string;
  configId: string;
  name: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  tierThresholds: Prisma.InputJsonValue;
  tierPrices: Record<BoothTier, string>;
  venue: {
    id: string;
    name: string;
    description: string;
    address: string;
    latitude: string;
    longitude: string;
    zones: ZoneSeed[];
  };
};

type EventSeed = {
  id: string;
  organizationId: string;
  venueId: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  startTime: string;
  endTime: string;
  contactPhone: string;
  contactEmail: string;
  status: EventStatus;
};

const ORIGINAL_ORG_ID = '11111111-1111-1111-1111-111111111111';
const ORIGINAL_VENUE_ID = '22222222-2222-2222-2222-222222222222';
const ORIGINAL_ZONE_ID = '33333333-3333-3333-3333-333333333333';
const ORIGINAL_EVENT_ID = '44444444-4444-4444-4444-444444444444';
const USER_ID = '55555555-5555-5555-5555-555555555555';
const SHOP_ID = '66666666-6666-6666-6666-666666666666';
const PHASE6_VENDOR_B_ID = seedUuid(8, 2);
const PHASE6_VENDOR_C_ID = seedUuid(8, 3);
const PHASE6_VENDOR_A_SHOP_ID = seedUuid(9, 1);
const PHASE6_VENDOR_B_SHOP_ID = seedUuid(9, 2);
const PHASE6_VENDOR_C_SHOP_ONE_ID = seedUuid(9, 3);
const PHASE6_VENDOR_C_SHOP_TWO_ID = seedUuid(9, 4);
const PHASE6_BOOKING_EVENT_ID = seedUuid(10, 1);
const PHASE6_QUOTA_EVENT_ID = seedUuid(10, 2);
const PHASE6_ZONE_ID = seedUuid(11, 1);
const PHASE6_VENDOR_B_BOOKING_ID = seedUuid(13, 1);
const PHASE6_EXPIRED_HOLD_BOOKING_ID = seedUuid(13, 2);

// Independent lookup data. These rows must exist before ZoneCategory links.
const CATEGORY_SEEDS = [
  {
    id: seedUuid(7, 1),
    name: 'Technology & Innovation',
    description: 'เทคโนโลยี ดิจิทัล อุปกรณ์อัจฉริยะ และนวัตกรรม',
    icon: 'cpu',
  },
  {
    id: seedUuid(7, 2),
    name: 'Food & Beverage',
    description: 'อาหาร เครื่องดื่ม ของหวาน และผลิตภัณฑ์แปรรูป',
    icon: 'utensils',
  },
  {
    id: seedUuid(7, 3),
    name: 'Fashion & Textile',
    description: 'เสื้อผ้า เครื่องแต่งกาย ผ้าไหม และสิ่งทอ',
    icon: 'shirt',
  },
  {
    id: seedUuid(7, 4),
    name: 'Agriculture & OTOP',
    description: 'สินค้าเกษตร ต้นไม้ ผลิตภัณฑ์ชุมชน และ OTOP',
    icon: 'sprout',
  },
  {
    id: seedUuid(7, 5),
    name: 'Activities & Services',
    description: 'กิจกรรม เวิร์กช็อป บริการ และพื้นที่ประชาสัมพันธ์',
    icon: 'sparkles',
  },
];

// Multi-tenant demo hierarchy: Organization -> OrgConfig -> Venue -> Zone.
const ORGANIZATION_SEEDS: OrganizationSeed[] = [
  {
    id: ORIGINAL_ORG_ID,
    configId: seedUuid(6, 1),
    name: 'SpaceLink Innovation Corp.',
    description: 'ผู้จัดงานเทคโนโลยี นวัตกรรม และธุรกิจสร้างสรรค์',
    contactEmail: 'bangkok.organizer@example.com',
    contactPhone: '02-000-1001',
    tierThresholds: { S: 6000, A: 3500, B: 1500 },
    tierPrices: { S: '8000.00', A: '5000.00', B: '2500.00', C: '800.00' },
    venue: {
      id: ORIGINAL_VENUE_ID,
      name: 'Bangkok Space Convention Center',
      description: 'ศูนย์จัดแสดงงานเทคโนโลยีและธุรกิจใจกลางกรุงเทพฯ',
      address: '123 ถนนสุขุมวิท เขตวัฒนา กรุงเทพมหานคร 10110',
      latitude: '13.736717',
      longitude: '100.523186',
      zones: [
        {
          id: ORIGINAL_ZONE_ID,
          code: 'ZONE-A',
          name: 'โซนเทคโนโลยีและนวัตกรรม',
          description: 'อุปกรณ์อัจฉริยะ ซอฟต์แวร์ และเทคโนโลยีเกิดใหม่',
          posX: '5.0000',
          posY: '5.0000',
          categoryNames: ['Technology & Innovation', 'Activities & Services'],
        },
        {
          id: seedUuid(3, 2),
          code: 'ZONE-B',
          name: 'โซนอาหารและเครื่องดื่ม',
          description: 'อาหารพร้อมรับประทาน คาเฟ่ และของหวาน',
          posX: '55.0000',
          posY: '5.0000',
          categoryNames: ['Food & Beverage', 'Agriculture & OTOP'],
        },
        {
          id: seedUuid(3, 3),
          code: 'ZONE-C',
          name: 'โซนแฟชั่นและไลฟ์สไตล์',
          description: 'เสื้อผ้า เครื่องประดับ และสินค้าออกแบบ',
          posX: '5.0000',
          posY: '55.0000',
          categoryNames: ['Fashion & Textile', 'Technology & Innovation'],
        },
        {
          id: seedUuid(3, 4),
          code: 'ZONE-D',
          name: 'โซนกิจกรรมและเวิร์กช็อป',
          description: 'สาธิตสินค้า เวทีเสวนา และกิจกรรมทดลองใช้',
          posX: '55.0000',
          posY: '55.0000',
          categoryNames: [
            'Activities & Services',
            'Technology & Innovation',
            'Food & Beverage',
          ],
        },
      ],
    },
  },
  {
    id: seedUuid(1, 2),
    configId: seedUuid(6, 2),
    name: 'SUT Agri Fair Organization',
    description: 'ผู้จัดงานเกษตรและนวัตกรรม มหาวิทยาลัยเทคโนโลยีสุรนารี',
    contactEmail: 'agri.organizer@example.com',
    contactPhone: '044-000-2002',
    tierThresholds: { S: 5000, A: 2500, B: 1000 },
    tierPrices: { S: '6500.00', A: '3500.00', B: '1500.00', C: '500.00' },
    venue: {
      id: seedUuid(2, 2),
      name: 'ลานจัดงานเกษตร มหาวิทยาลัยเทคโนโลยีสุรนารี',
      description: 'พื้นที่จัดงานกลางแจ้งสำหรับสินค้าเกษตรและ OTOP',
      address:
        '111 ถนนมหาวิทยาลัย ตำบลสุรนารี อำเภอเมืองนครราชสีมา จังหวัดนครราชสีมา 30000',
      latitude: '14.881800',
      longitude: '102.018600',
      zones: [
        {
          id: seedUuid(3, 5),
          code: 'ZONE-A',
          name: 'โซนอาหาร',
          description: 'อาหารพื้นถิ่น อาหารพร้อมรับประทาน และของฝาก',
          posX: '5.0000',
          posY: '5.0000',
          categoryNames: ['Food & Beverage', 'Agriculture & OTOP'],
        },
        {
          id: seedUuid(3, 6),
          code: 'ZONE-B',
          name: 'โซนเครื่องดื่มและของหวาน',
          description: 'เครื่องดื่ม กาแฟ เบเกอรี และของหวาน',
          posX: '55.0000',
          posY: '5.0000',
          categoryNames: ['Food & Beverage'],
        },
        {
          id: seedUuid(3, 7),
          code: 'ZONE-C',
          name: 'โซนสินค้าเกษตร',
          description: 'ต้นไม้ อุปกรณ์เกษตร ผลผลิต และสินค้าแปรรูป',
          posX: '5.0000',
          posY: '55.0000',
          categoryNames: ['Agriculture & OTOP', 'Technology & Innovation'],
        },
        {
          id: seedUuid(3, 8),
          code: 'ZONE-D',
          name: 'โซนผ้าไหมและ OTOP',
          description: 'ผ้าไหมปักธงชัย งานหัตถกรรม และสินค้าชุมชน',
          posX: '55.0000',
          posY: '55.0000',
          categoryNames: [
            'Fashion & Textile',
            'Agriculture & OTOP',
            'Activities & Services',
          ],
        },
      ],
    },
  },
  {
    id: seedUuid(1, 3),
    configId: seedUuid(6, 3),
    name: 'Chiang Mai Creative Economy',
    description: 'ผู้จัดงานหัตถกรรม การออกแบบ และเศรษฐกิจสร้างสรรค์เชียงใหม่',
    contactEmail: 'chiangmai.organizer@example.com',
    contactPhone: '053-000-3003',
    tierThresholds: { S: 7000, A: 4000, B: 2000 },
    tierPrices: { S: '8000.00', A: '5000.00', B: '2500.00', C: '700.00' },
    venue: {
      id: seedUuid(2, 3),
      name: 'Chiang Mai Creative Hall',
      description: 'พื้นที่แสดงงานออกแบบ หัตถกรรม และวัฒนธรรมร่วมสมัย',
      address: '45 ถนนนิมมานเหมินท์ อำเภอเมืองเชียงใหม่ จังหวัดเชียงใหม่ 50200',
      latitude: '18.796143',
      longitude: '98.979263',
      zones: [
        {
          id: seedUuid(3, 9),
          code: 'ZONE-A',
          name: 'โซนกาแฟและอาหารเหนือ',
          description: 'กาแฟท้องถิ่น อาหารเหนือ และผลิตภัณฑ์แปรรูป',
          posX: '5.0000',
          posY: '5.0000',
          categoryNames: ['Food & Beverage', 'Agriculture & OTOP'],
        },
        {
          id: seedUuid(3, 10),
          code: 'ZONE-B',
          name: 'โซนหัตถกรรมและ OTOP',
          description: 'งานไม้ เซรามิก ของตกแต่ง และสินค้าชุมชน',
          posX: '55.0000',
          posY: '5.0000',
          categoryNames: ['Agriculture & OTOP', 'Activities & Services'],
        },
        {
          id: seedUuid(3, 11),
          code: 'ZONE-C',
          name: 'โซนแฟชั่นและสิ่งทอ',
          description: 'ผ้าทอ เสื้อผ้า เครื่องประดับ และงานออกแบบ',
          posX: '5.0000',
          posY: '55.0000',
          categoryNames: ['Fashion & Textile', 'Agriculture & OTOP'],
        },
        {
          id: seedUuid(3, 12),
          code: 'ZONE-D',
          name: 'โซนสร้างสรรค์และเวิร์กช็อป',
          description: 'เวิร์กช็อป ศิลปะ เทคโนโลยี และกิจกรรมครอบครัว',
          posX: '55.0000',
          posY: '55.0000',
          categoryNames: [
            'Activities & Services',
            'Technology & Innovation',
            'Fashion & Textile',
          ],
        },
      ],
    },
  },
];

// Events cover every status needed to verify the public discovery rules.
const EVENT_SEEDS: EventSeed[] = [
  {
    id: ORIGINAL_EVENT_ID,
    organizationId: ORIGINAL_ORG_ID,
    venueId: ORIGINAL_VENUE_ID,
    name: 'Future Tech Expo 2026',
    description: 'งานแสดงเทคโนโลยี ธุรกิจดิจิทัล และนวัตกรรมแห่งอนาคต',
    startDate: new Date('2026-09-10T00:00:00.000Z'),
    endDate: new Date('2026-09-12T00:00:00.000Z'),
    startTime: '09:00',
    endTime: '20:00',
    contactPhone: '02-000-1001',
    contactEmail: 'futuretech@example.com',
    status: EventStatus.PUBLISHED,
  },
  {
    id: seedUuid(5, 2),
    organizationId: seedUuid(1, 2),
    venueId: seedUuid(2, 2),
    name: 'งานเกษตร มทส. 2569',
    description: 'งานเกษตร อาหาร นวัตกรรม ผ้าไหมปักธงชัย และสินค้า OTOP',
    startDate: new Date('2026-07-25T00:00:00.000Z'),
    endDate: new Date('2026-08-02T00:00:00.000Z'),
    startTime: '08:00',
    endTime: '21:00',
    contactPhone: '044-000-2002',
    contactEmail: 'sutfair@example.com',
    status: EventStatus.ONGOING,
  },
  {
    id: seedUuid(5, 3),
    organizationId: seedUuid(1, 3),
    venueId: seedUuid(2, 3),
    name: 'Chiang Mai Craft & Design Week',
    description: 'งานหัตถกรรม แฟชั่น สิ่งทอ และกิจกรรมสร้างสรรค์เชียงใหม่',
    startDate: new Date('2026-11-14T00:00:00.000Z'),
    endDate: new Date('2026-11-20T00:00:00.000Z'),
    startTime: '10:00',
    endTime: '20:00',
    contactPhone: '053-000-3003',
    contactEmail: 'craftweek@example.com',
    status: EventStatus.DRAFT,
  },
  {
    id: seedUuid(5, 4),
    organizationId: ORIGINAL_ORG_ID,
    venueId: ORIGINAL_VENUE_ID,
    name: 'Bangkok Future Retail Expo 2025',
    description: 'งานค้าปลีก เทคโนโลยีหน้าร้าน และธุรกิจบริการ',
    startDate: new Date('2025-11-05T00:00:00.000Z'),
    endDate: new Date('2025-11-07T00:00:00.000Z'),
    startTime: '09:00',
    endTime: '18:00',
    contactPhone: '02-000-1001',
    contactEmail: 'retail2025@example.com',
    status: EventStatus.COMPLETED,
  },
];

// Each organization receives all four price tiers across its four zones.
const TIER_ROTATIONS: BoothTier[][] = [
  ['S', 'A', 'B'],
  ['C', 'S', 'A'],
  ['B', 'C', 'S'],
  ['A', 'B', 'C'],
];

const BOOTH_STATUSES = [
  BoothStatus.AVAILABLE,
  BoothStatus.BOOKED,
  BoothStatus.MAINTENANCE,
  BoothStatus.INACTIVE,
];

async function main(): Promise<void> {
  console.log('Seeding SpaceLink multi-organization demo data...');

  // 1. Product categories are independent and safe to seed first.
  const categoryIds = new Map<string, string>();

  for (const categorySeed of CATEGORY_SEEDS) {
    const category = await prisma.productCategory.upsert({
      where: { name: categorySeed.name },
      update: {
        description: categorySeed.description,
        icon: categorySeed.icon,
      },
      create: categorySeed,
    });

    categoryIds.set(category.name, category.id);
  }

  let boothSequence = 1;

  // 2. Seed each organization in foreign-key order.
  for (const [
    organizationIndex,
    organizationSeed,
  ] of ORGANIZATION_SEEDS.entries()) {
    const organization = await prisma.organization.upsert({
      where: { id: organizationSeed.id },
      update: {
        name: organizationSeed.name,
        description: organizationSeed.description,
        contactEmail: organizationSeed.contactEmail,
        contactPhone: organizationSeed.contactPhone,
      },
      create: {
        id: organizationSeed.id,
        name: organizationSeed.name,
        description: organizationSeed.description,
        contactEmail: organizationSeed.contactEmail,
        contactPhone: organizationSeed.contactPhone,
      },
    });

    await prisma.orgConfig.upsert({
      where: { organizationId: organization.id },
      update: {
        boothLimitPerVendor: 2 + organizationIndex,
        bookingQuotaPerVendor: 3 + organizationIndex,
        tierThresholds: organizationSeed.tierThresholds,
      },
      create: {
        id: organizationSeed.configId,
        organizationId: organization.id,
        boothLimitPerVendor: 2 + organizationIndex,
        bookingQuotaPerVendor: 3 + organizationIndex,
        tierThresholds: organizationSeed.tierThresholds,
      },
    });

    const venueSeed = organizationSeed.venue;
    const venue = await prisma.venue.upsert({
      where: { id: venueSeed.id },
      update: {
        organizationId: organization.id,
        name: venueSeed.name,
        description: venueSeed.description,
        address: venueSeed.address,
        latitude: venueSeed.latitude,
        longitude: venueSeed.longitude,
      },
      create: {
        id: venueSeed.id,
        organizationId: organization.id,
        name: venueSeed.name,
        description: venueSeed.description,
        address: venueSeed.address,
        latitude: venueSeed.latitude,
        longitude: venueSeed.longitude,
      },
    });

    for (const [zoneIndex, zoneSeed] of venueSeed.zones.entries()) {
      const zone = await prisma.zone.upsert({
        where: {
          venueId_code: {
            venueId: venue.id,
            code: zoneSeed.code,
          },
        },
        update: {
          name: zoneSeed.name,
          description: zoneSeed.description,
          defaultBoothPrice: organizationSeed.tierPrices.B,
          posX: zoneSeed.posX,
          posY: zoneSeed.posY,
        },
        create: {
          id: zoneSeed.id,
          venueId: venue.id,
          code: zoneSeed.code,
          name: zoneSeed.name,
          description: zoneSeed.description,
          defaultBoothPrice: organizationSeed.tierPrices.B,
          posX: zoneSeed.posX,
          posY: zoneSeed.posY,
        },
      });

      for (const categoryName of zoneSeed.categoryNames) {
        const categoryId = categoryIds.get(categoryName);
        if (!categoryId) {
          throw new Error(`Missing seeded category: ${categoryName}`);
        }

        await prisma.zoneCategory.upsert({
          where: {
            zoneId_categoryId: {
              zoneId: zone.id,
              categoryId,
            },
          },
          update: {},
          create: {
            zoneId: zone.id,
            categoryId,
          },
        });
      }

      for (const [boothIndex, tier] of TIER_ROTATIONS[zoneIndex].entries()) {
        const boothCode = `${String.fromCharCode(65 + zoneIndex)}0${boothIndex + 1}`;
        const boothStatus =
          BOOTH_STATUSES[
            (organizationIndex * 12 + zoneIndex * 3 + boothIndex) %
              BOOTH_STATUSES.length
          ];

        await prisma.booth.upsert({
          where: {
            zoneId_code: {
              zoneId: zone.id,
              code: boothCode,
            },
          },
          update: {
            boothPrice: organizationSeed.tierPrices[tier],
            widthM: '3.00',
            heightM: '3.00',
            posX: `${10 + boothIndex * 30}.0000`,
            posY: '20.0000',
            facilities: {
              electricity: true,
              water: boothIndex === 0,
              corner: boothIndex === 2,
            },
            status: boothStatus,
          },
          create: {
            id: seedUuid(4, boothSequence),
            zoneId: zone.id,
            code: boothCode,
            boothPrice: organizationSeed.tierPrices[tier],
            widthM: '3.00',
            heightM: '3.00',
            posX: `${10 + boothIndex * 30}.0000`,
            posY: '20.0000',
            facilities: {
              electricity: true,
              water: boothIndex === 0,
              corner: boothIndex === 2,
            },
            status: boothStatus,
          },
        });

        boothSequence += 1;
      }
    }
  }

  // 3. Events depend on organizations and venues created above.
  for (const eventSeed of EVENT_SEEDS) {
    await prisma.event.upsert({
      where: { id: eventSeed.id },
      update: {
        organizationId: eventSeed.organizationId,
        venueId: eventSeed.venueId,
        name: eventSeed.name,
        description: eventSeed.description,
        startDate: eventSeed.startDate,
        endDate: eventSeed.endDate,
        startTime: eventSeed.startTime,
        endTime: eventSeed.endTime,
        contactPhone: eventSeed.contactPhone,
        contactEmail: eventSeed.contactEmail,
        status: eventSeed.status,
      },
      create: eventSeed,
    });
  }

  // 4. Preserve the original demo vendor and shop as idempotent fixtures.
  const user = await prisma.user.upsert({
    where: { email: 'vendor.spacelink@example.com' },
    update: {
      fullName: 'SpaceLink Demo Vendor',
      phone: '099-000-9000',
    },
    create: {
      id: USER_ID,
      email: 'vendor.spacelink@example.com',
      authUserId: '00000000-0000-0000-0000-000000000000',
      fullName: 'SpaceLink Demo Vendor',
      phone: '099-000-9000',
    },
  });

  await prisma.shop.upsert({
    where: { id: SHOP_ID },
    update: {
      name: 'Future Innovations Shop',
      ownerUserId: user.id,
    },
    create: {
      id: SHOP_ID,
      name: 'Future Innovations Shop',
      ownerUserId: user.id,
    },
  });

  const phase6FixtureSummary = await seedPhase6Fixtures();

  console.log(
    `Seeding finished: ${ORGANIZATION_SEEDS.length} organizations, ` +
      `${ORGANIZATION_SEEDS.length} venues, ` +
      `${ORGANIZATION_SEEDS.reduce((total, seed) => total + seed.venue.zones.length, 0)} zones, ` +
      `${boothSequence - 1} booths, ${CATEGORY_SEEDS.length} categories, ` +
      `${EVENT_SEEDS.length} events.`,
  );
  console.log(
    `Phase 6 fixtures: ${phase6FixtureSummary.vendors} vendors, ` +
      `${phase6FixtureSummary.shops} shops, ` +
      `${phase6FixtureSummary.events} events, ` +
      `${phase6FixtureSummary.booths} booths, ` +
      `${phase6FixtureSummary.bookings} bookings.`,
  );
}

async function seedPhase6Fixtures(): Promise<{
  vendors: number;
  shops: number;
  events: number;
  booths: number;
  bookings: number;
}> {
  const vendorAUserId = process.env.PHASE6_VENDOR_A_USER_ID?.trim();
  if (!vendorAUserId) {
    throw new Error(
      'PHASE6_VENDOR_A_USER_ID is required to attach test shops safely.',
    );
  }

  const vendorA = await prisma.user.findFirst({
    where: { id: vendorAUserId, role: UserRole.VENDOR },
    select: { id: true },
  });
  if (!vendorA) {
    throw new Error(
      'PHASE6_VENDOR_A_USER_ID must identify an existing vendor.',
    );
  }

  const vendorB = await prisma.user.upsert({
    where: { id: PHASE6_VENDOR_B_ID },
    update: {
      fullName: 'Phase 6 Vendor B',
      role: UserRole.VENDOR,
    },
    create: {
      id: PHASE6_VENDOR_B_ID,
      authUserId: seedUuid(14, 2),
      email: 'phase6.vendor-b@example.com',
      fullName: 'Phase 6 Vendor B',
      role: UserRole.VENDOR,
    },
  });

  const vendorC = await prisma.user.upsert({
    where: { id: PHASE6_VENDOR_C_ID },
    update: {
      fullName: 'Phase 6 Vendor C',
      role: UserRole.VENDOR,
    },
    create: {
      id: PHASE6_VENDOR_C_ID,
      authUserId: seedUuid(14, 3),
      email: 'phase6.vendor-c@example.com',
      fullName: 'Phase 6 Vendor C',
      role: UserRole.VENDOR,
    },
  });

  const shopSeeds = [
    {
      id: PHASE6_VENDOR_A_SHOP_ID,
      ownerUserId: vendorA.id,
      name: 'Phase 6 Vendor A Shop',
    },
    {
      id: PHASE6_VENDOR_B_SHOP_ID,
      ownerUserId: vendorB.id,
      name: 'Phase 6 Vendor B Shop',
    },
    {
      id: PHASE6_VENDOR_C_SHOP_ONE_ID,
      ownerUserId: vendorC.id,
      name: 'Phase 6 Vendor C Shop One',
    },
    {
      id: PHASE6_VENDOR_C_SHOP_TWO_ID,
      ownerUserId: vendorC.id,
      name: 'Phase 6 Vendor C Shop Two',
    },
  ];

  for (const shopSeed of shopSeeds) {
    await prisma.shop.upsert({
      where: { id: shopSeed.id },
      update: {
        ownerUserId: shopSeed.ownerUserId,
        name: shopSeed.name,
      },
      create: shopSeed,
    });
  }

  const phase6Events = [
    {
      id: PHASE6_BOOKING_EVENT_ID,
      name: 'Phase 6 Booking Flow Event',
      description: 'Deterministic event for SCRUM-24 booking flow tests',
      startDate: new Date('2026-09-20T00:00:00.000Z'),
      endDate: new Date('2026-09-22T00:00:00.000Z'),
    },
    {
      id: PHASE6_QUOTA_EVENT_ID,
      name: 'Phase 6 Booking Quota Event',
      description: 'Deterministic event for SCRUM-24 quota tests',
      startDate: new Date('2026-10-01T00:00:00.000Z'),
      endDate: new Date('2026-10-03T00:00:00.000Z'),
    },
  ];

  for (const eventSeed of phase6Events) {
    await prisma.event.upsert({
      where: { id: eventSeed.id },
      update: {
        organizationId: ORIGINAL_ORG_ID,
        venueId: ORIGINAL_VENUE_ID,
        name: eventSeed.name,
        description: eventSeed.description,
        startDate: eventSeed.startDate,
        endDate: eventSeed.endDate,
        startTime: '09:00',
        endTime: '18:00',
        contactEmail: 'phase6.organizer@example.com',
        status: EventStatus.PUBLISHED,
      },
      create: {
        ...eventSeed,
        organizationId: ORIGINAL_ORG_ID,
        venueId: ORIGINAL_VENUE_ID,
        startTime: '09:00',
        endTime: '18:00',
        contactEmail: 'phase6.organizer@example.com',
        status: EventStatus.PUBLISHED,
      },
    });
  }

  const phase6Zone = await prisma.zone.upsert({
    where: {
      venueId_code: {
        venueId: ORIGINAL_VENUE_ID,
        code: 'PHASE6',
      },
    },
    update: {
      name: 'Phase 6 Test Zone',
      description: 'Dedicated zone for SCRUM-24 Phase 6 fixtures',
      defaultBoothPrice: '100.00',
      posX: '5.0000',
      posY: '85.0000',
    },
    create: {
      id: PHASE6_ZONE_ID,
      venueId: ORIGINAL_VENUE_ID,
      code: 'PHASE6',
      name: 'Phase 6 Test Zone',
      description: 'Dedicated zone for SCRUM-24 Phase 6 fixtures',
      defaultBoothPrice: '100.00',
      posX: '5.0000',
      posY: '85.0000',
    },
  });

  const phase6Booths = [];
  for (let sequence = 1; sequence <= 6; sequence += 1) {
    const code = `P6${sequence.toString().padStart(2, '0')}`;
    const booth = await prisma.booth.upsert({
      where: {
        zoneId_code: {
          zoneId: phase6Zone.id,
          code,
        },
      },
      update: {
        boothPrice: '100.00',
        widthM: '3.00',
        heightM: '3.00',
        posX: `${5 + (sequence - 1) * 15}.0000`,
        posY: '20.0000',
        facilities: { phase6Fixture: true },
        status: BoothStatus.AVAILABLE,
      },
      create: {
        id: seedUuid(12, sequence),
        zoneId: phase6Zone.id,
        code,
        boothPrice: '100.00',
        widthM: '3.00',
        heightM: '3.00',
        posX: `${5 + (sequence - 1) * 15}.0000`,
        posY: '20.0000',
        facilities: { phase6Fixture: true },
        status: BoothStatus.AVAILABLE,
      },
    });
    phase6Booths.push(booth);
  }

  const now = new Date();
  await prisma.booking.upsert({
    where: { id: PHASE6_VENDOR_B_BOOKING_ID },
    update: {
      eventId: PHASE6_BOOKING_EVENT_ID,
      boothId: phase6Booths[1].id,
      shopId: PHASE6_VENDOR_B_SHOP_ID,
      vendorUserId: vendorB.id,
      bookingStartDate: phase6Events[0].startDate,
      bookingEndDate: phase6Events[0].endDate,
      boothPrice: phase6Booths[1].boothPrice,
      status: BookingStatus.CONFIRMED,
      holdExpiresAt: null,
      confirmedAt: now,
      cancelledByUserId: null,
      cancelledByRole: null,
      cancelReason: null,
      cancelledAt: null,
    },
    create: {
      id: PHASE6_VENDOR_B_BOOKING_ID,
      bookingCode: 'P6-VENDOR-B-ACTIVE',
      eventId: PHASE6_BOOKING_EVENT_ID,
      boothId: phase6Booths[1].id,
      shopId: PHASE6_VENDOR_B_SHOP_ID,
      vendorUserId: vendorB.id,
      bookingStartDate: phase6Events[0].startDate,
      bookingEndDate: phase6Events[0].endDate,
      boothPrice: phase6Booths[1].boothPrice,
      status: BookingStatus.CONFIRMED,
      confirmedAt: now,
    },
  });

  await prisma.booking.upsert({
    where: { id: PHASE6_EXPIRED_HOLD_BOOKING_ID },
    update: {
      eventId: PHASE6_BOOKING_EVENT_ID,
      boothId: phase6Booths[2].id,
      shopId: PHASE6_VENDOR_A_SHOP_ID,
      vendorUserId: vendorA.id,
      bookingStartDate: phase6Events[0].startDate,
      bookingEndDate: phase6Events[0].endDate,
      boothPrice: phase6Booths[2].boothPrice,
      status: BookingStatus.PENDING_PAYMENT,
      holdExpiresAt: new Date(now.getTime() - 60_000),
      confirmedAt: null,
      cancelledByUserId: null,
      cancelledByRole: null,
      cancelReason: null,
      cancelledAt: null,
    },
    create: {
      id: PHASE6_EXPIRED_HOLD_BOOKING_ID,
      bookingCode: 'P6-EXPIRED-HOLD',
      eventId: PHASE6_BOOKING_EVENT_ID,
      boothId: phase6Booths[2].id,
      shopId: PHASE6_VENDOR_A_SHOP_ID,
      vendorUserId: vendorA.id,
      bookingStartDate: phase6Events[0].startDate,
      bookingEndDate: phase6Events[0].endDate,
      boothPrice: phase6Booths[2].boothPrice,
      status: BookingStatus.PENDING_PAYMENT,
      holdExpiresAt: new Date(now.getTime() - 60_000),
    },
  });

  for (let sequence = 0; sequence < 3; sequence += 1) {
    await prisma.booking.upsert({
      where: { id: seedUuid(13, sequence + 3) },
      update: {
        eventId: PHASE6_QUOTA_EVENT_ID,
        boothId: phase6Booths[sequence].id,
        shopId: PHASE6_VENDOR_A_SHOP_ID,
        vendorUserId: vendorA.id,
        bookingStartDate: phase6Events[1].startDate,
        bookingEndDate: phase6Events[1].endDate,
        boothPrice: phase6Booths[sequence].boothPrice,
        status: BookingStatus.CONFIRMED,
        holdExpiresAt: null,
        confirmedAt: now,
        cancelledByUserId: null,
        cancelledByRole: null,
        cancelReason: null,
        cancelledAt: null,
      },
      create: {
        id: seedUuid(13, sequence + 3),
        bookingCode: `P6-QUOTA-${sequence + 1}`,
        eventId: PHASE6_QUOTA_EVENT_ID,
        boothId: phase6Booths[sequence].id,
        shopId: PHASE6_VENDOR_A_SHOP_ID,
        vendorUserId: vendorA.id,
        bookingStartDate: phase6Events[1].startDate,
        bookingEndDate: phase6Events[1].endDate,
        boothPrice: phase6Booths[sequence].boothPrice,
        status: BookingStatus.CONFIRMED,
        confirmedAt: now,
      },
    });
  }

  return {
    vendors: 3,
    shops: shopSeeds.length,
    events: phase6Events.length,
    booths: phase6Booths.length,
    bookings: 5,
  };
}

function seedUuid(entityGroup: number, sequence: number): string {
  const group = entityGroup.toString().padStart(8, '0');
  const suffix = sequence.toString().padStart(12, '0');
  return `${group}-0000-4000-8000-${suffix}`;
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
