export function refundNotificationHref(
  relatedEntityType: string | null,
  relatedEntityId: string | null,
): string | null {
  if (relatedEntityType?.toUpperCase() !== 'REFUND_REQUEST') return null;
  return relatedEntityId
    ? `/refunds?refundId=${encodeURIComponent(relatedEntityId)}`
    : '/refunds';
}
