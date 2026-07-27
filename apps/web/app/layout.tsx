import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SpaceLink — ค้นหาและจองบูธ',
  description: 'ค้นหา Event เลือกโซน และจองบูธที่เหมาะกับร้านของคุณ',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#6d3ce8',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
