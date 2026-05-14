
import { getAdminByTelegramId } from '../../../db/queries/admins.queries.js';
import { dbPool } from '../../../db/pool.js';
import { config } from '../../../config/index.js';

export async function adminAuthMiddleware(senderId) {
  if (!senderId) return false;
  if (Number(senderId) === Number(config.superAdminId)) return true;
  const admin = await getAdminByTelegramId(dbPool, senderId);
  return Boolean(admin);
}
