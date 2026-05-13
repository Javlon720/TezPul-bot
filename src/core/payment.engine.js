
import { transaction } from '../db/pool.js';
import * as paymentQueries from '../db/queries/payments.queries.js';

export async function recordPayment(userId, amount, proofFileId, notes = null) {
  if (!proofFileId) throw new Error('Proof rasm file_id majburiy');
  return transaction(async (client) => {
    const payment = await paymentQueries.getPaymentByUserId(client, userId);
    if (!payment) {
      await paymentQueries.ensurePaymentRecord(client, userId);
    }
    return paymentQueries.updatePaymentPaid(client, userId, amount, proofFileId, notes);
  });
}

export async function cancelPayment(userId) {
  return transaction(async (client) => paymentQueries.cancelPayment(client, userId));
}

export async function updatePaymentStatus(userId, status) {
  return transaction(async (client) => paymentQueries.updatePaymentStatus(client, userId, status));
}

export async function getPaymentStatus(userId) {
  return transaction(async (client) => {
    const payment = await paymentQueries.getPaymentByUserId(client, userId);
    if (!payment) {
      return await paymentQueries.ensurePaymentRecord(client, userId);
    }
    return payment;
  });
}
