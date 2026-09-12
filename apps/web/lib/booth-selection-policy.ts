export type VendorBoothAccessState =
  | 'loading'
  | 'signed-out'
  | 'ready'
  | 'error';

export type BoothSelectionAccessDecision =
  | 'remove-selection'
  | 'open-sign-in'
  | 'open-create-shop'
  | 'continue';

export type BoothQuotaDecision =
  | 'open-quota-request'
  | 'show-selection-limit'
  | 'continue';

export type SelectableBoothAvailability =
  | 'AVAILABLE'
  | 'HELD'
  | 'BOOKED'
  | 'UNAVAILABLE';

/**
 * Keeps the account gate for booth selection independent from rendering. A
 * selected booth can always be removed; adding one requires both a resolved
 * vendor session and that vendor's shop.
 */
export function decideBoothSelectionAccess({
  isSelected,
  vendorStatus,
  hasShop,
}: {
  isSelected: boolean;
  vendorStatus: VendorBoothAccessState;
  hasShop: boolean;
}): BoothSelectionAccessDecision {
  if (isSelected) return 'remove-selection';
  if (vendorStatus !== 'ready') return 'open-sign-in';
  if (!hasShop) return 'open-create-shop';
  return 'continue';
}

export function decideBoothQuota({
  selectedCount,
  effectiveSelectionLimit,
  remainingQuota,
}: {
  selectedCount: number;
  effectiveSelectionLimit: number;
  remainingQuota: number;
}): BoothQuotaDecision {
  if (selectedCount < effectiveSelectionLimit) return 'continue';
  return remainingQuota === 0
    ? 'open-quota-request'
    : 'show-selection-limit';
}

export function canAttemptBoothSelection(
  availability: SelectableBoothAvailability,
): boolean {
  return availability === 'AVAILABLE';
}
