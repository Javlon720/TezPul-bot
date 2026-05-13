
import { transaction, dbPool } from '../../../db/pool.js';
import * as userQueries from '../../../db/queries/users.queries.js';
import { generateReferralCode, processReferral } from '../../../core/referral.engine.js';
import { t } from '../../../services/i18n.service.js';
import { mainKeyboard } from '../keyboards/main.keyboard.js';
import { safeSend } from '../../../utils/safe-send.js';

export async function handleStartCommand(bot, msg, match) {
  if (!msg?.from?.id || !msg.chat) {
    return;
  }

  const telegramId = msg.from.id;
  const existing = await userQueries.getUserByTelegramId(dbPool, telegramId);
  const payload = (match && match[1]) ? String(match[1]).trim() : '';
  const language = existing?.language || 'uz';

  if (!existing) {
    const referralCode = await generateReferralCode(telegramId);
    await transaction(async (client) => {
      await userQueries.createOrUpdateUser(
        client,
        {
          telegramId,
          username: msg.from.username || null,
          firstName: msg.from.first_name || null,
          lastName: msg.from.last_name || null,
          phone: null,
          language: 'uz'
        },
        referralCode,
        null
      );
      await userQueries.createOrUpdateUserState(client, telegramId, 'WAITING_PHONE', {
        ref_code: payload,
        requested_at: new Date().toISOString()
      });
      if (payload) {
        await processReferral(client, telegramId, payload);
      }
    });
    const greeting = await t('welcome', 'uz', { name: msg.from.first_name || '' });
    const request = await t('request_phone', 'uz');
    await safeSend(bot, msg.chat.id, `${greeting}\n\n${request}`, {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [[{ text: await t('share_phone', 'uz'), request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
        is_persistent: false
      }
    });
    return;
  }

  await userQueries.clearUserState(dbPool, telegramId);
  const text = await t('main_menu', language);
  await safeSend(bot, msg.chat.id, text, {
    parse_mode: 'Markdown',
    reply_markup: mainKeyboard((key) => t(key, language))
  });
}
