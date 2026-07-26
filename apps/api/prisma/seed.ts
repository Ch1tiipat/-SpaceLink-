import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seeding...');

  const ORG_ID = '11111111-1111-1111-1111-111111111111';
  const VENUE_ID = '22222222-2222-2222-2222-222222222222';
  const ZONE_ID = '33333333-3333-3333-3333-333333333333';
  const EVENT_ID = '44444444-4444-4444-4444-444444444444';
  const USER_ID = '55555555-5555-5555-5555-555555555555';
  const SHOP_ID = '66666666-6666-6666-6666-666666666666';

  // 1. Organization
  const organization = await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: {},
    create: {
      id: ORG_ID,
      name: 'SpaceLink Innovation Corp.',
      description: 'Organizer for futuristic tech and space exhibitions.',
      contactEmail: 'contact@spacelink.com',
    },
  });

  // 2. Venue
  const venue = await prisma.venue.upsert({
    where: { id: VENUE_ID },
    update: {},
    create: {
      id: VENUE_ID,
      organizationId: organization.id,
      name: 'Bangkok Space Convention Center',
      address: '123 Sukhumvit Road, Bangkok, Thailand',
    },
  });

  // 3. Zone
  const zone = await prisma.zone.upsert({
    where: {
      venueId_code: {
        venueId: venue.id,
        code: 'ZONE-A',
      },
    },
    update: {},
    create: {
      id: ZONE_ID,
      venueId: venue.id,
      code: 'ZONE-A',
      name: 'Zone A: Deep Tech & AI',
      defaultBoothPrice: '1500.00',
    },
  });

  // 4. Booth
  await prisma.booth.upsert({
    where: {
      zoneId_code: {
        zoneId: zone.id,
        code: 'A01',
      },
    },
    update: {},
    create: {
      code: 'A01',
      zoneId: zone.id,
      boothPrice: '1500.00',
      status: 'AVAILABLE',
    },
  });

  // 5. Event
  await prisma.event.upsert({
    where: { id: EVENT_ID },
    update: {},
    create: {
      id: EVENT_ID,
      organizationId: organization.id,
      venueId: venue.id,
      name: 'Future Tech Expo 2026',
      startDate: new Date('2026-09-10T09:00:00Z'),
      endDate: new Date('2026-09-12T18:00:00Z'),
    },
  });

  // 6. ProductCategory
  const category = await prisma.productCategory.upsert({
    where: { name: 'Technology & Gadgets' },
    update: {},
    create: {
      name: 'Technology & Gadgets',
      description: 'Hardware, software, and electronic gadgets.',
    },
  });

  // 7. ZoneCategory
  await prisma.zoneCategory.upsert({
    where: {
      zoneId_categoryId: {
        zoneId: zone.id,
        categoryId: category.id,
      },
    },
    update: {},
    create: {
      zoneId: zone.id,
      categoryId: category.id,
    },
  });

  // 8. User
  const user = await prisma.user.upsert({
    where: { email: 'vendor.spacelink@example.com' },
    update: {},
    create: {
      id: USER_ID,
      email: 'vendor.spacelink@example.com',
      authUserId: '00000000-0000-0000-0000-000000000000',
      fullName: 'Space Vendor Mock',
    },
  });

  // 9. Shop (ใช้ owner ตามที่ Schema กำหนด)
  await prisma.shop.upsert({
    where: { id: SHOP_ID },
    update: {},
    create: {
      id: SHOP_ID,
      name: 'Future Innovations Shop',
      owner: {
        connect: { id: user.id },
      },
    },
  });

  console.log('Seeding finished successfully!');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
