export const BOOKING_SUMMARY_MIME_TYPE = 'image/png';

export type BookingSummaryImageItem = {
  bookingCode: string;
  boothCode: string;
  zoneName: string;
  statusLabel: string;
};

export type BookingSummaryImageData = {
  eventName: string;
  eventDate: string;
  venueName: string;
  venueAddress?: string | null;
  shopName: string;
  totalAmount: string;
  overallStatus: string;
  items: BookingSummaryImageItem[];
  generatedAt: Date;
};

export type BookingSummaryRow = {
  label: string;
  value: string;
};

const THAI_FONT = '"IBM Plex Sans Thai", "Noto Sans Thai", sans-serif';

export function buildBookingSummaryRows(
  data: BookingSummaryImageData,
): BookingSummaryRow[] {
  return [
    { label: 'งาน', value: data.eventName },
    { label: 'วันที่จัดงาน', value: data.eventDate },
    {
      label: 'สถานที่',
      value: [data.venueName, data.venueAddress].filter(Boolean).join(' · '),
    },
    { label: 'ร้านค้า', value: data.shopName },
    { label: 'ยอดรวม', value: `${data.totalAmount} บาท` },
    { label: 'สถานะ', value: data.overallStatus },
  ];
}

export function createBookingSummaryFileName(reference: string): string {
  const safeReference = reference
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `SpaceLink_Booking_Summary_${safeReference || 'booking'}.png`;
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function fitText(
  context: CanvasRenderingContext2D,
  value: string,
  maximumWidth: number,
): string {
  if (context.measureText(value).width <= maximumWidth) return value;
  let fitted = value;
  while (
    fitted.length > 1 &&
    context.measureText(`${fitted}…`).width > maximumWidth
  ) {
    fitted = fitted.slice(0, -1);
  }
  return `${fitted}…`;
}

function drawLabelValue(
  context: CanvasRenderingContext2D,
  row: BookingSummaryRow,
  y: number,
) {
  context.fillStyle = '#776d85';
  context.font = `600 23px ${THAI_FONT}`;
  context.fillText(row.label, 92, y);
  context.fillStyle = '#21172f';
  context.font = `700 25px ${THAI_FONT}`;
  context.textAlign = 'right';
  context.fillText(fitText(context, row.value, 650), 988, y);
  context.textAlign = 'left';
}

export async function downloadBookingSummaryPng(
  data: BookingSummaryImageData,
): Promise<string> {
  await document.fonts.ready;
  await document.fonts.load(`700 32px ${THAI_FONT}`).catch(() => []);

  const logicalWidth = 1080;
  const itemHeight = 74;
  const logicalHeight = 720 + Math.max(data.items.length, 1) * itemHeight;
  const pixelRatio = Math.max(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement('canvas');
  canvas.width = logicalWidth * pixelRatio;
  canvas.height = logicalHeight * pixelRatio;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('เบราว์เซอร์ไม่รองรับการสร้างภาพสรุป');
  context.scale(pixelRatio, pixelRatio);

  const background = context.createLinearGradient(0, 0, logicalWidth, logicalHeight);
  background.addColorStop(0, '#f8f3ff');
  background.addColorStop(1, '#eef8f6');
  context.fillStyle = background;
  context.fillRect(0, 0, logicalWidth, logicalHeight);

  const header = context.createLinearGradient(56, 48, logicalWidth - 56, 260);
  header.addColorStop(0, '#351160');
  header.addColorStop(0.62, '#7740de');
  header.addColorStop(1, '#377d76');
  roundedRect(context, 56, 48, 968, 220, 34);
  context.fillStyle = header;
  context.fill();

  context.fillStyle = '#ffffff';
  context.font = `800 30px ${THAI_FONT}`;
  context.fillText('SpaceLink', 92, 102);
  context.font = `700 22px ${THAI_FONT}`;
  context.fillStyle = '#eadfff';
  context.fillText('สรุปการจองพื้นที่', 92, 143);
  context.font = `800 42px ${THAI_FONT}`;
  context.fillStyle = '#ffffff';
  context.fillText(fitText(context, data.eventName, 850), 92, 207);
  context.font = `600 22px ${THAI_FONT}`;
  context.fillStyle = '#f0e8ff';
  context.fillText(
    `สร้างเมื่อ ${new Intl.DateTimeFormat('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(data.generatedAt)}`,
    92,
    242,
  );

  roundedRect(context, 56, 292, 968, 332, 30);
  context.fillStyle = '#ffffff';
  context.fill();
  context.strokeStyle = '#e4d9f3';
  context.lineWidth = 2;
  context.stroke();

  buildBookingSummaryRows(data).forEach((row, index) => {
    const y = 343 + index * 48;
    drawLabelValue(context, row, y);
    if (index < 5) {
      context.strokeStyle = '#eee8f5';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(92, y + 19);
      context.lineTo(988, y + 19);
      context.stroke();
    }
  });

  context.fillStyle = '#5c2bc8';
  context.font = `800 26px ${THAI_FONT}`;
  context.fillText(`รายการบูธ (${data.items.length})`, 72, 674);

  const items = data.items.length
    ? data.items
    : [
        {
          bookingCode: '-',
          boothCode: '-',
          zoneName: '-',
          statusLabel: '-',
        },
      ];
  items.forEach((item, index) => {
    const y = 700 + index * itemHeight;
    roundedRect(context, 56, y, 968, 58, 18);
    context.fillStyle = index % 2 === 0 ? '#ffffff' : '#fbf9ff';
    context.fill();
    context.strokeStyle = '#e4d9f3';
    context.stroke();

    context.fillStyle = '#21172f';
    context.font = `800 23px ${THAI_FONT}`;
    context.fillText(`Booth ${item.boothCode}`, 82, y + 37);
    context.fillStyle = '#776d85';
    context.font = `600 20px ${THAI_FONT}`;
    context.fillText(fitText(context, item.zoneName, 330), 255, y + 37);
    context.textAlign = 'right';
    context.fillText(item.bookingCode, 790, y + 37);
    context.fillStyle = '#5c2bc8';
    context.font = `700 20px ${THAI_FONT}`;
    context.fillText(item.statusLabel, 992, y + 37);
    context.textAlign = 'left';
  });

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error('สร้างไฟล์ PNG ไม่สำเร็จ'));
    }, BOOKING_SUMMARY_MIME_TYPE);
  });
  const filename = createBookingSummaryFileName(data.items[0]?.bookingCode ?? 'booking');
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  return filename;
}
