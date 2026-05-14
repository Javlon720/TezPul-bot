import TelegramBot from 'node-telegram-bot-api';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { handleAdminCommand, handleAdminAdd, handleAdminRemove, handleAdminList } from './commands/admin.command.js';
import { handleAdminCallback, handleAdminPhoto, colorButtons } from './callbacks/callback.handler.js';
import { adminAuthMiddleware } from './middlewares/adminAuth.middleware.js';
import { adminMainKeyboard } from './keyboards/main.keyboard.js';
import { paymentActionButtons } from './keyboards.js';
import { getAdminState, resetAdminState, setAdminState, getAdminLanguage } from '../../db/queries/admin_states.queries.js';
import { getUserStats } from '../../db/queries/users.queries.js';
import { listPaymentsWithUsers, getPaymentsStats, countPayments } from '../../db/queries/payments.queries.js';
import { listCampaigns } from '../../db/queries/campaigns.queries.js';
import { listAdmins, addAdmin, removeAdmin } from '../../db/queries/admins.queries.js';
import { getSpinStats, getActiveSegments, updateSegment } from '../../db/queries/spin.queries.js';
import { ta } from '../../services/admin-i18n.service.js';
import { dbPool } from '../../db/pool.js';
import { getActiveBotChannels } from '../../db/queries/bot_channels.queries.js';

// Build reverse map: any translated button text → canonical action name
const BUTTON_ACTIONS = ['users', 'statistics', 'payments', 'campaigns', 'spin', 'admins', 'settings', 'language'];
const BUTTON_MAP = new Map();
for (const lang of ['uz', 'ru', 'en']) {
  for (const action of BUTTON_ACTIONS) {
    BUTTON_MAP.set(ta(`btn_${action}`, lang), action);
  }
}

