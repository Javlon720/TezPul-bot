
import pg from 'pg';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('error', (error) => {
  logger.error('Unexpected PostgreSQL client error', error);
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function getClient() {
  return pool.connect();
}

export async function transaction(callback) {
  const client = await getClient();
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
