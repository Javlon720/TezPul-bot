
import { transaction } from '../db/pool.js';
import * as userQueries from '../db/queries/users.queries.js';
import * as referralQueries from '../db/queries/referrals.queries.js';
import * as campaignQueries from '../db/queries/campaigns.queries.js';
import { validateCallbackData } from '../utils/validators.js';
import { onReferralAdded } from './spin.engine.js';
import { logger } from '../utils/logger.js';

function createReferralCode(telegramId) {
  const base = Number(telegramId).toString(36).toUpperCase();
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${base}-${suffix}`;
}

export async function generateReferralCode(telegramId) {
  if (!Number.isInteger(telegramId) || telegramId <= 0) {
    throw new Error('Invalid telegramId for referral code generation');
  }
  return transaction(async (client) => {
    let code = createReferralCode(telegramId);
    let existing = await userQueries.getUserByReferralCode(client, code);
    let counter = 0;
    while (existing && counter < 10) {
      code = createReferralCode(telegramId);
      existing = await userQueries.getUserByReferralCode(client, code);
      counter += 1;
    }
    if (existing) {
      throw new Error('Unable to generate unique referral code');
    }
    return code;
  });
}

async function createReferralRecords(client, referrer, referred, campaign) {
  const directReward = campaign ? Number(campaign.reward_amount) : 0;
  await referralQueries.createReferral(client, {
    referrerId: referrer.telegram_id,
    referredId: referred.telegram_id,
    campaignId: campaign?.id || null,
    level: 1,
    rewardAmount: directReward,
    isSubscribed: false,
    isRewarded: false
  });

  if (referrer.referred_by) {
    const parent = await userQueries.getUserByTelegramId(client, referrer.referred_by);
    if (parent) {
      const secondReward = campaign ? Number(campaign.level2_reward_amount) : 0;
      await referralQueries.createReferral(client, {
        referrerId: parent.telegram_id,
        referredId: referred.telegram_id,
        campaignId: campaign?.id || null,
        level: 2,
        rewardAmount: secondReward,
        isSubscribed: false,
        isRewarded: false
      });
    }
  }
}

export async function processReferral(clientOrNull, referredTelegramId, referralCode) {
  if (typeof referralCode !== 'string' || referralCode.trim() === '') {
    return { success: false, reason: 'invalid_referral_code' };
  }
  const sanitizedCode = referralCode.trim();
  if (!validateCallbackData(sanitizedCode)) {
    return { success: false, reason: 'invalid_referral_code' };
  }

  const execute = async (client) => {
    const referrer = await userQueries.getUserByReferralCode(client, sanitizedCode);
    if (!referrer || !referrer.is_active) {
      return { success: false, reason: 'referrer_not_found' };
    }
    if (referrer.telegram_id === referredTelegramId) {
      return { success: false, reason: 'self_referral' };
    }
    const referred = await userQueries.getUserByTelegramId(client, referredTelegramId);
    if (!referred) {
      return { success: false, reason: 'referred_user_missing' };
    }
    const existingReferrals = await referralQueries.getReferralByReferredId(client, referredTelegramId);
    if (existingReferrals.some((row) => row.referrer_id === referrer.telegram_id)) {
      return { success: false, reason: 'already_referred' };
    }
    const campaign = await campaignQueries.getDefaultActiveCampaign(client);
    await userQueries.createOrUpdateUser(client, referred, referred.referral_code, referrer.telegram_id);
    await createReferralRecords(client, referrer, referred, campaign);
    return { success: true, referrerId: referrer.telegram_id, referrerTelegramId: referrer.telegram_id };
  };

  let result;
  if (clientOrNull) {
    result = await execute(clientOrNull);
  } else {
    result = await transaction(execute);
  }

  if (result.success && result.referrerTelegramId) {
    try {
      await onReferralAdded(result.referrerTelegramId);
    } catch (spinErr) {
      logger.warn('spin.onReferralAdded failed', spinErr.message);
    }
  }

  return result;
}

export async function checkAndUpdateSubscriptions(client, bot, referrerTelegramId) {
  const referrals = await referralQueries.getReferralsByReferrerId(client, referrerTelegramId);
  const updates = [];
  for (const referral of referrals) {
    if (!referral.campaign_id) {
      continue;
    }
    try {
      const member = await bot.getChatMember(referral.channel_id, referral.referred_id);
      const subscribed = ['creator', 'administrator', 'member'].includes(member.status);
      if (subscribed !== referral.is_subscribed || (subscribed && !referral.is_rewarded)) {
        const updated = await referralQueries.updateReferralSubscription(client, referral.id, subscribed, subscribed);
        updates.push(updated);
      }
    } catch (error) {
      // ignore individual failures; keep stable
    }
  }
  return updates;
}
