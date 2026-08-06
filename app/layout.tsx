import '@fontsource-variable/inter';
import '@fontsource-variable/noto-sans-devanagari';
import './globals.css';
import './design-tokens.css';
import './owner-final.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const siteUrl = new URL(
  process.env.NEXT_PUBLIC_WEB_BASE_URL
    ?? process.env.PUBLIC_WEB_BASE_URL
    ?? 'https://epawati.samavet.in',
);
const ogImageUrl = new URL('/epawati-og.jpg', siteUrl);

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: 'Samavet ePawati',
  description: 'Digital vargani receipts, mandal collections, member management, and festival accounting by Samavet.',
  alternates: {
    canonical: siteUrl,
  },
  applicationName: 'Samavet ePawati',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Samavet ePawati',
  },
  icons: {
    apple: [{ sizes: '180x180', url: '/apple-touch-icon.png' }],
    icon: [
      { sizes: '16x16', type: 'image/png', url: '/favicon-16x16.png' },
      { sizes: '32x32', type: 'image/png', url: '/favicon-32x32.png' },
      { sizes: '48x48', type: 'image/png', url: '/favicon-48x48.png' },
      { type: 'image/jpeg', url: '/samavet-logo.jpeg' },
    ],
    shortcut: ['/favicon.ico'],
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    description: 'Digital vargani receipts, mandal collections, member management, and festival accounting by Samavet.',
    images: [
      {
        alt: 'Samavet ePawati digital mandal receipt platform',
        height: 630,
        type: 'image/jpeg',
        url: ogImageUrl,
        width: 1200,
      },
    ],
    locale: 'en_IN',
    siteName: 'Samavet ePawati',
    title: 'Samavet ePawati',
    type: 'website',
    url: siteUrl,
  },
  twitter: {
    card: 'summary_large_image',
    description: 'Digital vargani receipts, mandal collections, member management, and festival accounting by Samavet.',
    images: [ogImageUrl],
    title: 'Samavet ePawati',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (location.hostname === 'localhost' && 'serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations()
                  .then(function (registrations) {
                    return Promise.all(registrations.map(function (registration) {
                      return registration.unregister();
                    }));
                  })
                  .then(function () {
                    if ('caches' in window) {
                      return caches.keys().then(function (keys) {
                        return Promise.all(keys.map(function (key) { return caches.delete(key); }));
                      });
                    }
                  })
                  .catch(function () {});
              }
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}
