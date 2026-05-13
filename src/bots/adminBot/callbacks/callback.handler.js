
import { routeCallback } from '../../../core/callback.router.js';
import { recordPayment, cancelPayment, updatePaymentStatus } from '../../../core/payment.engine.js';
import { getAdminState, setAdminState, resetAdminState } from '../../../db/queries/admin_states.queries.js';

export async function handleAdminCallback(bot, callbackQuery) {
  await routeCallback(callbackQuery, bot, {
    handlePaymentAction: async (query, action) => {
      const parts = query.data.split('_');
      const userId = Number(parts[2]);
      if (!userId) {
        await bot.answerCallbackQuery(query.id, { text: "❌ Noto'g'ri ma'lumot", show_alert: true });
        return;
      }
      if (action === 'cancelled') {
        await cancelPayment(userId);
        await bot.answerCallbackQuery(query.id, { text: "❌ To'lov bekor qilindi", show_alert: false });
        return;
      }
      if (action === 'paid') {
        await setAdminState(query.from.id, 'WAITING_PROOF', { userId });
        await bot.answerCallbackQuery(query.id, { text: "📸 Rasm yuboring", show_alert: false });
        await bot.sendMessage(query.message.chat.id,
          `📸 *To'lov tasdiqlovchi rasmni yuboring*\n\nFoydalanuvchi: \`${userId}\``,
          { parse_mode: 'Markdown' }
        );
        return;
      }
      if (action === 'partial') {
        await updatePaymentStatus(userId, 'partial');
        await bot.answerCallbackQuery(query.id, { text: "⏳ To'lov kutish holatiga qaytarildi", show_alert: false });
        return;
      }
    },
    handlePagination: async (query) => {
      await bot.answerCallbackQuery(query.id, { text: "📄 Sahifa o'zgartirildi", show_alert: false });
    },
    handleUnknown: async (query) => {
      await bot.answerCallbackQuery(query.id, { text: "❌ Noma'lum amal", show_alert: false });
    }
  });
}

export async function handleAdminPhoto(bot, msg) {
  if (!msg?.from?.id || !msg?.photo?.length) return;

  const adminId = msg.from.id;
  const adminState = await getAdminState(adminId);
  if (adminState.state !== 'WAITING_PROOF') return;

  const userId = adminState.state_data?.userId;
  if (!userId) {
    await bot.sendMessage(msg.chat.id, "❌ Xatolik: userId topilmadi. Qaytadan 'To'landi' bosing.");
    await resetAdminState(adminId);
    return;
  }

  const proofFileId = msg.photo[msg.photo.length - 1].file_id;
  await recordPayment(userId, 0, proofFileId);
  await resetAdminState(adminId);

  await bot.sendMessage(msg.chat.id,
    `✅ *To'lov tasdiqlandi!*\n👤 User: \`${userId}\`\n📸 Proof saqlandi`,
    { parse_mode: 'Markdown' }
  );
}
