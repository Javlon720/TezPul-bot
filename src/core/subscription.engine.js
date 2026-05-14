
import { getReferralsByReferrerId, updateReferralSubscription } from '../db/queries/referrals.queries.js';
import { logger } from '../utils/logger.js';
import { getCampaignsByIds, getActiveCampaigns } from '../db/queries/campaigns.queries.js';
import { t } from '../services/i18n.service.js';
import { dbPool } from '../db/pool.js';

const validStatuses = new Set(['member', 'administrator', 'creator']);

async function checkMembership(bot, userId, channelId, failOpen) {
  try {
    const member = await bot.getChatMember(channelId, userId);
    return validStatuses.has(member.status);
  } catch (error) {
    if (!failOpen) {
      logger.warn('Subscription check failed', { userId, channelId, message: error?.message || error });
    }
    return failOpen;
  }
}

export async function checkUserSubscription(bot, telegramId, channelId) {
  return checkMembership(bot, telegramId, channelId, false);
}

export async function requireChannelSubscription(bot, userId, chatId, language) {
  const campaigns = await getActiveCampaigns(dbPool);
  if (!campaigns.length) return true;

  const checks = await Promise.all(
    campaigns
      .filter((c) => c.channel_id)
      .map((c) =>
        checkMembership(bot, userId, c.channel_id, true).then((subscribed) => ({ campaign: c, subscribed }))
      )
  );

  const unsubscribed = checks.filter((r) => !r.subscribed).map((r) => r.campaign);
  if (!unsubscribed.length) return true;

  const text = await t('sub_required', language);
  const channelButtons = unsubscribed.map((c) => {
    const name = c.channel_username ? `@${c.channel_username}` : String(c.channel_id);
    const url = c.channel_username
      ? `https://t.me/${c.channel_username}`
      : `https://t.me/c/${String(c.channel_id).replace('-100', '')}`;
    return [{ text: `📢 ${name}`, url }];
  });
  channelButtons.push([{ text: await t('sub_check_btn', language), callback_data: 'sub_check' }]);

  await bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: channelButtons },
  });
  return false;
}

export async function checkAllUserSubscriptions(client, bot, referrerTelegramId) {
  const referrals = await getReferralsByReferrerId(client, referrerTelegramId);

  const campaignIds = [...new Set(referrals.filter((r) => r.campaign_id).map((r) => r.campaign_id))];
  const campaignRows = await getCampaignsByIds(client, campaignIds);
  const campaignMap = new Map(campaignRows.map((c) => [c.id, c]));

  const updates = [];
  for (const referral of referrals) {
    if (!referral.campaign_id) continue;
    const campaign = campaignMap.get(referral.campaign_id);
    if (!campaign) continue;
    const subscribed = await checkMembership(bot, referral.referred_id, campaign.channel_id, false);
    const rewarded = subscribed ? true : referral.is_rewarded;
    if (subscribed !== referral.is_subscribed || rewarded !== referral.is_rewarded) {
      const updated = await updateReferralSubscription(client, referral.id, subscribed, rewarded);
      updates.push(updated);
    }
  }
  return updates;
}
