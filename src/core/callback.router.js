export async function routeCallback(callbackQuery, bot, handlers) {
  if (!callbackQuery || !callbackQuery.data || !callbackQuery.id || !callbackQuery.from) {
    return;
  }

  const data = callbackQuery.data;
  try {
    if (data.startsWith('lang_') && typeof handlers.handleLanguage === 'function') {
      await handlers.handleLanguage(callbackQuery);
      return;
    }
    if (data.startsWith('admin_lang_') && typeof handlers.handleAdminLanguage === 'function') {
      await handlers.handleAdminLanguage(callbackQuery, data.replace('admin_lang_', ''));
      return;
    }
    if (data.startsWith('admin_mgmt_') && typeof handlers.handleAdminMgmt === 'function') {
      await handlers.handleAdminMgmt(callbackQuery, data.replace('admin_mgmt_', ''));
      return;
    }
    if (data === 'sub_check' && typeof handlers.handleSubCheck === 'function') {
      await handlers.handleSubCheck(callbackQuery);
      return;
    }
    if ((data === 'spin_play' || data === 'spin_history') && typeof handlers.handleSpin === 'function') {
      await handlers.handleSpin(callbackQuery, data);
      return;
    }
    if (
      (data === 'spin_list' || data === 'spin_stats' || data.startsWith('spin_segment_')) &&
      typeof handlers.handleAdminSpin === 'function'
    ) {
      await handlers.handleAdminSpin(callbackQuery, data);
      return;
    }
    if (data.startsWith('spin_wiz_') && typeof handlers.handleSpinWizard === 'function') {
      await handlers.handleSpinWizard(callbackQuery, data.replace('spin_wiz_', ''));
      return;
    }
    if (data.startsWith('payment_paid_') && typeof handlers.handlePaymentAction === 'function') {
      await handlers.handlePaymentAction(callbackQuery, 'paid');
      return;
    }
    if (data.startsWith('payment_wait_') && typeof handlers.handlePaymentAction === 'function') {
      await handlers.handlePaymentAction(callbackQuery, 'partial');
      return;
    }
    if (data.startsWith('payment_cancel_') && typeof handlers.handlePaymentAction === 'function') {
      await handlers.handlePaymentAction(callbackQuery, 'cancelled');
      return;
    }
    if ((data.startsWith('page_prev_') || data.startsWith('page_next_')) && typeof handlers.handlePagination === 'function') {
      await handlers.handlePagination(callbackQuery);
      return;
    }
    if (
      (data === 'campaign_new' || data === 'campaign_save' || data === 'campaign_cancel' ||
       data === 'campaign_ch_forward' || data.startsWith('campaign_ch_')) &&
      typeof handlers.handleCampaignWizard === 'function'
    ) {
      await handlers.handleCampaignWizard(callbackQuery, data);
      return;
    }
    if (typeof handlers.handleUnknown === 'function') {
      await handlers.handleUnknown(callbackQuery);
    }
  } catch (error) {
    if (callbackQuery?.id) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Amal bajarilmadi', show_alert: false }).catch(() => {});
    }
  }
}