function md(text) {
  if (text === null || text === undefined) return '';
  return String(text).replace(/[_*`[]/g, '\\$&');
}

async function sendAdminMenu(bot, chatId, lang = 'uz', text = '🔐 Admin panel:') {
  await bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: adminMainKeyboard(lang)
  });
}

function adminMgmtButtons(lang) {
  return {
    inline_keyboard: [
      [
        { text: ta('admin_btn_add',    lang), callback_data: 'admin_mgmt_add'    },
        { text: ta('admin_btn_remove', lang), callback_data: 'admin_mgmt_remove' },
      ],
      [{ text: ta('admin_btn_list', lang), callback_data: 'admin_mgmt_list' }],
    ]
  };
}

async function handleButtonPress(bot, chatId, adminId, action) {
  const lang = await getAdminLanguage(adminId);

  switch (action) {

    case 'users': {
      const s = await getUserStats(dbPool);
      await bot.sendMessage(chatId,
        ta('users_stats', lang, {
          total: s.total, active: s.active,
          new_24h: s.new_24h, new_7d: s.new_7d, with_phone: s.with_phone
        }),
        { parse_mode: 'Markdown' }
      );
      break;
    }

    case 'statistics': {
      const [users, payments, spinStats] = await Promise.all([
        getUserStats(dbPool), getPaymentsStats(dbPool), getSpinStats(dbPool)
      ]);
      await bot.sendMessage(chatId,
        ta('stat_all', lang, {
          u_total: users.total, u_active: users.active,
          u_24h: users.new_24h, u_7d: users.new_7d,
          p_total: payments.total, p_pending: payments.pending,
          p_partial: payments.partial, p_paid: payments.paid,
          p_sum: Number(payments.total_paid).toLocaleString(),
          s_total: spinStats.total_spins, s_wins: spinStats.total_wins,
          s_money: Number(spinStats.total_money || 0).toLocaleString()
        }),
        { parse_mode: 'Markdown' }
      );
      break;
    }

    case 'payments': {
      const PAGE_SIZE = 5;
      const [payments, total] = await Promise.all([
        listPaymentsWithUsers(dbPool, PAGE_SIZE, 0),
        countPayments(dbPool)
      ]);
      if (!payments.length) {
        await bot.sendMessage(chatId, ta('payments_empty', lang));
        break;
      }
      await bot.sendMessage(chatId,
        ta('payments_header', lang, { count: PAGE_SIZE < total ? `${PAGE_SIZE}/${total}` : total }),
        { parse_mode: 'Markdown' }
      );
      const statusLabel = {
        pending:   ta('payment_status_pending',   lang),
        partial:   ta('payment_status_partial',   lang),
        paid:      ta('payment_status_paid',      lang),
        cancelled: ta('payment_status_cancelled', lang)
      };
      for (const p of payments) {
        const name = md([p.first_name, p.last_name].filter(Boolean).join(' ') || `ID: ${p.user_id}`);
        const username = p.username ? ` (@${md(p.username)})` : '';
        const phone = p.phone ? `\n📱 ${p.phone}` : '';
        const status = statusLabel[p.status] || p.status;
        const date = new Date(p.updated_at).toLocaleDateString('uz-UZ');
        await bot.sendMessage(chatId,
          `👤 *${name}*${username}${phone}\n` +
          `${ta('payment_paid_label', lang)} \`${Number(p.paid_amount).toLocaleString()} so'm\`\n` +
          `${ta('payment_status_label', lang)} ${status}\n` +
          `📅 ${date}`,
          {
            parse_mode: 'Markdown',
            reply_markup: p.status !== 'paid' && p.status !== 'cancelled'
              ? paymentActionButtons(p.user_id) : undefined
          }
        );
      }
      break;
    }

    case 'campaigns': {
      const campaigns = await listCampaigns(dbPool);
      const addButton = { inline_keyboard: [[{ text: '➕ Yangi kampaniya', callback_data: 'campaign_new' }]] };
      if (!campaigns.length) {
        await bot.sendMessage(chatId,
          `📢 *Kampaniyalar yo'q*\n\nBirinchi kampaniyani qo'shing:`,
          { parse_mode: 'Markdown', reply_markup: addButton }
        );
        break;
      }
      const lines = campaigns.map((c) => {
        const status = c.is_active ? '✅' : '❌';
        const channel = c.channel_username ? `@${md(c.channel_username)}` : `\`${c.channel_id}\``;
        return `${status} *${md(c.name)}*\n   📢 ${channel}\n   💰 ${ta('campaign_reward', lang)}: \`${Number(c.reward_amount).toLocaleString()} so'm\`\n   👥 ${ta('campaign_level2', lang)}: \`${Number(c.level2_reward_amount).toLocaleString()} so'm\``;
      });
      await bot.sendMessage(chatId,
        ta('campaigns_header', lang, { count: campaigns.length }) + '\n\n' + lines.join('\n\n'),
        { parse_mode: 'Markdown', reply_markup: addButton }
      );
      break;
    }

    case 'spin': {
      const [segments, stats] = await Promise.all([
        getActiveSegments(dbPool), getSpinStats(dbPool)
      ]);
      const segmentLines = segments.map((s, i) =>
        `${i + 1}. \`${s.type}\` — ${md(s.label)}${s.value ? ` (${md(s.value)})` : ''}`
      ).join('\n');
      await bot.sendMessage(chatId,
        ta('spin_panel', lang, {
          total: stats.total_spins, wins: stats.total_wins, miss: stats.total_miss,
          money: Number(stats.total_money || 0).toLocaleString(),
          seg_count: segments.length, segments: segmentLines
        }),
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: ta('spin_btn_edit', lang), callback_data: 'spin_list' }],
              [{ text: ta('spin_btn_stats', lang), callback_data: 'spin_stats' }]
            ]
          }
        }
      );
      break;
    }

    case 'admins': {
      const admins = await listAdmins(dbPool);
      const list = admins.length
        ? admins.map((a) => `• \`${a.admin_telegram_id}\` | Kanal: \`${a.channel_id}\``).join('\n')
        : ta('admins_none', lang);
      await bot.sendMessage(chatId,
        ta('admins_list_header', lang, { count: admins.length }) + `\n\n${list}`,
        {
          parse_mode: 'Markdown',
          reply_markup: adminMgmtButtons(lang)
        }
      );
      break;
    }

    case 'settings': {
      await bot.sendMessage(chatId,
        ta('settings_panel', lang, { env: config.nodeEnv, super_id: config.superAdminId }),
        { parse_mode: 'Markdown' }
      );
      break;
    }

    case 'language': {
      await bot.sendMessage(chatId, ta('select_language', lang), {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🇺🇿 O'zbekcha", callback_data: 'admin_lang_uz' }],
            [{ text: '🇷🇺 Русский',   callback_data: 'admin_lang_ru' }],
            [{ text: '🇬🇧 English',   callback_data: 'admin_lang_en' }],
          ]
        }
      });
      break;
    }

    default:
      break;
  }
}

