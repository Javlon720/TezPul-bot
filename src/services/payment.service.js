import { query } from '../db/db.js';

export const paymentService = {
  async getLastPaymentProof(userId) {
    const res = await query(
      `SELECT proof_file_id, paid_amount, remaining_amount, status, proof_updated_at, updated_at
       FROM payments WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [userId]
    );
    return res.rows[0] || null;
  },

  async listPayments(page = 1, pageSize = 5) {
    const offset = (page - 1) * pageSize;
    const res = await query(
      `SELECT p.id, p.user_id, p.total_amount, p.paid_amount, p.remaining_amount, p.status,
            u.telegram_id, u.username,
            COALESCE(u.username, u.first_name || ' ' || u.last_name, u.telegram_id::text) AS name
       FROM payments p
       LEFT JOIN users u ON u.telegram_id = p.user_id
       ORDER BY p.created_at DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    const countRes = await query('SELECT COUNT(*) AS total FROM payments');
    const total = parseInt(countRes.rows[0].total, 10);
    return {
      payments: res.rows,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    };
  }
};
