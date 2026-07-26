import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed script — STRUCTURE ONLY. It inserts nothing yet.
 *
 * No Supabase project exists and no migration has ever been run (AGENTS.md
 * §12), so there are no tables to write into. This file exists now so the
 * ordering decision below is made once, in the repository, rather than
 * rediscovered by whoever writes the first row against a live database.
 *
 * Run with `npm run db:seed`.
 *
 * ---------------------------------------------------------------------------
 * INSERT ORDER — foreign-key safe. Do not reorder.
 * ---------------------------------------------------------------------------
 *
 *   1. Organization    no FK of its own — the root of the ownership chain
 *   2. Venue           -> Organization
 *   3. Zone            -> Venue
 *   4. Booth           -> Zone                     the bookable unit, e.g. A01
 *   5. Event           -> Organization AND Venue   both must already exist
 *   6. ProductCategory no FK of its own
 *   7. ZoneCategory    -> Zone AND ProductCategory join table, so it goes last
 *                                                  of the venue-side rows
 *   8. User            no FK of its own
 *   9. Shop            -> User
 *
 * Steps 1-7 build the venue side, steps 8-9 the vendor side. `Booking` is
 * deliberately absent: it is the only row that both sides point at, and seeding
 * one would have to satisfy every invariant in AGENTS.md §6.3 by hand. Seed the
 * fixtures a booking needs; let the API create the booking.
 *
 * ---------------------------------------------------------------------------
 * EVERY WRITE IS AN `upsert`, so the script is safe to re-run.
 * ---------------------------------------------------------------------------
 *
 * `create` would fail on the second run; `deleteMany` first would cascade
 * through real bookings. `upsert` needs a stable key to match on, and most of
 * these models have no natural unique column — so seeded rows use hard-coded
 * UUID constants rather than `@default(uuid())`. A generated id would be
 * different on every run and every teammate's machine, which is exactly what
 * upsert cannot work with.
 *
 * The shape each step follows:
 *
 *     await prisma.venue.upsert({
 *       where: { id: VENUE_ID },              // fixed constant, never generated
 *       update: {},                           // empty: never clobber edited data
 *       create: { id: VENUE_ID, organizationId: ORG_ID, name: '...' },
 *     });
 *
 * Where a model does have a natural key, prefer it over a constant:
 *   Zone            `@@unique([venueId, code])`
 *   Booth           `@@unique([zoneId, code])`
 *   ProductCategory `name` is unique
 *   ZoneCategory    composite id `[zoneId, categoryId]`
 *   User            `authUserId` and `email` are both unique
 *
 * One caveat on step 8: `User.authUserId` must match a real Supabase Auth user
 * id. Seeding a user whose `authUserId` belongs to nobody produces an account
 * that can never log in — create the auth users in Supabase first and paste
 * their ids here.
 *
 * Money (`Booth.boothPrice`, `Zone.defaultBoothPrice`) is `Decimal(10,2)`.
 * Pass it as a string — `'1500.00'`, never `1500.0` (AGENTS.md §6.1).
 */
/*
 * Not `async` yet, on purpose: every numbered step below is still a comment, and
 * an `async` function containing no `await` is a promise for nothing. The first
 * `await prisma.*.upsert()` that SCRUM-22 adds puts the keyword back and lets
 * the explicit `Promise.resolve()` go — the call site already expects a promise
 * either way, so that change is one word in one place.
 */
function main(): Promise<void> {
  console.log('Seeding...');

  // 1. Organization
  // 2. Venue
  // 3. Zone
  // 4. Booth
  // 5. Event
  // 6. ProductCategory
  // 7. ZoneCategory
  // 8. User
  // 9. Shop

  console.log('Nothing to seed yet — this script is a structure stub.');

  return Promise.resolve();
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    // Without this the process exits 0 and a broken seed looks successful.
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
