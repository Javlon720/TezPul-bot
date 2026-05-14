import { routeCallback } from '../../../core/callback.router.js';
import { setUserLanguage, getUserByTelegramId } from '../../../db/queries/users.queries.js';
import { dbPool } from '../../../db/pool.js';
import { t } from '../../../services/i18n.service.js';
import { safeSend } from '../../../utils/safe-send.js';
import { logger } from '../../../utils/logger.js';
import { playSpin, getSpinInfo, getSpinHistory } from '../../../core/spin.engine.js';
import { mainKeyboard } from '../keyboards/main.keyboard.js';
import { requireChannelSubscription } from '../../../core/subscription.engine.js';

const MENU_KEYS = ['menu_check', 'menu_report', 'menu_share', 'menu_payment', 'menu_info', 'menu_spin', 'menu_language'];

async function buildMainKeyboard(language) {
  const labels = {};
  for (const key of MENU_KEYS) {
    labels[key] = await t(key, language);
  }
  return mainKeyboard((key) => labels[key] || key);
}

export async function handleUserCallback(bot, callbackQuery) {
  await routeCallback(callbackQuery, bot, {
    handleSubCheck: async (query) => {
      await bot.answerCallbackQuery(query.id);
      const telegramId = query.from.id;
      const chatId = query.message.chat.id;
      const user = await getUserByTelegramId(dbPool, telegramId);
      const language = user?.language || 'uz';
      const passed = await requireChannelSubscription(bot, telegramId, chatId, language);
      if (passed) {
        const keyboard = await buildMainKeyboard(language);
        await safeSend(bot, chatId, await t('main_menu', language), {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      }
    },
    handleLanguage: async (query) => {
      const data = query.data;
      const language = data.replace('lang_', '');
      if (!['uz', 'ru', 'en'].includes(language)) {
        await bot.answerCallbackQuery(query.id, { text: "❌ Amal noma'lum", show_alert: false });
        return;
      }
      await setUserLanguage(dbPool, query.from.id, language);
      const answer = await t('lang_changed', language);
      await bot.answerCallbackQuery(query.id, { text: answer, show_alert: false });
      const keyboard = await buildMainKeyboard(language);
      await bot.sendMessage(query.from.id, await t('language_updated', language), {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    },
    handleSpin: async (query, data) => {
      const telegramId = query.from.id;
      const chatId = query.message.chat.id;
      const user = await getUserByTelegramId(dbPool, telegramId);
      const language = user?.language || 'uz';

      if (data === 'spin_play') {
        try {
          await bot.answerCallbackQuery(query.id);
          let result;
          try {
            result = await playSpin(telegramId);
          } catch (err) {
            if (err.message === 'NO_SPINS') {
              await safeSend(bot, chatId, await t('spin_no_spins_now', language), { parse_mode: 'Markdown' });
              return;
            }
            throw err;
          }

          // 🎰 Slot natijasi
          const reel = result.reel || ['🎰', '🎰', '🎰'];
          const reelLine = reel.join(' | ');
          const isJackpot = reel.every((s) => s === '7️⃣');

          if (result.isWin) {
            let winText = '';
            if (isJackpot) {
              winText = `🎰 *JACKPOT! 777!*\n\n${reelLine}\n\n`;
            } else {
              winText = `🎰 *YUTDINGIZ!*\n\n${reelLine}\n\n`;
            }

            if (result.prizeType === 'pul') {
              const prizeText = await t('spin_win_money', language, {
                amount: Number(result.prizeValue).toLocaleString()
              });
              await safeSend(bot, chatId, `${winText}${prizeText}`, { parse_mode: 'Markdown' });
            } else if (result.prizeType === 'premium') {
              const prizeText = await t('spin_win_premium', language, { value: result.prizeValue });
              await safeSend(bot, chatId, `${winText}${prizeText}`, { parse_mode: 'Markdown' });
            } else if (result.prizeType === 'bonus_spin') {
              const prizeText = await t('spin_win_bonus', language, { value: result.prizeValue });
              await safeSend(bot, chatId, `${winText}${prizeText}`, { parse_mode: 'Markdown' });
            }
          } else {
            const spinInfo = await getSpinInfo(telegramId);
            const pending = spinInfo?.pending_refs || 0;
            const missText = await t('spin_miss', language, { pending, needed: 2 - pending });
            await safeSend(bot, chatId,
              `🎰 *Spin natijasi:*\n\n${reelLine}\n\n${missText}`,
              { parse_mode: 'Markdown' }
            );
          }
        } catch (err) {
          logger.error('spin_play callback error', err.message);
          await bot.answerCallbackQuery(query.id, { text: '❌ Xatolik yuz berdi', show_alert: true });
        }
        return;
      }

      if (data === 'spin_history') {
        try {
          await bot.answerCallbackQuery(query.id);
          const history = await getSpinHistory(telegramId, 10);
          if (!history.length) {
            const text = await t('spin_history_empty', language);
            await safeSend(bot, chatId, text, { parse_mode: 'Markdown' });
            return;
          }
          const lines = history.map((h, i) => {
            const emoji = h.is_win ? '✅' : '❌';
            const prize = h.is_win ? h.label : 'Miss';
            const date = new Date(h.created_at).toLocaleDateString('uz-UZ');
            return `${i + 1}. ${emoji} ${prize} — ${date}`;
          });
          const title = await t('spin_history_title', language);
          await safeSend(bot, chatId, `${title}\n\n${lines.join('\n')}`, { parse_mode: 'Markdown' });
        } catch (err) {
          logger.error('spin_history callback error', err.message);
          await bot.answerCallbackQuery(query.id, { text: '❌ Xatolik yuz berdi', show_alert: true });
        }
        return;
      }
    },
    handleUnknown: async (query) => {
      await bot.answerCallbackQuery(query.id, { text: "❌ Noma'lum amal", show_alert: false });
    }
  });
}
