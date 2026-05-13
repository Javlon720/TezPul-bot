
import { getUserByTelegramId } from '../../../db/queries/users.queries.js';
import { dbPool } from '../../../db/pool.js';
import { t } from '../../../services/i18n.service.js';

export async function authMiddleware(bot, msg) {
  if (!msg || !msg.from || !msg.from.id) {
    return null;
  }
  const user = await getUserByTelegramId(dbPool, msg.from.id);
  if (!user && typeof msg.text === 'string' && msg.text.trim().startsWith('/start')) {
    return null;
  }
  if (!user) {
    const text = await t('not_registered', 'uz');
    await bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
  }
  return user;
}
