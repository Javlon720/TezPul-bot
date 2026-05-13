import { query } from '../db/db.js';

export const userService = {
  async findByTelegramId(telegramId) {
    const res = await query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
    return res.rows[0] || null;
  },

  async createOrUpdateUser({ telegram_id, username, name, phone, language }) {
    const res = await query(
      `INSERT INTO users (telegram_id, username, name, phone, language)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (telegram_id) DO UPDATE SET username = EXCLUDED.username, name = EXCLUDED.name, phone = COALESCE(users.phone, EXCLUDED.phone), language = COALESCE(users.language, EXCLUDED.language)
       RETURNING *`,
      [telegram_id, username, name, phone, language || 'uz']
    );
    return res.rows[0];
  },

  async updatePhone(telegramId, phone) {
    const res = await query('UPDATE users SET phone = $1 WHERE telegram_id = $2 RETURNING *', [phone, telegramId]);
    return res.rows[0] || null;
  },

  async updateLanguage(telegramId, language) {
    const res = await query('UPDATE users SET language = $1 WHERE telegram_id = $2 RETURNING *', [language, telegramId]);
    return res.rows[0] || null;
  },

  async getReferralLink(user, botUsername, campaignCode = 'default') {
    return `https://t.me/${botUsername}?start=ref_${user.telegram_id}_${campaignCode}`;
  },

  async getReferralReport(userId) {
    const referrals = await query(
      `SELECT r.id, u.telegram_id, u.username, u.name, c.name AS campaign_name, r.created_at
       FROM referrals r
       LEFT JOIN users u ON u.id = r.user_id
       LEFT JOIN campaigns c ON c.id = r.campaign_id
       WHERE r.referrer_id = $1`,
      [userId]
    );

    const payments = await query(
      `SELECT COALESCE(SUM(paid_amount), 0) AS paid_amount, COALESCE(SUM(remaining_amount), 0) AS remaining_amount
       FROM payments WHERE user_id = $1`,
      [userId]
    );

    const totals = payments.rows[0] || { paid_amount: 0, remaining_amount: 0 };
    const totalEarned = await query(`SELECT COALESCE(balance, 0) AS balance FROM users WHERE id = $1`, [userId]);

    return {
      total_referrals: referrals.rows.length,
      total_earned: parseFloat(totalEarned.rows[0]?.balance || 0) + parseFloat(totals.paid_amount) + parseFloat(totals.remaining_amount),
      paid_amount: parseFloat(totals.paid_amount),
      remaining_amount: parseFloat(totals.remaining_amount),
      payment_status: totals.remaining_amount === 0 ? 'paid' : totals.paid_amount > 0 ? 'partial' : 'pending',
      referrals: referrals.rows
    };
  },

  async getDirectReferrals(userId) {
    const res = await query(
      `SELECT r.id, u.telegram_id, u.username, u.name, c.name AS campaign_name, c.channel_id
       FROM referrals r
       LEFT JOIN users u ON u.id = r.user_id
       LEFT JOIN campaigns c ON c.id = r.campaign_id
       WHERE r.referrer_id = $1`,
      [userId]
    );
    return res.rows;
  }
};
