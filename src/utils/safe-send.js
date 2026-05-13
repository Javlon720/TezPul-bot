
import { MessageQueue, delay } from '../core/queue.system.js';
import { logger } from './logger.js';

const queue = new MessageQueue(50);

export async function safeSend(bot, chatId, text, options = {}, onBlocked = null) {
  return queue.add(async () => {
    let attempt = 0;
    while (attempt < 3) {
      attempt += 1;
      try {
        const message = await bot.sendMessage(chatId, text, options);
        return { success: true, message };
      } catch (error) {
        const status = error?.response?.statusCode || error?.response?.status || null;
        const description = error?.response?.body?.description || error?.description || error?.message || 'Telegram send failed';
        if (status === 429) {
          const retryAfter = Number(error?.response?.body?.parameters?.retry_after || 3);
          const delayMs = Math.max(retryAfter * 1000, 1000);
          logger.warn('Telegram flood control, retrying after', delayMs, 'ms');
          await delay(delayMs);
          continue;
        }
        if (status === 403) {
          logger.warn('Telegram blocked or forbidden for chat', chatId, description);
          if (typeof onBlocked === 'function') {
            await onBlocked();
          }
          return { success: false, error: description };
        }
        if (status === 400) {
          logger.warn('Telegram bad request for chat', chatId, description);
          return { success: false, error: description };
        }
        logger.error('Telegram send error', status, description);
        return { success: false, error: description };
      }
    }
    return { success: false, error: 'Telegram send retry limit reached' };
  });
}
