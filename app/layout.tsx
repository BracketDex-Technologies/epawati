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
