import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

const isDev = process.env.NODE_ENV === 'development';
const slowQueryThresholdMs = Number(process.env.DATABASE_SLOW_QUERY_MS) || (isDev ? 100 : 500);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });

    (this as unknown as { $on(event: 'query', cb: (e: Prisma.QueryEvent) => void): void }).$on(
      'query',
      (event: Prisma.QueryEvent) => {
        if (event.duration < slowQueryThresholdMs) return;
        this.logger.warn(JSON.stringify({
          durationMs: event.duration,
          event: 'slow_database_query',
          target: event.target,
        }));
      },
    );
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma connected to database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
