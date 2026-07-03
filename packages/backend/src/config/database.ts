import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'stdout', level: 'error' },
    { emit: 'stdout', level: 'warn' },
  ],
});

prisma.$on('query', (e: { duration: number; query: string; params: string }) => {
  if (e.duration > 500) {
    logger.warn('Slow query detected', {
      query: e.query,
      duration: e.duration,
      params: e.params,
    });
  }
});

export default prisma;
