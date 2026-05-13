import { routeCallback } from '../../../core/callback.router.js';
import { setUserLanguage } from '../../../db/queries/users.queries.js';
import { dbPool } from '../../../db/pool.js';
import { t } from '../../../services/i18n.service.js';

export async function handleUserCallback(bot, callbackQuery) {
  await routeCallback(callbackQuery, bot, {
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
      await bot.sendMessage(query.from.id, await t('language_updated', language), { parse_mode: 'Markdown' });
    },
    handleUnknown: async (query) => {
      await bot.answerCallbackQuery(query.id, { text: "❌ Noma'lum amal", show_alert: false });
    }
  });
}
