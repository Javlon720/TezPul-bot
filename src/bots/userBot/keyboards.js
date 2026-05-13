import { buildReplyKeyboard, buildInlineKeyboard } from '../../utils/telegram.js';

export const contactRequestKeyboard = buildReplyKeyboard([
  [{ text: '📱 Raqamni ulashish', request_contact: true }]
]);

export const mainMenuKeyboard = buildReplyKeyboard([
  ['🔍 Tekshirish', '📊 Hisobot'],
  ['🔗 Do‘stga ulashish', '💳 To‘lov'],
  ['ℹ️ Info', '🌐 Tilni o‘zgartirish']
]);

export function languageKeyboard() {
  return buildInlineKeyboard([
    [
      { text: '🇺🇿 Uzbek', callback_data: 'lang_uz' },
      { text: '🇷🇺 Russian', callback_data: 'lang_ru' },
      { text: '🇬🇧 English', callback_data: 'lang_en' }
    ]
  ]);
}
