/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const boothSelectionAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict'
);
const { test: boothSelectionTest }: typeof import('node:test') = require('node:test');
const {
  canAttemptBoothSelection,
  decideBoothQuota,
  decideBoothSelectionAccess,
} = require(
  './booth-selection-policy.ts'
) as typeof import('./booth-selection-policy');

boothSelectionTest('allows an existing selection to be removed in every account state', () => {
  for (const vendorStatus of ['loading', 'signed-out', 'ready', 'error'] as const) {
    boothSelectionAssert.equal(
      decideBoothSelectionAccess({
        isSelected: true,
        vendorStatus,
        hasShop: vendorStatus === 'ready',
      }),
      'remove-selection',
    );
  }
});

boothSelectionTest('sends unresolved and signed-out visitors to authentication', () => {
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
});

boothSelectionTest('sends a signed-in vendor without a shop to shop creation', () => {
  boothSelectionAssert.equal(
    decideBoothSelectionAccess({
      isSelected: false,
      vendorStatus: 'ready',
      hasShop: false,
    }),
    'open-create-shop',
  );
});

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

boothSelectionTest('opens the quota request only when no quota remains', () => {
  boothSelectionAssert.equal(
    decideBoothQuota({
      selectedCount: 0,
      effectiveSelectionLimit: 0,
      remainingQuota: 0,
    }),
    'open-quota-request',
  );
  boothSelectionAssert.equal(
    decideBoothQuota({
      selectedCount: 2,
      effectiveSelectionLimit: 2,
      remainingQuota: 4,
    }),
    'show-selection-limit',
  );
});

boothSelectionTest('continues while the effective selection limit has room', () => {
  boothSelectionAssert.equal(
    decideBoothQuota({
      selectedCount: 1,
      effectiveSelectionLimit: 2,
      remainingQuota: 2,
    }),
    'continue',
  );
});

boothSelectionTest('never sends unavailable booth states into the quota flow', () => {
  boothSelectionAssert.equal(canAttemptBoothSelection('AVAILABLE'), true);
  for (const availability of ['HELD', 'BOOKED', 'UNAVAILABLE'] as const) {
    boothSelectionAssert.equal(canAttemptBoothSelection(availability), false);
  }
});
