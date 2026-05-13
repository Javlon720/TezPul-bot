import { query } from '../db/db.js';
import { notifyPaymentUpdate } from './notification.engine.js';

export async function createPaymentRequest(userId, amount) {
    // Check if user has enough balance
    const userRes = await query(`SELECT balance FROM users WHERE id = $1`, [userId]);
    const balance = parseFloat(userRes.rows[0].balance);
    
    if (balance < amount) throw new Error('Insufficient balance');

    // Deduct balance and create pending payment
    await query(`UPDATE users SET balance = balance - $1 WHERE id = $2`, [amount, userId]);
    
    const paymentRes = await query(
        `INSERT INTO payments (user_id, total_amount, remaining_amount, status) 
         VALUES ($1, $2, $2, 'pending') RETURNING id`,
        [userId, amount]
    );
    return paymentRes.rows[0].id;
}

export async function processPartialPayment(paymentId, amount, fileId) {
    // 1. Get payment info
    const payRes = await query(`SELECT * FROM payments WHERE id = $1`, [paymentId]);
    if (payRes.rows.length === 0) throw new Error('Payment not found');
    
    const payment = payRes.rows[0];
    const newPaid = parseFloat(payment.paid_amount) + amount;
    const newRemaining = parseFloat(payment.remaining_amount) - amount;
    
    let newStatus = 'partial';
    if (newRemaining <= 0) {
        newStatus = 'paid';
    }

    // 2. Update payment record
    await query(
        `UPDATE payments 
         SET paid_amount = $1, remaining_amount = $2, status = $3, proof_image = $4, updated_at = NOW() 
         WHERE id = $5`,
        [newPaid, newRemaining, newStatus, fileId, paymentId]
    );

    // 3. Notify user
    await notifyPaymentUpdate(payment.user_id, {
        paymentId,
        amountPaid: amount,
        status: newStatus,
        fileId
    });

    return { status: newStatus, remaining: newRemaining };
}
