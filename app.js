import  dotenv from 'dotenv';
import Fastify from 'fastify';
import { setupUserBot } from './src/bots/userBot.js';
import { setupAdminBot } from './src/bots/adminBot.js';
import { dbConfig } from './src/db/db.js';
import { setBotInstances } from './src/core/notification.engine.js';

dotenv.config();
const app = Fastify({ logger: true });

async function start() {
  try {
    // 1. Check DB Connection
    const client = await dbConfig.connect();
    client.release();
    app.log.info('Database connected successfully.');

    // 2. Initialize Bots
    const userBot = setupUserBot();
    const adminBot = setupAdminBot();

    // Link bots to the Notification Engine for backend-to-bot alerts
    setBotInstances(userBot, adminBot);

    // In a production environment, you might want to use webhooks instead of polling.
    // For this boilerplate, we'll start them with long polling.
    userBot.launch();
    adminBot.launch();
    app.log.info('Telegram Bots launched successfully.');

    // 3. Start Fastify Server (Backend API)
    app.get('/health', async (request, reply) => {
      return { status: 'ok', time: new Date().toISOString() };
    });

    const port = process.env.PORT || 3000;
    const host = process.env.HOST || '0.0.0.0';
    
    await app.listen({ port, host });
    app.log.info(`Server listening on http://${host}:${port}`);

  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Graceful stop
process.once('SIGINT', () => {
  console.log('SIGINT received');
  process.exit(0);
});
process.once('SIGTERM', () => {
  console.log('SIGTERM received');
  process.exit(0);
});

start();
