
import { getAdminByTelegramId } from '../../../db/queries/admins.queries.js';
import { config } from '../../../config/index.js';

export async function adminAuthMiddleware(bot, msg) {
  if (!msg?.from?.id) {
    return false;
  }
  if (Number(msg.from.id) === Number(config.superAdminId)) {
    return true;
  }
  const admin = await getAdminByTelegramId(bot.client, msg.from.id);
  return Boolean(admin);
}
