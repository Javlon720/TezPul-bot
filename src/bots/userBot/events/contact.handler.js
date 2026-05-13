
import { transaction, dbPool } from '../../../db/pool.js';
import { getUserByTelegramId, updateUserPhone, getUserState, clearUserState } from '../../../db/queries/users.queries.js';
import { t } from '../../../services/i18n.service.js';
import { mainKeyboard } from '../keyboards/main.keyboard.js';
import { safeSend } from '../../../utils/safe-send.js';

export async function handleContact(bot, msg) {
  if (!msg?.contact || !msg?.from || msg.contact.user_id !== msg.from.id) {
    return;
  }
  const telegramId = msg.from.id;
  await transaction(async (client) => {
    const state = await getUserState(client, telegramId);
    if (!state || state.state !== 'WAITING_PHONE') {
      return;
    }
    await updateUserPhone(client, telegramId, msg.contact.phone_number);
    await clearUserState(client, telegramId);
  });
  const user = await getUserByTelegramId(dbPool, telegramId);
  const language = user?.language || 'uz';
  const text = await t('phone_saved', language);
  await safeSend(bot, telegramId, text, { reply_markup: mainKeyboard((key) => t(key, language)) });
}
