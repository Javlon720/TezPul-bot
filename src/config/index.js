
import dotenv from 'dotenv';

dotenv.config();

const required = [
  'USER_BOT_TOKEN',
  'ADMIN_BOT_TOKEN',
  'DATABASE_URL',
  'SUPER_ADMIN_ID',
  'NODE_ENV',
  'LOG_LEVEL'
];

const missing = required.filter((key) => !process.env[key] || String(process.env[key]).trim() === '');
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

if (process.env.WEBHOOK_URL && !process.env.WEBHOOK_SECRET) {
  throw new Error('WEBHOOK_SECRET is required when WEBHOOK_URL is provided');
}

export const config = Object.freeze({
  userBotToken: process.env.USER_BOT_TOKEN,
  adminBotToken: process.env.ADMIN_BOT_TOKEN,
  webhookUrl: process.env.WEBHOOK_URL || '',
  webhookPort: Number(process.env.WEBHOOK_PORT || '3000'),
  webhookSecret: process.env.WEBHOOK_SECRET || '',
  databaseUrl: process.env.DATABASE_URL,
  superAdminId: Number(process.env.SUPER_ADMIN_ID),
  reportChannelId: process.env.REPORT_CHANNEL_ID ? Number(process.env.REPORT_CHANNEL_ID) : null,
  nodeEnv: process.env.NODE_ENV,
  logLevel: process.env.LOG_LEVEL
});
