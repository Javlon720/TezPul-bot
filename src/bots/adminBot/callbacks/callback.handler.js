import { routeCallback } from '../../../core/callback.router.js';
import { recordPayment, cancelPayment, updatePaymentStatus } from '../../../core/payment.engine.js';
import { getAdminState, setAdminState, resetAdminState, setAdminLanguage, getAdminLanguage } from '../../../db/queries/admin_states.queries.js';
import { adminMainKeyboard } from '../keyboards/main.keyboard.js';
import { getActiveSegments, getSpinStats, updateSegment } from '../../../db/queries/spin.queries.js';
import { getUserByTelegramId } from '../../../db/queries/users.queries.js';
import { getPaymentWithUserAndCampaign } from '../../../db/queries/payments.queries.js';
import { listAdmins, addAdmin, removeAdmin } from '../../../db/queries/admins.queries.js';
import { getActiveBotChannels, getBotChannelById } from '../../../db/queries/bot_channels.queries.js';
import { query } from '../../../db/pool.js';
import { notifyPaymentConfirmed, announcePaidPaymentToChannel } from '../../../core/notification.engine.js';
import { config } from '../../../config/index.js';
import { ta } from '../../../services/admin-i18n.service.js';
import { dbPool } from '../../../db/pool.js';
import { logger } from '../../../utils/logger.js';

const COLORS = {
  green:  { hex: '#1D9E75', label: '🟢 Yashil'  },
  purple: { hex: '#534AB7', label: '🟣 Binafsha' },
  red:    { hex: '#E24B4A', label: '🔴 Qizil'   },
  blue:   { hex: '#185FA5', label: '🔵 Ko\'k'   },
  gold:   { hex: '#BA7517', label: '🟡 Oltin'   },
  gray:   { hex: '#D3D1C7', label: '⬜ Kulrang'  },
};

const VALUE_EXAMPLES = { pul: '5000', premium: '1 oy', bonus_spin: '1' };
const LABEL_EXAMPLES = { pul: '5 000', premium: 'Premium', bonus_spin: '+1 Spin' };

function colorLabel(hex) {
  const entry = Object.values(COLORS).find((c) => c.hex === hex);
  return entry ? entry.label : hex;
}

function typeButtons(lang) {
  return {
    inline_keyboard: [
      [
        { text: '💰 Pul',       callback_data: 'spin_wiz_type_pul'   },
        { text: '👑 Premium',   callback_data: 'spin_wiz_type_premium' },
      ],
      [
        { text: '🎁 Bonus spin', callback_data: 'spin_wiz_type_bonus' },
        { text: '❌ Miss',       callback_data: 'spin_wiz_type_miss'  },
      ],
      [{ text: ta('btn_cancel', lang), callback_data: 'spin_wiz_cancel' }],
    ],
  };
}

export function colorButtons(lang) {
  return {
    inline_keyboard: [
      [
        { text: COLORS.green.label,  callback_data: 'spin_wiz_col_green'  },
        { text: COLORS.purple.label, callback_data: 'spin_wiz_col_purple' },
      ],
      [
        { text: COLORS.red.label,    callback_data: 'spin_wiz_col_red'    },
        { text: COLORS.blue.label,   callback_data: 'spin_wiz_col_blue'   },
      ],
      [
        { text: COLORS.gold.label,   callback_data: 'spin_wiz_col_gold'   },
        { text: COLORS.gray.label,   callback_data: 'spin_wiz_col_gray'   },
      ],
      [{ text: ta('btn_cancel', lang), callback_data: 'spin_wiz_cancel' }],
    ],
  };
}

function confirmButtons(lang) {
  return {
    inline_keyboard: [
      [{ text: ta('btn_confirm', lang), callback_data: 'spin_wiz_ok' }],
      [
        { text: ta('btn_cancel',  lang), callback_data: 'spin_wiz_cancel'  },
        { text: ta('btn_restart', lang), callback_data: 'spin_wiz_restart' },
      ],
    ],
  };
}

