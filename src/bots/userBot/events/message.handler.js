import { t } from '../../../services/i18n.service.js';
import { dbPool } from '../../../db/pool.js';
import { getUserWithState, clearUserState } from '../../../db/queries/users.queries.js';
import { getReferralsByReferrerId } from '../../../db/queries/referrals.queries.js';
import { getPaymentByUserId } from '../../../db/queries/payments.queries.js';
import { checkAllUserSubscriptions, requireChannelSubscription } from '../../../core/subscription.engine.js';
import { safeSend } from '../../../utils/safe-send.js';
import { playSpin, getSpinInfo } from '../../../core/spin.engine.js';
import { logger } from '../../../utils/logger.js';

function normalizeText(text = '') {
  return text.trim().toLowerCase();
}

const MENU_TEXTS_CACHE = new Map();

async function getMenuTexts(language) {
  if (MENU_TEXTS_CACHE.has(language)) return MENU_TEXTS_CACHE.get(language);
  const keys = ['menu_check', 'menu_report', 'menu_share', 'menu_payment', 'menu_info', 'menu_spin', 'menu_language'];
  const texts = new Set();
  for (const key of keys) {
    texts.add(normalizeText(await t(key, language)));
  }
  MENU_TEXTS_CACHE.set(language, texts);
  return texts;
}

export async function handleMessage(bot, msg) {
  if (!msg || !msg.from || !msg.text || !msg.chat) return;

  const telegramId = msg.from.id;
  const { user, userState } = await getUserWithState(dbPool, telegramId);
  if (!user) {
    const text = await t('not_registered', 'uz');
    await safeSend(bot, msg.chat.id, text, { parse_mode: 'Markdown' });
    return;
  }

  const language = user.language || 'uz';

  const passed = await requireChannelSubscription(bot, telegramId, msg.chat.id, language);
  if (!passed) return;

  const text = normalizeText(msg.text);
  const menuTexts = await getMenuTexts(language);
  const isMenuButton = menuTexts.has(text);

  if (userState?.state && userState.state !== 'IDLE' && isMenuButton) {
    await clearUserState(dbPool, telegramId);
    logger.info(`Auto-cancel: ${userState.state} → IDLE for user ${telegramId}`);
  } else if (userState?.state === 'WAITING_PHONE' && !isMenuButton) {
    const reminderText = await t('request_contact_again', language);
    await safeSend(bot, telegramId, reminderText, { parse_mode: 'Markdown' });
    return;
  }

  const [check, report, share, payment, info, language_, spin] = await Promise.all([
    t('menu_check', language),
    t('menu_report', language),
    t('menu_share', language),
    t('menu_payment', language),
    t('menu_info', language),
    t('menu_language', language),
    t('menu_spin', language),
  ]);
  const menuLabels = {
    check:    normalizeText(check),
    report:   normalizeText(report),
    share:    normalizeText(share),
    payment:  normalizeText(payment),
    info:     normalizeText(info),
    language: normalizeText(language_),
    spin:     normalizeText(spin),
  };

  if (text === menuLabels.check) {
    await handleCheck(bot, msg.chat.id, telegramId, language);
  } else if (text === menuLabels.report) {
    await handleReport(bot, msg.chat.id, telegramId, language);
  } else if (text === menuLabels.share) {
    await handleShare(bot, msg.chat.id, user, language);
  } else if (text === menuLabels.payment) {
    await handlePayment(bot, msg.chat.id, telegramId, language);
  } else if (text === menuLabels.info) {
    await handleInfo(bot, msg.chat.id, language);
  } else if (text === menuLabels.language) {
    await handleLanguageRequest(bot, msg.chat.id, language);
  } else if (text === menuLabels.spin) {
    await handleSpin(bot, msg.chat.id, telegramId, user, language);
  } else {
    const unknown = await t('unknown_action', language);
    await safeSend(bot, msg.chat.id, unknown, { parse_mode: 'Markdown' });
  }
}

async function handleCheck(bot, chatId, telegramId, language) {
  await checkAllUserSubscriptions(dbPool, bot, telegramId);
  const referrals = await getReferralsByReferrerId(dbPool, telegramId);
  const summary = referrals.map((ref) => {
    const username = ref.username ? `@${ref.username}` : '(no username)';
    const status = ref.is_subscribed ? '✅' : '❌';
    return `${username} ${ref.first_name || ''} ${ref.last_name || ''}\n${ref.campaign_name || 'Campaign'} | ${status}`;
  });
  const [checkTitle, checkEmpty] = await Promise.all([
    t('check_title', language),
    t('check_empty', language),
  ]);
  const body = summary.length ? summary.join('\n\n') : checkEmpty;
  await safeSend(bot, chatId, `${checkTitle}\n\n${body}`, { parse_mode: 'Markdown' });
}

