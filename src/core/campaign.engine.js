import { query } from '../db/db.js';

export async function getCampaignByCode(campaignCode) {
    // For simplicity, we are mapping campaignCode to id. 
    // In production, campaignCode could be a unique string (e.g., 'summer_promo_2026')
    try {
        const res = await query(`SELECT * FROM campaigns WHERE id = $1 AND is_active = true`, [campaignCode]);
        return res.rows[0] || null;
    } catch (e) {
        return null;
    }
}

export async function createCampaign(name, reward, channelId) {
    const res = await query(
        `INSERT INTO campaigns (name, reward, channel_id) VALUES ($1, $2, $3) RETURNING id`,
        [name, reward, channelId]
    );
    return res.rows[0].id;
}

export async function updateCampaignReward(campaignId, newReward) {
    await query(
        `UPDATE campaigns SET reward = $1, updated_at = NOW() WHERE id = $2`,
        [newReward, campaignId]
    );
    // Ideally, trigger notification engine here to notify users of increased rewards
}

/**
 * Checks if a user is subscribed to the campaign's channel.
 * Uses the userBot Telegraf instance injected via a global or passed parameter.
 */
export async function checkChannelSubscription(bot, userId, channelId) {
    try {
        const member = await bot.telegram.getChatMember(channelId, userId);
        return ['creator', 'administrator', 'member'].includes(member.status);
    } catch (error) {
        console.error(`Failed to check subscription for user ${userId} in channel ${channelId}:`, error);
        return false;
    }
}
