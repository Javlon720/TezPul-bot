import { t } from '../../../services/i18n.service.js';
import { dbPool } from '../../../db/pool.js';
import { getUserByTelegramId, getUserState } from '../../../db/queries/users.queries.js';
import { getReferralsByReferrerId } from '../../../db/queries/referrals.queries.js';
import { getPaymentByUserId } from '../../../db/queries/payments.queries.js';
import { checkAllUserSubscriptions } from '../../../core/subscription.engine.js';
import { safeSend } from '../../../utils/safe-send.js';

function normalizeText(text = '') {
  return text.trim().toLowerCase();
}

export async function handleMessage(bot, msg) {
  if (!msg || !msg.from || !msg.text || !msg.chat) {
    return;
  }

  const telegramId = msg.from.id;
  const user = await getUserByTelegramId(dbPool, telegramId);
  if (!user) {
    const text = await t('not_registered', 'uz');
    await safeSend(bot, msg.chat.id, text, { parse_mode: 'Markdown' });
    return;
  }

  const language = user.language || 'uz';
  const state = await getUserState(dbPool, telegramId);
  if (state?.state === 'WAITING_PHONE') {
    const text = await t('request_contact_again', language);
    await safeSend(bot, telegramId, text, { parse_mode: 'Markdown' });
    return;
  }

  const text = normalizeText(msg.text);
  const menuLabels = {
    check: normalizeText(await t('menu_check', language)),
    report: normalizeText(await t('menu_report', language)),
    share: normalizeText(await t('menu_share', language)),
    payment: normalizeText(await t('menu_payment', language)),
    info: normalizeText(await t('menu_info', language)),
    language: normalizeText(await t('menu_language', language))
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
  const checkTitle = await t('check_title', language);
  const checkEmpty = await t('check_empty', language);
  const body = summary.length ? summary.join('\n\n') : checkEmpty;
  const text = `${checkTitle}\n\n${body}`;
  await safeSend(bot, chatId, text, { parse_mode: 'Markdown' });
}

async function handleReport(bot, chatId, telegramId, language) {
  const referrals = await getReferralsByReferrerId(dbPool, telegramId);
  const payment = await getPaymentByUserId(dbPool, telegramId);
  const active = referrals.filter((ref) => ref.is_subscribed).length;
  const rewarded = referrals
    .filter((ref) => ref.is_rewarded)
    .reduce((sum, ref) => sum + Number(ref.reward_amount || 0), 0);

  const reportTitle = await t('report_title', language);
  const totalLabel = await t('report_total_referrals', language, { count: referrals.length });
  const activeLabel = await t('report_active_referrals', language, { count: active });
  const earnedLabel = await t('report_earned', language, { amount: rewarded.toFixed(2) });
  const statusLabel = await t('report_payment_status', language, { status: payment?.status || 'pending' });

  const text = `${reportTitle}\n\n• ${totalLabel}\n• ${activeLabel}\n• ${earnedLabel}\n• ${statusLabel}`;
  await safeSend(bot, chatId, text, { parse_mode: 'Markdown' });
}

async function handleShare(bot, chatId, user, language) {
  const info = await bot.getMe().catch(() => null);
  const botUsername = info?.username || null;
  const referralLink = botUsername
    ? `https://t.me/${botUsername}?start=${user.referral_code}`
    : await t('referral_link_error', language);
  const countRows = await getReferralsByReferrerId(dbPool, user.telegram_id);
  const count = `(${countRows.length})`;
  const text = await t('referral_link', language, { link: referralLink, count });
  await safeSend(bot, chatId, text, { parse_mode: 'Markdown' });
}

async function handlePayment(bot, chatId, telegramId, language) {
  const payment = await getPaymentByUserId(dbPool, telegramId);
  const amount = payment ? Number(payment.total_amount || 0).toFixed(2) : '0.00';
  const paid = payment ? Number(payment.paid_amount || 0).toFixed(2) : '0.00';
  const remaining = payment ? Number(payment.remaining_amount || 0).toFixed(2) : '0.00';

  const paymentInfo = await t('payment_info', language);
  const totalLabel = await t('payment_total', language, { amount });
  const paidLabel = await t('payment_paid', language, { amount: paid });
  const remainingLabel = await t('payment_remaining', language, { amount: remaining });
  const statusLabel = await t('payment_status', language, { status: payment?.status || 'pending' });

  const text = `${paymentInfo}\n\n• ${totalLabel}\n• ${paidLabel}\n• ${remainingLabel}\n• ${statusLabel}`;
  await safeSend(bot, chatId, text, { parse_mode: 'Markdown' });
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