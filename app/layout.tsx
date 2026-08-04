import '@fontsource-variable/inter';
import '@fontsource-variable/noto-sans-devanagari';
import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Samavet ePawati',
  description: 'Digital Vargani and mandal collection console.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
