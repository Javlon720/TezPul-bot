
export async function getPaymentByUserId(client, userId) {
  const result = await client.query(
    'SELECT * FROM payments WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  return result.rows[0] || null;
}

export async function ensurePaymentRecord(client, userId) {
  const existing = await getPaymentByUserId(client, userId);
  if (existing) {
    return existing;
  }
  const result = await client.query(
    `INSERT INTO payments (user_id, total_amount, paid_amount, status)
     VALUES ($1, 0, 0, 'pending') RETURNING *`,
    [userId]
  );
  return result.rows[0];
}

export async function updatePaymentPaid(client, userId, amount, proofFileId = null, notes = null) {
  if (!proofFileId) throw new Error('proofFileId majburiy');
  const payment = await ensurePaymentRecord(client, userId);
  const totalAmount = Number(payment.total_amount || 0);
  const paidAmount = Number(payment.paid_amount || 0) + Number(amount || 0);
  const finalPaidAmount = proofFileId ? (paidAmount <= 0 ? totalAmount : paidAmount) : paidAmount;
  const status = proofFileId ? 'paid' : finalPaidAmount <= 0 ? 'pending' : finalPaidAmount >= totalAmount ? 'paid' : 'partial';
  const result = await client.query(
    `UPDATE payments SET paid_amount = $1, status = $2, proof_file_id = $3, proof_updated_at = NOW(), notes = COALESCE($4, notes), updated_at = NOW()
     WHERE user_id = $5 RETURNING *`,
    [finalPaidAmount, status, proofFileId, notes, userId]
  );
  return result.rows[0];
}

export async function updatePaymentStatus(client, userId, status) {
  await ensurePaymentRecord(client, userId);
  const result = await client.query(
    `UPDATE payments SET status = $1, updated_at = NOW() WHERE user_id = $2 RETURNING *`,
    [status, userId]
  );
  return result.rows[0] || null;
}

export async function cancelPayment(client, userId) {
  const result = await client.query(
    `UPDATE payments SET status = 'cancelled', updated_at = NOW() WHERE user_id = $1 RETURNING *`,
    [userId]
  );
  return result.rows[0] || null;
}

export async function listPayments(client, limit = 10, offset = 0) {
  const result = await client.query(
    'SELECT * FROM payments ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  return result.rows;
}

export async function listPaymentsWithUsers(client, limit = 10, offset = 0) {
  const result = await client.query(
    `SELECT p.*, u.username, u.first_name, u.last_name, u.phone
     FROM payments p
     LEFT JOIN users u ON u.telegram_id = p.user_id
     ORDER BY
       CASE p.status WHEN 'pending' THEN 0 WHEN 'partial' THEN 1 ELSE 2 END,
       p.updated_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows;
}

export async function getPaymentsStats(client) {
  const result = await client.query(
    `SELECT
       COUNT(*)                                             AS total,
       COUNT(*) FILTER (WHERE status = 'pending')          AS pending,
       COUNT(*) FILTER (WHERE status = 'partial')          AS partial,
       COUNT(*) FILTER (WHERE status = 'paid')             AS paid,
       COUNT(*) FILTER (WHERE status = 'cancelled')        AS cancelled,
       COALESCE(SUM(paid_amount) FILTER (WHERE status = 'paid'), 0) AS total_paid
     FROM payments`
  );
  return result.rows[0];
}

export async function getPaymentWithUserAndCampaign(client, userId) {
  const result = await client.query(
    `SELECT p.*,
            u.username, u.first_name, u.last_name, u.phone,
            c.name AS campaign_name, c.channel_id AS campaign_channel_id,
            c.channel_username AS campaign_channel_username
     FROM payments p
     LEFT JOIN users u ON u.telegram_id = p.user_id
     LEFT JOIN referrals r ON r.referred_id = p.user_id AND r.level = 1
     LEFT JOIN campaigns c ON c.id = r.campaign_id
     WHERE p.user_id = $1
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

export async function countPayments(client) {
  const result = await client.query('SELECT COUNT(*) AS cnt FROM payments');
  return Number(result.rows[0]?.cnt || 0);
}