export async function handleAdminCallback(bot, callbackQuery) {
  await routeCallback(callbackQuery, bot, {

    handleAdminLanguage: async (query, lang) => {
      const supported = ['uz', 'ru', 'en'];
      if (!supported.includes(lang)) return;
      await bot.answerCallbackQuery(query.id, { text: ta('lang_changed', lang), show_alert: false });
      await setAdminLanguage(query.from.id, lang);
      await bot.sendMessage(query.message.chat.id, ta('lang_changed', lang), {
        parse_mode: 'Markdown',
        reply_markup: adminMainKeyboard(lang)
      });
    },

    handlePaymentAction: async (query, action) => {
      const parts = query.data.split('_');
      const userId = Number(parts[2]);
      const lang = await getAdminLanguage(query.from.id);

      if (!userId) {
        await bot.answerCallbackQuery(query.id, { text: ta('error', lang), show_alert: true });
        return;
      }
      if (action === 'cancelled') {
        await cancelPayment(userId);
        await bot.answerCallbackQuery(query.id, { text: ta('payment_cancelled_ok', lang), show_alert: false });
        return;
      }
      if (action === 'paid') {
        await setAdminState(query.from.id, 'WAITING_PROOF', { userId });
        await bot.answerCallbackQuery(query.id, { text: ta('payment_proof_request', lang), show_alert: false });
        await bot.sendMessage(query.message.chat.id,
          `📸 *To'lov tasdiqlovchi rasmni yuboring*\n\nFoydalanuvchi: \`${userId}\``,
          { parse_mode: 'Markdown' }
        );
        return;
      }
      if (action === 'partial') {
        await updatePaymentStatus(userId, 'partial');
        await bot.answerCallbackQuery(query.id, { text: ta('payment_partial_ok', lang), show_alert: false });
        return;
      }
    },

    handleAdminSpin: async (query, data) => {
      const chatId = query.message.chat.id;
      const adminId = query.from.id;
      const lang = await getAdminLanguage(adminId);

      if (data === 'spin_list') {
        await bot.answerCallbackQuery(query.id);
        const segments = await getActiveSegments(dbPool);
        const buttons = segments.map((s) => [{
          text: `${s.label} (${s.type})`,
          callback_data: `spin_segment_${s.id}`
        }]);
        buttons.push([{ text: '📊 Statistika', callback_data: 'spin_stats' }]);
        await bot.sendMessage(chatId,
          `🎰 *Spin sektorlari* (${segments.length} ta)\n\nTahrirlash uchun bosing:`,
          { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }
        );
        return;
      }

      if (data === 'spin_stats') {
        await bot.answerCallbackQuery(query.id);
        const stats = await getSpinStats(dbPool);
        await bot.sendMessage(chatId,
          `📊 *Spin statistikasi*\n\n` +
          `• Jami spin: \`${stats.total_spins}\`\n` +
          `• Yutganlar: \`${stats.total_wins}\`\n` +
          `• Miss: \`${stats.total_miss}\`\n` +
          `• Berilgan pul: \`${Number(stats.total_money || 0).toLocaleString()} so'm\``,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      if (data.startsWith('spin_segment_')) {
        const segmentId = Number(data.split('_')[2]);
        await bot.answerCallbackQuery(query.id);
        await setAdminState(adminId, 'SPIN_WIZARD', { step: 'TYPE', segmentId });
        await bot.sendMessage(chatId,
          ta('spin_select_type', lang, { id: segmentId }),
          { parse_mode: 'Markdown', reply_markup: typeButtons(lang) }
        );
        return;
      }
    },

    handleAdminMgmt: async (query, action) => {
      const chatId = query.message.chat.id;
      const adminId = query.from.id;
      const lang = await getAdminLanguage(adminId);

      if (action === 'list') {
        await bot.answerCallbackQuery(query.id);
        const admins = await listAdmins(dbPool);
        const list = admins.length
          ? admins.map((a) => `• \`${a.admin_telegram_id}\` | Kanal: \`${a.channel_id}\``).join('\n')
          : ta('admins_none', lang);
        await bot.sendMessage(chatId,
          ta('admins_list_header', lang, { count: admins.length }) + `\n\n${list}`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: ta('admin_btn_add',    lang), callback_data: 'admin_mgmt_add'    },
                  { text: ta('admin_btn_remove', lang), callback_data: 'admin_mgmt_remove' },
                ],
                [{ text: ta('admin_btn_list', lang), callback_data: 'admin_mgmt_list' }],
              ]
            }
          }
        );
        return;
      }

      if (Number(adminId) !== Number(config.superAdminId)) {
        await bot.answerCallbackQuery(query.id, { text: ta('admin_only_super', lang), show_alert: true });
        return;
      }

      if (action === 'add') {
        await bot.answerCallbackQuery(query.id);
        await setAdminState(adminId, 'ADMIN_ADD_WIZARD', { step: 'ID', lang });
        await bot.sendMessage(chatId, ta('admin_enter_id', lang), {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: ta('btn_cancel', lang), callback_data: 'admin_mgmt_cancel' }]] }
        });
        return;
      }

      if (action === 'remove') {
        await bot.answerCallbackQuery(query.id);
        await setAdminState(adminId, 'ADMIN_REMOVE_WIZARD', { step: 'ID', lang });
        await bot.sendMessage(chatId, ta('admin_remove_enter', lang), {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: ta('btn_cancel', lang), callback_data: 'admin_mgmt_cancel' }]] }
        });
        return;
      }

      if (action === 'cancel') {
        await bot.answerCallbackQuery(query.id);
        await resetAdminState(adminId);
        await bot.sendMessage(chatId, ta('admin_cancelled', lang), { parse_mode: 'Markdown' });
        return;
      }
    },

    handleSpinWizard: async (query, action) => {
      const chatId = query.message.chat.id;
      const adminId = query.from.id;
      const lang = await getAdminLanguage(adminId);
      const state = await getAdminState(adminId);
      const d = state.state_data || {};

      await bot.answerCallbackQuery(query.id);

      if (action === 'cancel') {
        await resetAdminState(adminId);
        await bot.sendMessage(chatId, ta('spin_cancelled', lang), { parse_mode: 'Markdown' });
        return;
      }
      if (action === 'restart') {
        await setAdminState(adminId, 'SPIN_WIZARD', { step: 'TYPE', segmentId: d.segmentId });
        await bot.sendMessage(chatId,
          ta('spin_select_type', lang, { id: d.segmentId }),
          { parse_mode: 'Markdown', reply_markup: typeButtons(lang) }
        );
        return;
      }

      if (action.startsWith('type_')) {
        const typeMap = { type_pul: 'pul', type_premium: 'premium', type_bonus: 'bonus_spin', type_miss: 'miss' };
        const type = typeMap[action];
        if (!type) return;

        if (type === 'miss') {
          await setAdminState(adminId, 'SPIN_WIZARD', { ...d, step: 'COLOR', type, value: '', label: 'Miss' });
          await bot.sendMessage(chatId, ta('spin_select_color', lang), { parse_mode: 'Markdown', reply_markup: colorButtons(lang) });
        } else {
          await setAdminState(adminId, 'SPIN_WIZARD', { ...d, step: 'VALUE', type });
          await bot.sendMessage(chatId,
            ta('spin_enter_value', lang, { example: VALUE_EXAMPLES[type] || '' }),
            { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: ta('btn_cancel', lang), callback_data: 'spin_wiz_cancel' }]] } }
          );
        }
        return;
      }

      if (action.startsWith('col_')) {
        const colorKey = action.replace('col_', '');
        const color = COLORS[colorKey]?.hex || '#D3D1C7';
        const newD = { ...d, step: 'CONFIRM', color };
        await setAdminState(adminId, 'SPIN_WIZARD', newD);
        await bot.sendMessage(chatId,
          ta('spin_confirm', lang, {
            type:  newD.type,
            value: newD.value || '—',
            label: newD.label,
            color: `${colorLabel(color)} \`${color}\``
          }),
          { parse_mode: 'Markdown', reply_markup: confirmButtons(lang) }
        );
        return;
      }

      if (action === 'ok') {
        if (!d.segmentId || !d.type) {
          await bot.sendMessage(chatId, ta('error', lang));
          await resetAdminState(adminId);
          return;
        }
        try {
          const updated = await updateSegment(dbPool, d.segmentId, d.type, d.value || '', d.label || d.value || '', d.color || '#D3D1C7');
          await resetAdminState(adminId);
          await bot.sendMessage(chatId,
            ta('spin_saved', lang, { id: d.segmentId, type: updated.type, value: updated.value, label: updated.label }),
            { parse_mode: 'Markdown' }
          );
        } catch (err) {
          logger.error('spin wizard save error', err.message);
          await bot.sendMessage(chatId, ta('error', lang));
          await resetAdminState(adminId);
        }
        return;
      }
    },

    handleCampaignWizard: async (cbQuery, data) => {
      const chatId = cbQuery.message.chat.id;
      const adminId = cbQuery.from.id;
      await bot.answerCallbackQuery(cbQuery.id);

      if (data === 'campaign_new') {
        await setAdminState(adminId, 'WAITING_CAMPAIGN_NAME', {});
        await bot.sendMessage(chatId,
          `1️⃣ *Kampaniya nomi*\n\nKampaniya nomini yuboring.\n\nMisol: \`Mart promo 2026\`\n\n_Bekor: /cancel yoki menyu tugmasi_`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      if (data === 'campaign_ch_forward') {
        const state = await getAdminState(adminId);
        await setAdminState(adminId, 'WAITING_CAMPAIGN_CHANNEL', { ...state.state_data, mode: 'forward' });
        await bot.sendMessage(chatId,
          `📤 *Kanal forward*\n\nKampaniya kanalidan istalgan xabarni shu yerga forward qiling.`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      if (data.startsWith('campaign_ch_') && data !== 'campaign_ch_forward') {
        const channelId = Number(data.replace('campaign_ch_', ''));
        const channel = await getBotChannelById(dbPool, channelId);
        if (!channel) {
          await bot.sendMessage(chatId, `❌ Kanal topilmadi`);
          return;
        }
        const state = await getAdminState(adminId);
        await setAdminState(adminId, 'WAITING_CAMPAIGN_LEVEL1', {
          name: state.state_data?.name,
          channel_id: channel.channel_id,
          channel_username: channel.channel_username,
          channel_title: channel.channel_title,
        });
        await bot.sendMessage(chatId,
          `✓ Kanal: *${channel.channel_title || channel.channel_username || channel.channel_id}*\n\n3️⃣ *Level 1 mukofot (so'm)*\n\nTo'g'ridan taklif qilingan do'st uchun.\n\nMisol: \`3000\``,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      if (data === 'campaign_save') {
        const state = await getAdminState(adminId);
        const d = state.state_data || {};
        try {
          await query(
            `INSERT INTO campaigns (name, channel_id, channel_username, reward_amount, level2_reward_amount, is_active)
             VALUES ($1, $2, $3, $4, $5, true)`,
            [d.name, d.channel_id, d.channel_username, d.reward_amount, d.level2_reward_amount]
          );
          await resetAdminState(adminId);
          await bot.sendMessage(chatId,
            `✅ *Kampaniya yaratildi!*\n\n*${d.name}*\n\nEndi foydalanuvchilar shu kampaniyadan referral mukofot oladi.`,
            { parse_mode: 'Markdown' }
          );
        } catch (err) {
          logger.error('Campaign save error', err.message);
          await bot.sendMessage(chatId, `❌ Saqlashda xatolik: ${err.message}`);
        }
        return;
      }

      if (data === 'campaign_cancel') {
        await resetAdminState(adminId);
        await bot.sendMessage(chatId, `❌ Kampaniya yaratish bekor qilindi.`);
        return;
      }
    },

    handlePagination: async (cbQuery) => {
      await bot.answerCallbackQuery(cbQuery.id, { text: "📄 Sahifa o'zgartirildi", show_alert: false });
    },
    handleUnknown: async (cbQuery) => {
      await bot.answerCallbackQuery(cbQuery.id, { text: "❌ Noma'lum amal", show_alert: false });
    }
  });
}

export async function handleAdminPhoto(bot, msg, userBot) {
  if (!msg?.from?.id || !msg?.photo?.length) return;

  const adminId = msg.from.id;
  const chatId = msg.chat.id;
  const adminState = await getAdminState(adminId);
  if (adminState.state !== 'WAITING_PROOF') return;

  const userId = adminState.state_data?.userId;
  if (!userId) {
    await bot.sendMessage(chatId, "❌ Xatolik: userId topilmadi. Qaytadan 'To'landi' bosing.");
    await resetAdminState(adminId);
    return;
  }

  const proofFileId = msg.photo[msg.photo.length - 1].file_id;
  await recordPayment(userId, 0, proofFileId);
  await resetAdminState(adminId);

  const [user, paymentData] = await Promise.all([
    getUserByTelegramId(dbPool, userId).catch(() => null),
    getPaymentWithUserAndCampaign(dbPool, userId).catch(() => null),
  ]);

  notifyPaymentConfirmed({ userBot, adminBot: bot, userId, proofFileId, user }).catch((err) => {
    logger.error('notifyPaymentConfirmed failed', err.message);
  });

  announcePaidPaymentToChannel(bot, { ...paymentData, proof_file_id: proofFileId }).catch((err) => {
    logger.error('announcePaidPaymentToChannel failed', err.message);
  });

  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || String(userId);
  const username = user?.username ? ` (@${user.username.replace(/_/g, '\\_')})` : '';
  await bot.sendMessage(chatId,
    `✅ *To'lov tasdiqlandi!*\n\n` +
    `👤 ${displayName}${username}\n` +
    `🆔 \`${userId}\`\n\n` +
    `📲 Foydalanuvchiga rasm yuborildi\n` +
    `📢 Kanalga hisobot yuborildi`,
    { parse_mode: 'Markdown' }
  );
}
