
import http from 'http';
import { config } from './src/config/index.js';
import { createUserBot } from './src/bots/userBot/index.js';
import { createAdminBot } from './src/bots/adminBot/index.js';
import { runStartupChecks } from './src/services/startup.service.js';
import { logger } from './src/utils/logger.js';

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      if (!body) {
        return resolve(null);
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function createWebhookServer(userBot, adminBot) {
  return http.createServer(async (req, res) => {
    try {
      if (req.method !== 'POST') {
        res.writeHead(404);
        return res.end('Not Found');
      }
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.pathname === `/user/${config.webhookSecret}`) {
        const update = await parseJsonBody(req);
        await userBot.processUpdate(update);
        res.writeHead(200);
        return res.end('ok');
      }
      if (url.pathname === `/admin/${config.webhookSecret}`) {
        const update = await parseJsonBody(req);
        await adminBot.processUpdate(update);
        res.writeHead(200);
        return res.end('ok');
      }
      res.writeHead(404);
      res.end('Not Found');
    } catch (error) {
      logger.error('Webhook request failed', error.message || error);
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  });
}

process.on('uncaughtException', (error) => {
  logger.error('uncaughtException', error.message || error, error.stack || '');
});

process.on('unhandledRejection', (reason) => {
  logger.error('unhandledRejection', reason);
});

async function start() {
  const userBot = createUserBot();
  const adminBot = createAdminBot(userBot);
  await runStartupChecks(userBot, adminBot);

  if (config.webhookUrl) {
    const userPath = `${config.webhookUrl.replace(/\/$/, '')}/user/${config.webhookSecret}`;
    const adminPath = `${config.webhookUrl.replace(/\/$/, '')}/admin/${config.webhookSecret}`;
    await userBot.setWebHook(userPath);
    await adminBot.setWebHook(adminPath);
    const server = createWebhookServer(userBot, adminBot);
    server.listen(config.webhookPort, () => {
      logger.info(`Webhook server listening on port ${config.webhookPort}`);
      logger.info('User bot webhook path: /user/' + config.webhookSecret);
      logger.info('Admin bot webhook path: /admin/' + config.webhookSecret);
    });
  } else {
    await userBot.startPolling();
    await adminBot.startPolling();
    logger.info('Bots started in polling mode');
    http.createServer((req, res) => {
      if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }));
        return;
      }
      res.writeHead(404);
      res.end('Not Found');
    }).listen(config.webhookPort, () => {
      logger.info(`Health server listening on port ${config.webhookPort}`);
    });
  }
}

start().catch((error) => {
  logger.error('Application failed to start', error.message || error);
  process.exit(1);
});