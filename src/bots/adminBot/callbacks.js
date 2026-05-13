import { adminService } from '../../services/admin.service.js';
import { adminMainKeyboard, adminUserMenu, adminPaymentsPagination, campaignActions } from './keyboards.js';
import { paymentService } from '../../services/payment.service.js';
import { paymentEngine } from '../../core/payment.engine.js';
import { campaignService } from '../../services/campaign.service.js';
import { campaignEngine } from '../../core/campaign.engine.js';

export async function handleAdminCallback(callbackQuery, { api }) {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const senderId = callbackQuery.from.id;
  if (!(await adminService.isAdminTelegramId(senderId))) {
    return api.answerCallbackQuery(callbackQuery.id, 'Unauthorized');
  }

  if (data === 'admin_back') {
    await api.sendMessage(chatId, 'Admin bosh menyu', { reply_markup: adminMainKeyboard() });
    return api.answerCallbackQuery(callbackQuery.id);
  }

  if (data === 'admin_users') {
    await api.sendMessage(chatId, 'Users panel', { reply_markup: adminUserMenu() });
    return api.answerCallbackQuery(callbackQuery.id);
  }

  if (data === 'admin_users_24h') {
    const count = await adminService.getUsersCount24h();
    await api.sendMessage(chatId, `24 soat ichida yangi foydalanuvchilar: ${count}`, { reply_markup: adminMainKeyboard() });
    return api.answerCallbackQuery(callbackQuery.id);
  }

  if (data === 'admin_users_total') {
    const rows = await adminService.getUsersCountByCampaign();
    const summary = rows.map((row) => `${row.campaign_name}: ${row.referrals}`).join('\n');
    await api.sendMessage(chatId, `Subscribers by campaign:\n${summary}`, { reply_markup: adminMainKeyboard() });
    return api.answerCallbackQuery(callbackQuery.id);
  }

  if (data.startsWith('admin_payments_')) {
    const page = parseInt(data.split('_')[2], 10) || 1;
    const pageData = await paymentService.listPayments(page);
    const lines = pageData.payments.map((item) =>
      `👤 ${item.name || item.username || item.telegram_id}\n` +
      `💰 Total: ${item.total_amount}\n` +
      `✔ Paid: ${item.paid_amount}\n` +
      `⏳ Remaining: ${item.remaining_amount}\n` +
      `Status: ${item.status}`
    );
    await api.sendMessage(chatId, lines.join('\n\n'), { reply_markup: adminPaymentsPagination(pageData.page, pageData.totalPages) });
    return api.answerCallbackQuery(callbackQuery.id);
  }

  if (data.startsWith('payment_paid_') || data.startsWith('payment_wait_') || data.startsWith('payment_cancel_')) {
    const parts = data.split('_');
    const action = parts[1];
    const userId = Number(parts[2]);
    if (!userId) {
      await api.answerCallbackQuery(callbackQuery.id, { text: `❌ Noto'g'ri ma'lumot', show_alert: true `});
      return;
    }
    const status = action === 'wait' ? 'partial' : action === 'cancel' ? 'cancelled' : 'paid';
    await paymentEngine.updatePaymentStatus(userId, status);
    await api.sendMessage(chatId, `Payment ${userId} marked ${status}.`, { reply_markup: adminMainKeyboard() });
    return api.answerCallbackQuery(callbackQuery.id);
  }

  if (data === 'admin_campaigns') {
    const campaigns = await campaignService.getActiveCampaigns();
    const rows = campaigns.map((campaign) => `• ${campaign.name} (${campaign.id}) reward: ${campaign.reward}`);
    if (!campaigns.length) {
      await api.sendMessage(chatId, 'No active campaigns.', { reply_markup: adminMainKeyboard() });
      return api.answerCallbackQuery(callbackQuery.id);
    }
    await api.sendMessage(chatId, `Campaigns:\n${rows.join('\n')}`, { reply_markup: campaignActions(campaigns[0].id) });
    return api.answerCallbackQuery(callbackQuery.id);
  }

  if (data.startsWith('campaign_disable_')) {
    const campaignId = data.split('_')[2];
    await campaignEngine.disableCampaign(campaignId);
    await api.sendMessage(chatId, `Campaign disabled: ${campaignId}`, { reply_markup: adminMainKeyboard() });
    return api.answerCallbackQuery(callbackQuery.id);
  }

  if (data.startsWith('campaign_edit_')) {
    const campaignId = data.split('_')[2];
    await api.sendMessage(chatId, `Use /campaign reward ${campaignId} <new_amount> to update reward.`, { reply_markup: adminMainKeyboard() });
    return api.answerCallbackQuery(callbackQuery.id);
  }

  if (data === 'admin_statistics') {
    const count = await adminService.getUsersCount24h();
    await api.sendMessage(chatId, `Statistics:\n24h new users: ${count}`, { reply_markup: adminMainKeyboard() });
    return api.answerCallbackQuery(callbackQuery.id);
  }

  if (data === 'admin_admins') {
    await api.sendMessage(chatId, 'Super admin can run: /admin add <telegram_id> <channel_name>', { reply_markup: adminMainKeyboard() });
    return api.answerCallbackQuery(callbackQuery.id);
  }

  if (data === 'admin_settings') {
    await api.sendMessage(chatId, 'Settings are managed in backend config.', { reply_markup: adminMainKeyboard() });
    return api.answerCallbackQuery(callbackQuery.id);
  }

  await api.answerCallbackQuery(callbackQuery.id, 'Unknown action');
}
