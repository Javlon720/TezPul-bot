
import { safeSend } from '../utils/safe-send.js';
import { logger } from '../utils/logger.js';
import { deactivateUser } from '../db/queries/users.queries.js';
import { dbPool } from '../db/pool.js';

export async function notifyUser(bot, telegramId, text, options = {}) {
  return safeSend(bot, telegramId, text, options, async () => {
    logger.warn('User blocked bot or forbidden', telegramId);
    try {
      await deactivateUser(dbPool, telegramId);
    } catch (error) {
      logger.debug('Failed to deactivate blocked user', error?.message || error);
    }
  });
}

export async function notifyAdmin(bot, telegramId, text, options = {}) {
  return safeSend(bot, telegramId, text, options);
}

export async function broadcastCampaignUpdate(bot, client, campaignId, message) {
  const referralQuery = await client.query(
    `SELECT DISTINCT r.referrer_id, u.telegram_id
     FROM referrals r
     JOIN users u ON u.telegram_id = r.referrer_id
     WHERE r.campaign_id = $1`,
    [campaignId]
  );

  const rows = referralQuery.rows || [];
  let success = 0;
  let failed = 0;
  for (const row of rows) {
    const chatId = Number(row.telegram_id);
    const result = await safeSend(bot, chatId, message, {});
    if (result.success) {
      success += 1;
    } else {
      failed += 1;
    }
  }
  return { success, failed };
}
