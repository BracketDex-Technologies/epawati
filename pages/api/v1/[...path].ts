import 'reflect-metadata';
import type { NextApiRequest, NextApiResponse } from 'next';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from '../../../server/api/src/app.module';
import { configureHttpApp } from '../../../server/api/src/common/bootstrap/configure-http-app';

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

let serverPromise: Promise<express.Express> | undefined;

async function bootstrapServer() {
  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    abortOnError: false,
    bodyParser: false,
    bufferLogs: true,
  });

  configureHttpApp(app);
  await app.init();
  return server;
}

function getServer() {
  if (!serverPromise) {
    serverPromise = bootstrapServer().catch((error: unknown) => {
      serverPromise = undefined;
      throw error;
    });
  }
  return serverPromise;
}

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  try {
    const server = await getServer();
    server(request, response);
  } catch (error) {
    console.error({
      error: error instanceof Error ? error.message : 'Unknown API bootstrap error',
      event: 'epawati_api_bootstrap_failed',
    });
    response.status(500).json({
      error: 'API_BOOTSTRAP_FAILED',
      message: 'ePawati API could not start. Check environment variables and deployment logs.',
    });
  }
}
