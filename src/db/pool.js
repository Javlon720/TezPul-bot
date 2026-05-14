
import pg from 'pg';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const SLOW_QUERY_MS = 2000;

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 25,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  query_timeout: 10000,
  statement_timeout: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error', err.message);
});

pool.on('connect', () => {
  logger.debug('New PostgreSQL client connected');
});

setInterval(() => {
  logger.debug('Pool stats', {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  });
}, 30_000).unref();

export async function query(text, params = []) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > SLOW_QUERY_MS) {
    logger.warn('Slow query detected', { duration, text: text.slice(0, 100) });
  }
  return result;
}

export async function getClient() {
  return pool.connect();
}

export async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export const dbPool = pool;