export function createAdminBot(userBot) {
  const bot = new TelegramBot(config.adminBotToken, { polling: false });

  bot.onText(/^\/start(@\S+)?$/, async (msg) => {
    try {
      const isAdmin = await adminAuthMiddleware(msg.from.id);
      if (!isAdmin) {
        await bot.sendMessage(msg.chat.id, '❌ Sizda admin huquqi yo\'q.');
        return;
      }
      const lang = await getAdminLanguage(msg.from.id);
      const name = msg.from.first_name || 'Admin';
      await sendAdminMenu(bot, msg.chat.id, lang, ta('welcome', lang, { name }));
    } catch (error) {
      logger.error('Admin /start handler failed', error.message || error);
      if (msg?.chat?.id) await bot.sendMessage(msg.chat.id, '❌ Xatolik yuz berdi.');
    }
  });

  bot.onText(/\/admin(?:\s+(.*))?$/, async (msg) => {
    try {
      await handleAdminCommand(bot, msg);
    } catch (error) {
      logger.error('Admin /admin handler failed', error.message || error);
      if (msg?.chat?.id) await bot.sendMessage(msg.chat.id, '❌ Xatolik yuz berdi.');
    }
  });

  bot.onText(/\/admin[-_]add(?:\s+(.*))?/, async (msg) => {
    try {
      await handleAdminAdd(bot, msg);
    } catch (error) {
      logger.error('Admin /admin-add handler failed', error.message || error);
      if (msg?.chat?.id) await bot.sendMessage(msg.chat.id, '❌ Xatolik yuz berdi.');
    }
  });

  bot.onText(/\/admin[-_]remove(?:\s+(.*))?/, async (msg) => {
    try {
      await handleAdminRemove(bot, msg);
    } catch (error) {
      logger.error('Admin /admin-remove handler failed', error.message || error);
      if (msg?.chat?.id) await bot.sendMessage(msg.chat.id, '❌ Xatolik yuz berdi.');
    }
  });

  bot.onText(/\/admin[-_]list/, async (msg) => {
    try {
      await handleAdminList(bot, msg);
    } catch (error) {
      logger.error('Admin /admin-list handler failed', error.message || error);
      if (msg?.chat?.id) await bot.sendMessage(msg.chat.id, '❌ Xatolik yuz berdi.');
    }
  });

  bot.on('message', async (msg) => {
    if (!msg?.from?.id) return;
    if (msg.text?.startsWith('/')) return;
    if (!msg.text && !msg.forward_from_chat) return;

    const adminId = msg.from.id;
    const chatId = msg.chat.id;

    try {
      const isAdmin = await adminAuthMiddleware(adminId);
      if (!isAdmin) {
        await bot.sendMessage(chatId, '❌ Sizda admin huquqi yo\'q.');
        return;
      }

      const action = BUTTON_MAP.get(msg.text);
      const isMenuButton = !!action;

      const adminState = await getAdminState(adminId);
      const { state, state_data } = adminState;
      const lang = state_data?.lang || 'uz';

      if (state !== 'IDLE' && isMenuButton) {
        await resetAdminState(adminId);
        logger.info(`Admin auto-cancel: ${state} → IDLE`);
      }

      if (state === 'SPIN_WIZARD' && !isMenuButton) {
        const d = state_data || {};

        if (d.step === 'VALUE') {
          const value = msg.text.trim();
          if (!value || value.length > 50) {
            await bot.sendMessage(chatId, ta('spin_bad_input', lang), { parse_mode: 'Markdown' });
            return;
          }
          await setAdminState(adminId, 'SPIN_WIZARD', { ...d, step: 'LABEL', value });
          await bot.sendMessage(chatId,
            ta('spin_enter_label', lang, { example: d.type === 'pul' ? value.replace(/(\d)(?=(\d{3})+$)/g, '$1 ') : value }),
            { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: ta('btn_cancel', lang), callback_data: 'spin_wiz_cancel' }]] } }
          );
          return;
        }

        if (d.step === 'LABEL') {
          const label = msg.text.trim();
          if (!label || label.length > 50) {
            await bot.sendMessage(chatId, ta('spin_bad_input', lang), { parse_mode: 'Markdown' });
            return;
          }
          await setAdminState(adminId, 'SPIN_WIZARD', { ...d, step: 'COLOR', label });
          await bot.sendMessage(chatId, ta('spin_select_color', lang), { parse_mode: 'Markdown', reply_markup: colorButtons(lang) });
          return;
        }

        return;
      }

      if (state === 'ADMIN_ADD_WIZARD' && !isMenuButton) {
        const d = state_data || {};
        const cancelBtn = { inline_keyboard: [[{ text: ta('btn_cancel', lang), callback_data: 'admin_mgmt_cancel' }]] };

        if (d.step === 'ID') {
          const id = Number(msg.text.trim());
          if (!id || isNaN(id)) {
            await bot.sendMessage(chatId, ta('admin_bad_id', lang), { parse_mode: 'Markdown' });
            return;
          }
          await setAdminState(adminId, 'ADMIN_ADD_WIZARD', { ...d, step: 'CHANNEL', targetId: id });
          await bot.sendMessage(chatId, ta('admin_enter_channel', lang), { parse_mode: 'Markdown', reply_markup: cancelBtn });
          return;
        }

        if (d.step === 'CHANNEL') {
          const channelId = Number(msg.text.trim());
          if (!channelId || isNaN(channelId)) {
            await bot.sendMessage(chatId, ta('admin_bad_id', lang), { parse_mode: 'Markdown' });
            return;
          }
          try {
            const added = await addAdmin(dbPool, d.targetId, channelId, adminId);
            await resetAdminState(adminId);
            if (added) {
              await bot.sendMessage(chatId, ta('admin_added', lang, { id: d.targetId, channel: channelId }), { parse_mode: 'Markdown' });
            } else {
              await bot.sendMessage(chatId, ta('admin_exists', lang), { parse_mode: 'Markdown' });
            }
          } catch (err) {
            logger.error('admin add wizard error', err.message);
            await bot.sendMessage(chatId, ta('error', lang));
            await resetAdminState(adminId);
          }
          return;
        }
        return;
      }

      if (state === 'ADMIN_REMOVE_WIZARD' && !isMenuButton) {
        const d = state_data || {};
        if (d.step === 'ID') {
          const id = Number(msg.text.trim());
          if (!id || isNaN(id)) {
            await bot.sendMessage(chatId, ta('admin_bad_id', lang), { parse_mode: 'Markdown' });
            return;
          }
          try {
            const removed = await removeAdmin(dbPool, id);
            await resetAdminState(adminId);
            if (removed) {
              await bot.sendMessage(chatId, ta('admin_removed', lang, { id }), { parse_mode: 'Markdown' });
            } else {
              await bot.sendMessage(chatId, ta('admin_not_found', lang), { parse_mode: 'Markdown' });
            }
          } catch (err) {
            logger.error('admin remove wizard error', err.message);
            await bot.sendMessage(chatId, ta('error', lang));
            await resetAdminState(adminId);
          }
          return;
        }
        return;
      }

      if (state === 'WAITING_CAMPAIGN_NAME' && !isMenuButton) {
        const name = msg.text?.trim();
        if (!name || name.length < 3) {
          await bot.sendMessage(chatId, `❌ Nom kamida 3 harfdan iborat bo'lishi kerak.`);
          return;
        }
        const channels = await getActiveBotChannels(dbPool);
        if (!channels.length) {
          await setAdminState(adminId, 'WAITING_CAMPAIGN_CHANNEL', { name, mode: 'forward' });
          await bot.sendMessage(chatId,
            `2️⃣ *Kanalni tanlash*\n\nBot hech qanday kanalda admin emas.\n\nIltimos:\n1. UserBot ni kanalga admin qiling\n2. Yoki kanaldan xabarni shu yerga forward qiling`,
            { parse_mode: 'Markdown' }
          );
          return;
        }
        await setAdminState(adminId, 'WAITING_CAMPAIGN_CHANNEL', { name });
        const buttons = channels.map((c) => [{
          text: c.channel_username ? `@${c.channel_username}` : (c.channel_title || String(c.channel_id)),
          callback_data: `campaign_ch_${c.channel_id}`,
        }]);
        buttons.push([{ text: '📤 Yangi kanal (forward)', callback_data: 'campaign_ch_forward' }]);
        await bot.sendMessage(chatId,
          `2️⃣ *Kanalni tanlang*\n\nNom: \`${name}\``,
          { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }
        );
        return;
      }

      if (state === 'WAITING_CAMPAIGN_CHANNEL' && !isMenuButton) {
        if (msg.forward_from_chat) {
          const chat = msg.forward_from_chat;
          if (!['channel', 'group', 'supergroup'].includes(chat.type)) {
            await bot.sendMessage(chatId, `❌ Faqat kanal/guruh forward qilish mumkin.`);
            return;
          }
          try {
            const botInfo = await bot.getMe();
            const member = await bot.getChatMember(chat.id, botInfo.id);
            if (!['administrator', 'creator'].includes(member.status)) {
              await bot.sendMessage(chatId,
                `⚠️ *Bot bu kanalda admin emas*\n\nDavom etish uchun UserBot ni kanal admin qiling.`,
                { parse_mode: 'Markdown' }
              );
              return;
            }
          } catch {}
          await setAdminState(adminId, 'WAITING_CAMPAIGN_LEVEL1', {
            name: state_data.name,
            channel_id: chat.id,
            channel_username: chat.username || null,
            channel_title: chat.title || null,
          });
          await bot.sendMessage(chatId,
            `✓ Kanal aniqlandi: *${chat.title}*\n\n3️⃣ *Level 1 mukofot (so'm)*\n\nTo'g'ridan taklif qilingan do'st uchun.\n\nMisol: \`3000\``,
            { parse_mode: 'Markdown' }
          );
          return;
        }
        await bot.sendMessage(chatId, `📤 Iltimos, kanaldan xabar forward qiling yoki tugmadan tanlang.`);
        return;
      }

      if (state === 'WAITING_CAMPAIGN_LEVEL1' && !isMenuButton) {
        const amount = parseFloat(msg.text?.trim());
        if (isNaN(amount) || amount < 0) {
          await bot.sendMessage(chatId, `❌ Iltimos, raqam yuboring. Misol: \`3000\``);
          return;
        }
        await setAdminState(adminId, 'WAITING_CAMPAIGN_LEVEL2', { ...state_data, reward_amount: amount });
        await bot.sendMessage(chatId,
          `4️⃣ *Level 2 mukofot (so'm)*\n\nDo'stning do'sti uchun (yarim).\nAgar yo'q bo'lsa: \`0\``,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      if (state === 'WAITING_CAMPAIGN_LEVEL2' && !isMenuButton) {
        const amount = parseFloat(msg.text?.trim());
        if (isNaN(amount) || amount < 0) {
          await bot.sendMessage(chatId, `❌ Raqam yuboring. 0 yoki musbat son.`);
          return;
        }
        const newData = { ...state_data, level2_reward_amount: amount };
        await setAdminState(adminId, 'WAITING_CAMPAIGN_CONFIRM', newData);
        const channelLabel = newData.channel_username ? `@${newData.channel_username}` : newData.channel_title;
        await bot.sendMessage(chatId,
          `📋 *Tasdiqlash*\n\n` +
          `*Nom:* ${newData.name}\n` +
          `*Kanal:* ${channelLabel}\n` +
          `*Kanal ID:* \`${newData.channel_id}\`\n` +
          `*Level 1:* ${newData.reward_amount} so'm\n` +
          `*Level 2:* ${newData.level2_reward_amount} so'm`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: '✅ Saqlash', callback_data: 'campaign_save' },
                { text: '❌ Bekor', callback_data: 'campaign_cancel' },
              ]]
            }
          }
        );
        return;
      }

      if (isMenuButton) {
        await handleButtonPress(bot, chatId, adminId, action);
        return;
      }
    } catch (error) {
      logger.error('Admin message handler failed', error.message || error);
      await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.').catch(() => {});
    }
  });

  bot.on('callback_query', async (callbackQuery) => {
    try {
      await handleAdminCallback(bot, callbackQuery);
    } catch (error) {
      logger.error('Admin callback handler failed', error.message || error);
      if (callbackQuery?.id) {
        await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Amal bajarilmadi', show_alert: false }).catch(() => {});
      }
    }
  });

  bot.on('photo', async (msg) => {
    try {
      await handleAdminPhoto(bot, msg, userBot);
    } catch (error) {
      logger.error('Admin photo handler failed', error.message || error);
      if (msg?.chat?.id) await bot.sendMessage(msg.chat.id, '❌ Rasmni qayta ishlashda xatolik.');
    }
  });

  bot.on('polling_error', (error) => {
    if (['ETIMEDOUT', 'ECONNRESET', 'EFATAL'].includes(error.code)) return;
    logger.error('Admin bot polling error', error.message || error);
  });

  bot.on('error', (error) => {
    logger.error('Admin bot error', error.message || error);
  });

  return bot;
}
