
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import { config } from '../config/index.js';
import { getClient, query } from '../db/pool.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function verifyDatabaseConnection() {
  const client = await getClient();
  try {
    await client.query('SELECT 1');
    logger.info('Database connection verified');
  } finally {
    client.release();
  }
}

async function loadSchema() {
  const schemaPath = path.join(__dirname, '../db/schema/schema.sql');
  const schemaSql = await fs.readFile(schemaPath, 'utf8');
  await query(schemaSql);
  logger.info('Database schema ensured');
}

async function verifyTablesExist() {
  const requiredTables = ['users', 'user_states', 'campaigns', 'referrals', 'payments', 'admin_channels', 'admin_states', 'spin_segments', 'spin_results', 'bot_channels'];
  const result = await query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [requiredTables]
  );
  const existing = result.rows.map((row) => row.table_name);
  const missing = requiredTables.filter((table) => !existing.includes(table));
  if (missing.length > 0) {
    throw new Error(`Missing required database tables: ${missing.join(', ')}`);
  }
  logger.info('Required database tables exist');
}

async function validateBotToken(bot, label) {
  const info = await bot.getMe();
  logger.info(`${label} bot validated: @${info.username}`);
}

export async function runStartupChecks(userBot, adminBot) {
  try {
    logger.info('Running startup validation');
    await verifyDatabaseConnection();
    await loadSchema();
    await verifyTablesExist();
    await validateBotToken(userBot, 'User');
    await validateBotToken(adminBot, 'Admin');
    logger.info('Startup validation completed successfully');
  } catch (error) {
    logger.error('Startup validation failed', error.message || error);
    process.exit(1);
  }
}
