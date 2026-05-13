import { buildInlineKeyboard } from '../../utils/telegram.js';

export function adminMainKeyboard() {
  return buildInlineKeyboard([
    [{ text: '👥 Users', callback_data: 'admin_users' }],
    [{ text: '📊 Statistics', callback_data: 'admin_statistics' }],
    [{ text: '💰 Payments', callback_data: 'admin_payments_1' }],
    [{ text: '📢 Campaigns', callback_data: 'admin_campaigns' }],
    [{ text: '🔐 Admins', callback_data: 'admin_admins' }],
    [{ text: '⚙️ Settings', callback_data: 'admin_settings' }]
  ]);
}

export function adminUserMenu() {
  return buildInlineKeyboard([
    [{ text: '24h', callback_data: 'admin_users_24h' }, { text: 'Total', callback_data: 'admin_users_total' }],
    [{ text: '◀ Back', callback_data: 'admin_back' }]
  ]);
}

export function adminPaymentsPagination(page, totalPages) {
  const buttons = [];
  if (page > 1) buttons.push({ text: '⬅ Prev', callback_data: `admin_payments_${page - 1}` });
  if (page < totalPages) buttons.push({ text: 'Next ➡', callback_data: `admin_payments_${page + 1}` });
  return buildInlineKeyboard([buttons, [{ text: '◀ Back', callback_data: 'admin_back' }]]);
}

export function paymentActionButtons(userId) {
  return buildInlineKeyboard([
    [{ text: "✅ To'landi", callback_data: `payment_paid_${userId}` }],
    [{ text: '⏳ Kutish', callback_data: `payment_wait_${userId}` }],
    [{ text: '❌ Bekor', callback_data: `payment_cancel_${userId}` }],
    [{ text: '◀ Back', callback_data: 'admin_payments_1' }]
  ]);
}

export function campaignActions(campaignId) {
  return buildInlineKeyboard([
    [{ text: 'Edit reward', callback_data: `campaign_edit_${campaignId}` }],
    [{ text: 'Disable', callback_data: `campaign_disable_${campaignId}` }],
    [{ text: '◀ Back', callback_data: 'admin_back' }]
  ]);
}
