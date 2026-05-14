import axios from 'axios';
import { MessageQueue, delay } from '../core/queue.system.js';

const MAX_RETRY = 5;
const BASE_DELAY_MS = 1000;

export function createTelegramApi(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Telegram token is required for createTelegramApi');
  }

  const baseURL = `https://api.telegram.org/bot${token}`;
  const client = axios.create({ baseURL, timeout: 30000 });
  const queue = new MessageQueue(1);

  async function dispatchRequest(method, path, payload = {}, params = {}) {
    return queue.add(async () => {
      let attempt = 0;
      while (attempt < MAX_RETRY) {
        attempt += 1;
        try {
          const response = await client.request({ method, url: path, data: payload, params });
          if (!response?.data?.ok) {
            throw new Error(`Telegram API error: ${JSON.stringify(response?.data)}`);
          }
          return response.data;
        } catch (error) {
          const status = error?.response?.status;
          const description = error?.response?.data?.description || error.message;
          if (status === 429) {
            const retryAfter = Number(error.response.data.parameters?.retry_after || 3);
            const waitMs = Math.max(retryAfter * 1000, BASE_DELAY_MS * attempt);
            await delay(waitMs);
            continue;
          }
          if (status >= 500 && status < 600) {
            await delay(BASE_DELAY_MS * attempt);
            continue;
          }
          throw new Error(`Telegram request failed: ${description}`);
        }
      }
      throw new Error('Telegram request retry limit exceeded');
    });
  }

  return {
    async getMe() {
      const response = await dispatchRequest('GET', '/getMe');
      return response.result;
    },
    async getUpdates(params = {}) {
      const response = await dispatchRequest('GET', '/getUpdates', {}, params);
      return response;
    },
    async sendMessage(chat_id, text, options = {}) {
      const payload = { chat_id, text, parse_mode: 'Markdown', ...options };
      return dispatchRequest('POST', '/sendMessage', payload);
    },
    async sendPhoto(chat_id, photo, options = {}) {
      const payload = { chat_id, photo, ...options };
      return dispatchRequest('POST', '/sendPhoto', payload);
    },
    async answerCallbackQuery(callback_query_id, text = '', options = {}) {
      const payload = { callback_query_id, text, ...options };
      return dispatchRequest('POST', '/answerCallbackQuery', payload);
    },
    async editMessageText(chat_id, message_id, text, options = {}) {
      const payload = { chat_id, message_id, text, parse_mode: 'Markdown', ...options };
      return dispatchRequest('POST', '/editMessageText', payload);
    },
    async getChatMember(chat_id, user_id) {
      const response = await dispatchRequest('GET', '/getChatMember', {}, { chat_id, user_id });
      return response.result;
    }
  };
}

export function buildReplyKeyboard(rows, persistent = true) {
  return {
    keyboard: rows,
    resize_keyboard: true,
    one_time_keyboard: false,
    is_persistent: persistent
  };
}

export function buildInlineKeyboard(rows) {
  return {
    inline_keyboard: rows
  };
}

export function formatUserName(user, fallback = '') {
  return [user?.first_name, user?.last_name].filter(Boolean).join(' ') || fallback;
}
