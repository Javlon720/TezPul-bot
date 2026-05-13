
import TelegramBot from 'node-telegram-bot-api';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { handleAdminCommand } from './commands/admin.command.js';
import { handleAdminCallback, handleAdminPhoto } from './callbacks/callback.handler.js';

export function createAdminBot() {
  const bot = new TelegramBot(config.adminBotToken, { polling: false });
  bot.onText(/\/admin(?:\s+(.*))?/, async (msg) => {
    try {
      await handleAdminCommand(bot, msg);
    } catch (error) {
      logger.error('Admin /admin handler failed', error.message || error);
      if (msg?.chat?.id) {
        await bot.sendMessage(msg.chat.id, '❌ Xatolik yuz berdi.', { parse_mode: 'Markdown' });
      }
    }
  });

  bot.on('callback_query', async (callbackQuery) => {
    try {
      await handleAdminCallback(bot, callbackQuery);
    } catch (error) {
      logger.error('Admin callback handler failed', error.message || error);
      if (callbackQuery?.id) {
        await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Amal bajarilmadi', show_alert: false });
      }
    }
  });

  bot.on('photo', async (msg) => {
    try {
      await handleAdminPhoto(bot, msg);
    } catch (error) {
      logger.error('Admin photo handler failed', error.message || error);
      if (msg?.chat?.id) {
        await bot.sendMessage(msg.chat.id, '❌ Rasmni qayta ishlashda xatolik.', { parse_mode: 'Markdown' });
      }
    }
  });

  bot.on('polling_error', (error) => {
    if (['ETIMEDOUT', 'ECONNRESET', 'EFATAL'].includes(error.code)) return;
    logger.error('Admin bot polling error', error.message || error);
  });
  return bot;
}
