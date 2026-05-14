
import { transaction, dbPool } from '../../../db/pool.js';
import { getUserByTelegramId, updateUserPhone, getUserState, clearUserState } from '../../../db/queries/users.queries.js';
import { t } from '../../../services/i18n.service.js';
import { mainKeyboard } from '../keyboards/main.keyboard.js';
import { safeSend } from '../../../utils/safe-send.js';

const MENU_KEYS = ['menu_check', 'menu_report', 'menu_share', 'menu_payment', 'menu_info', 'menu_spin', 'menu_language'];

async function buildMainKeyboard(language) {
  const labels = {};
  for (const key of MENU_KEYS) {
    labels[key] = await t(key, language);
  }
  return mainKeyboard((key) => labels[key] || key);
}

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
  const firstName = user?.first_name || msg.from.first_name || '';
  const phone = msg.contact.phone_number;

  const text = await t('phone_saved', language, { name: firstName, phone });
  const keyboard = await buildMainKeyboard(language);

  await safeSend(bot, telegramId, text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}
