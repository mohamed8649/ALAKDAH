import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'العقدة — منصة إدارة التجارة الإلكترونية',
    template: '%s — العقدة',
  },
  description: 'منصة عربية متكاملة لإدارة المتاجر الإلكترونية والدفع عند الاستلام.',
  applicationName: 'Alakdah',
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // A merchant must be able to zoom a dense table. Never maximum-scale=1.
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#071525' },
    { media: '(prefers-color-scheme: light)', color: '#f4f7fa' },
  ],
};

/**
 * The real <html> element is emitted by src/app/[locale]/layout.tsx, which
 * knows the locale and therefore the correct `lang` and `dir`.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
