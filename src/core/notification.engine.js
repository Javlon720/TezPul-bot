import { safeSend, safePhoto } from '../utils/safe-send.js';
import { logger } from '../utils/logger.js';
import { deactivateUser } from '../db/queries/users.queries.js';
import { dbPool } from '../db/pool.js';
import { config } from '../config/index.js';
import { formatUserName } from '../utils/telegram.js';

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 1000;

export async function notifyUser(bot, telegramId, text, options = {}) {
  const result = await safeSend(bot, telegramId, text, options, async () => {
    logger.warn('User blocked bot or forbidden', telegramId);
    try {
      await deactivateUser(dbPool, telegramId);
    } catch (error) {
      logger.debug('Failed to deactivate blocked user', error?.message || error);
    }
  });

  if (config.nodeEnv !== 'production' && config.superAdminId && telegramId !== config.superAdminId) {
    await safeSend(bot, config.superAdminId, `🔧 [DEV → ${telegramId}]\n\n${text}`, options).catch(() => {});
  }

  return result;
}

export async function notifyAdmin(bot, telegramId, text, options = {}) {
  return safeSend(bot, telegramId, text, options);
}

export async function notifyPaymentConfirmed({ userBot, adminBot, userId, proofFileId, user }) {
  const displayName = formatUserName(user, `ID: ${userId}`);
  const username    = user?.username ? `@${user.username}` : null;
  const userLabel   = username ? `${username} (${displayName})` : displayName;

  const userCaption =
    `✅ To'lovingiz tasdiqlandi!\n\n` +
    `👤 ${displayName}\n` +
    `🆔 \`${userId}\`\n\n` +
    `Agar savol bo'lsa admin bilan bog'laning.`;

  const userResult = await safePhoto(userBot, userId, proofFileId, {
    caption: userCaption,
    parse_mode: 'Markdown'
  }, async () => {
    logger.warn('User blocked userBot, cannot deliver payment proof', userId);
    try { await deactivateUser(dbPool, userId); } catch {}
  });

  if (!userResult.success) {
    logger.warn('Payment proof not delivered to user', userId, userResult.error);
  }

  if (config.nodeEnv !== 'production' && config.superAdminId && userId !== config.superAdminId) {
    await safePhoto(adminBot, config.superAdminId, proofFileId, {
      caption: `🔧 *[DEV → ${userId}]* ${userLabel}\n\n${userCaption}`,
      parse_mode: 'Markdown'
    }).catch(() => {});
  }
}

export async function announcePaidPaymentToChannel(adminBot, payment) {
  try {
    if (!payment) return { sent: false, reason: 'no_payment' };
    if (payment.status !== 'paid') return { sent: false, reason: 'not_paid' };
    if (!payment.proof_file_id) return { sent: false, reason: 'no_proof' };

    if (!config.reportChannelId) {
      logger.warn('REPORT_CHANNEL_ID env da belgilanmagan');
      return { sent: false, reason: 'no_report_channel' };
    }

    const name = formatUserName(payment, 'Foydalanuvchi');
    const username = payment.username ? `@${payment.username}` : '—';
    const amount = Number(payment.paid_amount || 0).toLocaleString();
    const date = new Date(payment.updated_at || Date.now()).toLocaleString('uz-UZ', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const caption =
      `✅ *TO'LANDI*\n\n` +
      `👤 *Ism:* ${name}\n` +
      `🆔 *Username:* ${username}\n` +
      `📱 *User ID:* \`${payment.user_id}\`\n` +
      `💰 *Miqdor:* ${amount} so'm\n` +
      `📅 *Sana:* ${date}\n` +
      `📢 *Kampaniya:* ${payment.campaign_name || '—'}`;

    await adminBot.sendPhoto(config.reportChannelId, payment.proof_file_id, {
      caption,
      parse_mode: 'Markdown'
    });

    logger.info(`Report kanalga: user=${payment.user_id}, amount=${amount}`);
    return { sent: true };

  } catch (err) {
    logger.error('announcePaidPaymentToChannel error', err.message);
    return { sent: false, reason: 'error', error: err.message };
  }
}

export async function broadcastMessage(bot, userIds, text, options = {}) {
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((id) => safeSend(bot, id, text, options))
    );
    for (const res of results) {
      if (res.status === 'fulfilled' && res.value?.success) sent++;
      else failed++;
    }
    if (i + BATCH_SIZE < userIds.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
    logger.info('Broadcast progress', { sent, failed, total: userIds.length });
  }
  return { sent, failed };
}

export async function broadcastPhoto(bot, userIds, fileId, options = {}) {
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((id) => safePhoto(bot, id, fileId, options))
    );
    for (const res of results) {
      if (res.status === 'fulfilled' && res.value?.success) sent++;
      else failed++;
    }
    if (i + BATCH_SIZE < userIds.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
    logger.info('Broadcast photo progress', { sent, failed, total: userIds.length });
  }
  return { sent, failed };
}

export async function broadcastCampaignUpdate(bot, client, campaignId, message) {
  const referralQuery = await client.query(
    `SELECT DISTINCT r.referrer_id, u.telegram_id
     FROM referrals r
     JOIN users u ON u.telegram_id = r.referrer_id
     WHERE r.campaign_id = $1 AND u.is_active = true`,
    [campaignId]
  );
  const userIds = (referralQuery.rows || []).map((row) => Number(row.telegram_id));
  return broadcastMessage(bot, userIds, message, {});
}
