
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
