/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const boothSelectionAssert: typeof import('node:assert/strict') = require('node:assert/strict');
const {
  test: boothSelectionTest,
}: typeof import('node:test') = require('node:test');
const {
  canAttemptBoothSelection,
  decideBoothQuota,
  decideBoothSelectionAccess,
} =
  require('./booth-selection-policy.ts') as typeof import('./booth-selection-policy');

boothSelectionTest(
  'allows an existing selection to be removed in every account state',
  () => {
    for (const vendorStatus of [
      'loading',
      'signed-out',
      'ready',
      'error',
    ] as const) {
      boothSelectionAssert.equal(
        decideBoothSelectionAccess({
          isSelected: true,
          vendorStatus,
          hasShop: vendorStatus === 'ready',
        }),
        'remove-selection',
      );
    }
  },
);

boothSelectionTest(
  'sends unresolved and signed-out visitors to authentication',
  () => {
    for (const vendorStatus of ['loading', 'signed-out', 'error'] as const) {
      boothSelectionAssert.equal(
        decideBoothSelectionAccess({
          isSelected: false,
          vendorStatus,
          hasShop: false,
        }),
        'open-sign-in',
      );
    }
  },
);

boothSelectionTest(
  'sends a signed-in vendor without a shop to shop creation',
  () => {
    boothSelectionAssert.equal(
      decideBoothSelectionAccess({
        isSelected: false,
        vendorStatus: 'ready',
        hasShop: false,
      }),
      'open-create-shop',
    );
  },
);

boothSelectionTest('continues only for a signed-in vendor with a shop', () => {
  boothSelectionAssert.equal(
    decideBoothSelectionAccess({
      isSelected: false,
      vendorStatus: 'ready',
      hasShop: true,
    }),
    'continue',
  );
});

boothSelectionTest(
  'covers quota 2 when selecting the first, second, and third booths',
  () => {
    const cases = [
      { selectedCount: 0, expected: 'continue' },
      { selectedCount: 1, expected: 'continue' },
      { selectedCount: 2, expected: 'open-selection-limit-dialog' },
    ] as const;

    for (const { selectedCount, expected } of cases) {
      boothSelectionAssert.equal(
        decideBoothQuota({
          selectedCount,
          effectiveSelectionLimit: 2,
          remainingQuota: 2,
        }),
        expected,
      );
    }
  },
);

boothSelectionTest(
  'accounts for zero, one, and two existing bookings before selection',
  () => {
    const cases = [
      {
        activeBookingCount: 0,
        selectedCount: 0,
        effectiveSelectionLimit: 2,
        remainingQuota: 2,
        expected: 'continue',
      },
      {
        activeBookingCount: 1,
        selectedCount: 0,
        effectiveSelectionLimit: 1,
        remainingQuota: 1,
        expected: 'continue',
      },
      {
        activeBookingCount: 1,
        selectedCount: 1,
        effectiveSelectionLimit: 1,
        remainingQuota: 1,
        expected: 'open-selection-limit-dialog',
      },
      {
        activeBookingCount: 2,
        selectedCount: 0,
        effectiveSelectionLimit: 0,
        remainingQuota: 0,
        expected: 'open-quota-full-dialog',
      },
    ] as const;

    for (const {
      activeBookingCount,
      selectedCount,
      effectiveSelectionLimit,
      remainingQuota,
      expected,
    } of cases) {
      boothSelectionAssert.equal(
        decideBoothQuota({
          selectedCount,
          effectiveSelectionLimit,
          remainingQuota,
        }),
        expected,
        `active bookings: ${activeBookingCount}`,
      );
    }
  },
);

boothSelectionTest(
  'allows an approved extra quota before opening the selection limit dialog',
  () => {
    const approvedGrantContext = {
      configuredQuota: 2,
      activeBookingCount: 2,
      approvedGrantCount: 1,
      remainingQuota: 1,
      effectiveSelectionLimit: 1,
    };

    boothSelectionAssert.equal(approvedGrantContext.approvedGrantCount, 1);
    boothSelectionAssert.equal(
      decideBoothQuota({
        selectedCount: 0,
        effectiveSelectionLimit:
          approvedGrantContext.effectiveSelectionLimit,
        remainingQuota: approvedGrantContext.remainingQuota,
      }),
      'continue',
    );
    boothSelectionAssert.equal(
      decideBoothQuota({
        selectedCount: 1,
        effectiveSelectionLimit:
          approvedGrantContext.effectiveSelectionLimit,
        remainingQuota: approvedGrantContext.remainingQuota,
      }),
      'open-selection-limit-dialog',
    );
  },
);

boothSelectionTest(
  'never sends held, booked, or unavailable booths into the quota flow',
  () => {
    boothSelectionAssert.equal(canAttemptBoothSelection('AVAILABLE'), true);
    for (const availability of ['HELD', 'BOOKED', 'UNAVAILABLE'] as const) {
      boothSelectionAssert.equal(canAttemptBoothSelection(availability), false);
    }
  },
);
