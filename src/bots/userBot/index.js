
import TelegramBot from 'node-telegram-bot-api';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { handleStartCommand } from './commands/start.command.js';
import { handleMessage } from './events/message.handler.js';
import { handleContact } from './events/contact.handler.js';
import { handleUserCallback } from './callbacks/callback.handler.js';
import { dbPool } from '../../db/pool.js';
import { upsertBotChannel } from '../../db/queries/bot_channels.queries.js';

export function createUserBot() {
  const bot = new TelegramBot(config.userBotToken, { polling: false });

  bot.onText(/^\/start(@\S+)?(?:\s+(.*))?$/, async (msg, match) => {
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
      if (msg.text?.startsWith('/')) return;
      if (msg.contact) {
        await handleContact(bot, msg);
        return;
      }
      await handleMessage(bot, msg);
    } catch (error) {
      logger.error('User message handler failed', error.message || error);
      if (msg?.chat?.id) {
        await bot.sendMessage(msg.chat.id, '❌ Xatolik yuz berdi.').catch(() => {});
      }
    }
  });

  bot.on('callback_query', async (callbackQuery) => {
    try {
      await handleUserCallback(bot, callbackQuery);
    } catch (error) {
      logger.error('User callback handler failed', error.message || error);
      if (callbackQuery?.id) {
        await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Amal bajarilmadi', show_alert: false }).catch(() => {});
      }
    }
  });

  bot.on('my_chat_member', async (update) => {
    try {
      const chat = update.chat;
      const newStatus = update.new_chat_member?.status;
      const oldStatus = update.old_chat_member?.status;

      if (!['channel', 'group', 'supergroup'].includes(chat.type)) return;

      await upsertBotChannel(dbPool, {
        channel_id: chat.id,
        channel_title: chat.title || null,
        channel_username: chat.username || null,
        channel_type: chat.type,
        bot_status: newStatus,
      });

      logger.info(`Bot kanal statusi: ${chat.title} (${chat.id}) → ${newStatus}`);

      if (oldStatus === 'left' && ['administrator', 'member'].includes(newStatus)) {
        const usernameStr = chat.username ? `@${chat.username}` : '—';
        await bot.sendMessage(
          config.superAdminId,
          `✅ *Yangi kanal aniqlandi!*\n\n` +
          `📢 *Nom:* ${chat.title}\n` +
          `🔗 *Username:* ${usernameStr}\n` +
          `🆔 *ID:* \`${chat.id}\`\n` +
          `📊 *Status:* ${newStatus}\n\n` +
          `Endi shu kanalga kampaniya yaratishingiz mumkin.`,
          { parse_mode: 'Markdown' }
        ).catch((err) => logger.warn('Super admin notify failed', err.message));
      }

      if (newStatus === 'kicked' || newStatus === 'left') {
        logger.warn(`Bot kanaldan chiqarildi: ${chat.title} (${chat.id})`);
      }
    } catch (err) {
      logger.error('my_chat_member event error', err.message);
    }
  });

  bot.on('polling_error', (error) => {
    if (['ETIMEDOUT', 'ECONNRESET', 'EFATAL'].includes(error.code)) return;
    logger.error('User bot polling error', error.message || error);
  });

  bot.on('error', (error) => {
    logger.error('User bot error', error.message || error);
  });

  return bot;
}