async function handleReport(bot, chatId, telegramId, language) {
  const [referrals, payment] = await Promise.all([
    getReferralsByReferrerId(dbPool, telegramId),
    getPaymentByUserId(dbPool, telegramId),
  ]);
  const active = referrals.filter((ref) => ref.is_subscribed).length;
  const rewarded = referrals
    .filter((ref) => ref.is_rewarded)
    .reduce((sum, ref) => sum + Number(ref.reward_amount || 0), 0);

  const [reportTitle, totalLabel, activeLabel, earnedLabel, statusLabel] = await Promise.all([
    t('report_title', language),
    t('report_total_referrals', language, { count: referrals.length }),
    t('report_active_referrals', language, { count: active }),
    t('report_earned', language, { amount: rewarded.toFixed(2) }),
    t('report_payment_status', language, { status: payment?.status || 'pending' }),
  ]);

  await safeSend(bot, chatId,
    `${reportTitle}\n\n• ${totalLabel}\n• ${activeLabel}\n• ${earnedLabel}\n• ${statusLabel}`,
    { parse_mode: 'Markdown' }
  );
}

async function handleShare(bot, chatId, user, language) {
  const [info, countRows] = await Promise.all([
    bot.getMe().catch(() => null),
    getReferralsByReferrerId(dbPool, user.telegram_id),
  ]);
  const botUsername = info?.username || null;
  const referralLink = botUsername
    ? `https://t.me/${botUsername}?start=${user.referral_code}`
    : await t('referral_link_error', language);
  const text = await t('referral_link', language, { link: referralLink, count: `(${countRows.length})` });
  await safeSend(bot, chatId, text, { parse_mode: 'Markdown' });
}

async function handlePayment(bot, chatId, telegramId, language) {
  const payment = await getPaymentByUserId(dbPool, telegramId);
  const amount = payment ? Number(payment.total_amount || 0).toFixed(2) : '0.00';
  const paid = payment ? Number(payment.paid_amount || 0).toFixed(2) : '0.00';
  const remaining = payment ? Number(payment.remaining_amount || 0).toFixed(2) : '0.00';

  const [paymentInfo, totalLabel, paidLabel, remainingLabel, statusLabel] = await Promise.all([
    t('payment_info', language),
    t('payment_total', language, { amount }),
    t('payment_paid', language, { amount: paid }),
    t('payment_remaining', language, { amount: remaining }),
    t('payment_status', language, { status: payment?.status || 'pending' }),
  ]);

  await safeSend(bot, chatId,
    `${paymentInfo}\n\n• ${totalLabel}\n• ${paidLabel}\n• ${remainingLabel}\n• ${statusLabel}`,
    { parse_mode: 'Markdown' }
  );
}

async function handleInfo(bot, chatId, language) {
  const text = await t('info_text', language);
  await safeSend(bot, chatId, text, { parse_mode: 'Markdown' });
}

async function handleLanguageRequest(bot, chatId, language) {
  const text = await t('select_language', language);
  await safeSend(bot, chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🇺🇿 O'zbekcha", callback_data: 'lang_uz' }],
        [{ text: '🇷🇺 Русский', callback_data: 'lang_ru' }],
        [{ text: '🇬🇧 English', callback_data: 'lang_en' }]
      ]
    }
  });
}

async function handleSpin(bot, chatId, telegramId, user, language) {
  try {
    const spinInfo = await getSpinInfo(telegramId);
    const spinCount = spinInfo?.spin_count || 0;
    const spinBalance = Number(spinInfo?.spin_balance || 0);
    const pendingRefs = spinInfo?.pending_refs || 0;

    if (spinCount <= 0) {
      const needed = 2 - pendingRefs;
      const text = await t('spin_no_spins', language, { pending: pendingRefs, needed });
      const botInfo = await bot.getMe().catch(() => null);
      const botUsername = botInfo?.username || '';
      const link = `https://t.me/${botUsername}?start=${spinInfo?.referral_code || user?.referral_code || ''}`;
      await safeSend(bot, chatId, `${text}\n\n🔗 ${link}`, { parse_mode: 'Markdown' });
      return;
    }

    const infoText = await t('spin_has_spins', language, {
      count: spinCount,
      balance: spinBalance.toLocaleString()
    });
    await safeSend(bot, chatId, infoText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎰 Spin bosish!', callback_data: 'spin_play' }],
          [{ text: '📋 Tarixim', callback_data: 'spin_history' }]
        ]
      }
    });
  } catch (err) {
    logger.error('handleSpin error', err.message);
    const errText = await t('error_occurred', language);
    await safeSend(bot, chatId, errText);
  }
}
