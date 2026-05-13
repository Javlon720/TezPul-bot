
import TelegramBot from 'node-telegram-bot-api';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { handleStartCommand } from './commands/start.command.js';
import { handleMessage } from './events/message.handler.js';
import { handleContact } from './events/contact.handler.js';
import { handleUserCallback } from './callbacks/callback.handler.js';

export function createUserBot() {
  const bot = new TelegramBot(config.userBotToken, { polling: false });
  bot.onText(/\/start(?:\s+(.*))?/, async (msg, match) => {
    try {
      await handleStartCommand(bot, msg, match);
    } catch (error) {
      logger.error('User /start handler failed', error.message || error);
      if (msg?.chat?.id) {
        await bot.sendMessage(msg.chat.id, '❌ Xatolik yuz berdi.', { parse_mode: 'Markdown' });
      }
    }
  });

  bot.on('message', async (msg) => {
    try {
      if (msg.text?.trim().startsWith('/start')) {
        return;
      }
      if (msg.contact) {
        await handleContact(bot, msg);
        return;
      }
      await handleMessage(bot, msg);
    } catch (error) {
      logger.error('User message handler failed', error.message || error);
      if (msg?.chat?.id) {
        await bot.sendMessage(msg.chat.id, '❌ Xatolik yuz berdi.', { parse_mode: 'Markdown' });
      }
    }
  });

  bot.on('callback_query', async (callbackQuery) => {
    try {
      await handleUserCallback(bot, callbackQuery);
    } catch (error) {
      logger.error('User callback handler failed', error.message || error);
      if (callbackQuery?.id) {
        await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Amal bajarilmadi', show_alert: false });
      }
    }
  });

  bot.on('polling_error', (error) => {
    if (['ETIMEDOUT', 'ECONNRESET', 'EFATAL'].includes(error.code)) return;
    logger.error('User bot polling error', error.message || error);
  });
  return bot;
}
