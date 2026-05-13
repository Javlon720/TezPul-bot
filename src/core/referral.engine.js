import { query } from '../db/db.js';
import { notifyNewReferral } from './notification.engine.js';
import { getCampaignByCode } from './campaign.engine.js';

/**
 * Registers a new user and links them to a referrer if applicable.
 */
export async function registerReferral(newUser, referrerId, campaignCode) {
    // 1. Create or ensure user exists
    const res = await query(
        `INSERT INTO users (telegram_id, username, name, phone) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (telegram_id) DO UPDATE SET name = EXCLUDED.name 
         RETURNING id, balance`,
        [newUser.telegram_id, newUser.username, newUser.name, newUser.phone]
    );
    const userId = res.rows[0].id;

    if (!referrerId || !campaignCode) return { userId };

    // 2. Check if this referral already exists to prevent duplicate rewards
    const existingRef = await query(
        `SELECT id FROM referrals WHERE user_id = $1`,
        [userId]
    );
    if (existingRef.rows.length > 0) {
        return { userId, message: 'Already referred' };
    }

    // 3. Get campaign details
    const campaign = await getCampaignByCode(campaignCode);
    if (!campaign || !campaign.is_active) {
        return { userId, message: 'Invalid or inactive campaign' };
    }

    // 4. Register referral
    await query(
        `INSERT INTO referrals (user_id, referrer_id, campaign_code) VALUES ($1, $2, $3)`,
        [userId, referrerId, campaignCode]
    );

    // 5. Calculate and apply rewards (100% direct, 50% parent)
    const directReward = parseFloat(campaign.reward);
    const parentReward = directReward * 0.5;

    // Apply direct reward to referrer
    await query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [directReward, referrerId]);
    await notifyNewReferral(referrerId, directReward, 1);

    // Check for parent referrer
    const parentRes = await query(
        `SELECT referrer_id FROM referrals WHERE user_id = $1`,
        [referrerId]
    );
    
    if (parentRes.rows.length > 0 && parentRes.rows[0].referrer_id) {
        const parentId = parentRes.rows[0].referrer_id;
        await query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [parentReward, parentId]);
        await notifyNewReferral(parentId, parentReward, 2);
    }

    return { userId, success: true };
}
