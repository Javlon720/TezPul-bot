
import { getReferralsByReferrerId, updateReferralSubscription } from '../db/queries/referrals.queries.js';
import { logger } from '../utils/logger.js';
import { getCampaignById } from '../db/queries/campaigns.queries.js';

const validStatuses = new Set(['member', 'administrator', 'creator']);

export async function checkUserSubscription(bot, telegramId, channelId) {
  try {
    const member = await bot.getChatMember(channelId, telegramId);
    return validStatuses.has(member.status);
  } catch (error) {
    logger.warn('Subscription check failed', { telegramId, channelId, message: error?.message || error });
    return false;
  }
}

export async function checkAllUserSubscriptions(client, bot, referrerTelegramId) {
  const referrals = await getReferralsByReferrerId(client, referrerTelegramId);
  const updates = [];
  for (const referral of referrals) {
    if (!referral.campaign_id) {
      continue;
    }
    const campaign = await getCampaignById(client, referral.campaign_id);
    if (!campaign) {
      continue;
    }
    const subscribed = await checkUserSubscription(bot, referral.referred_id, campaign.channel_id);
    const rewarded = subscribed ? true : referral.is_rewarded;
    if (subscribed !== referral.is_subscribed || rewarded !== referral.is_rewarded) {
      const updated = await updateReferralSubscription(client, referral.id, subscribed, rewarded);
      updates.push(updated);
    }
  }
  return updates;
}
