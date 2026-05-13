import { query } from '../db/db.js';

export const adminService = {
  async isAdminTelegramId(telegramId) {
    const res = await query('SELECT role FROM users WHERE telegram_id = $1', [telegramId]);
    const row = res.rows[0];
    return row && ['admin', 'super_admin'].includes(row.role);
  },

  async isSuperAdminTelegramId(telegramId) {
    const res = await query('SELECT role FROM users WHERE telegram_id = $1', [telegramId]);
    return res.rows.length > 0 && res.rows[0].role === 'super_admin';
  },

  async addAdmin(telegramId, channelName) {
    const userRes = await query(
      `INSERT INTO users (telegram_id, role)
       VALUES ($1, 'admin')
       ON CONFLICT (telegram_id) DO UPDATE SET role = 'admin'
       RETURNING id`,
      [telegramId]
    );
    const userId = userRes.rows[0].id;
    await query('DELETE FROM admin_channels WHERE admin_id = $1', [userId]);
    await query(`INSERT INTO admin_channels (admin_id, channel_name) VALUES ($1, $2)`, [userId, channelName]);
    return userId;
  },

  async getUsersCountByCampaign() {
    const res = await query(
      `SELECT c.name AS campaign_name, COUNT(r.id) AS referrals
       FROM campaigns c
       LEFT JOIN referrals r ON r.campaign_id = c.id
       WHERE c.is_active = true
       GROUP BY c.name`);
    return res.rows;
  },

  async getUsersCount24h() {
    const res = await query(
      `SELECT COUNT(id) AS new_users FROM users WHERE created_at >= NOW() - INTERVAL '24 hours'`);
    return res.rows[0]?.new_users || 0;
  }
};
