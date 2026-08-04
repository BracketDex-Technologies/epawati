'use client';

import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { QueryClientProvider } from '@tanstack/react-query';
import App from '../src/App';
import { AppErrorBoundary } from '../src/components/AppErrorBoundary';
import { queryClient } from '../src/lib/queryClient';

export default function ClientRoot() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
      <Analytics />
      <SpeedInsights sampleRate={1} />
    </QueryClientProvider>
  );
}
