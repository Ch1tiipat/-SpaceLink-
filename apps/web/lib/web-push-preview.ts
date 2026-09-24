export type WebPushPreviewNotification = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
};

export const WEB_PUSH_PREVIEW_ID_PREFIX = 'web-push-preview-';

export function createWebPushPreviewNotification(
  sequence: number,
  now = new Date(),
): WebPushPreviewNotification {
  return {
    id: `${WEB_PUSH_PREVIEW_ID_PREFIX}${now.getTime()}-${sequence}`,
    title: 'ข่าวจาก SpaceLink',
    description:
      'มีประกาศสำคัญสำหรับผู้ขาย กรุณาตรวจสอบรายละเอียดและเตรียมความพร้อมก่อนเข้าพื้นที่จัดงาน',
    createdAt: now.toISOString(),
  };
}

export function prependWebPushPreview<T extends { id: string }>(
  notifications: T[],
  preview: T,
): T[] {
  if (notifications.some((notification) => notification.id === preview.id)) {
    return notifications;
  }
  return [preview, ...notifications];
}

export function isWebPushPreviewNotificationId(id: string): boolean {
  return id.startsWith(WEB_PUSH_PREVIEW_ID_PREFIX);
}
