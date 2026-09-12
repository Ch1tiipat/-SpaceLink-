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
