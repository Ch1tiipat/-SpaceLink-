/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const boothSelectionAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict'
);
const { test: boothSelectionTest }: typeof import('node:test') = require('node:test');
const { decideBoothSelectionAccess } = require(
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
