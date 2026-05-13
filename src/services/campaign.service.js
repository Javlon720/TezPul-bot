import { query } from '../db/db.js';

export const campaignService = {
  async findByCode(code) {
    if (!code) return null;
    const res = await query(
      `SELECT * FROM campaigns WHERE (id = $1 OR name = $1 OR channel_id::text = $1) LIMIT 1`,
      [code]
    );
    return res.rows[0] || null;
  },

  async getActiveCampaigns() {
    const res = await query('SELECT * FROM campaigns WHERE is_active = true ORDER BY created_at DESC');
    return res.rows;
  },

  async getCampaignById(id) {
    const res = await query('SELECT * FROM campaigns WHERE id = $1', [id]);
    return res.rows[0] || null;
  },

  async createCampaign(name, reward, channelId) {
    const res = await query(
      `INSERT INTO campaigns (name, reward, channel_id) VALUES ($1, $2, $3) RETURNING *`,
      [name, reward, channelId]
    );
    return res.rows[0];
  }
};
