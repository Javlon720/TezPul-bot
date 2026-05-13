
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
    if (typeof handlers.handleUnknown === 'function') {
      await handlers.handleUnknown(callbackQuery);
      return;
    }
  } catch (error) {
    if (callbackQuery && callbackQuery.id) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Amal bajarilmadi', show_alert: false });
    }
  }
}
