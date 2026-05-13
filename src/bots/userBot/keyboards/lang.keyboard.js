
export function languageKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "🇺🇿 O'zbekcha", callback_data: 'lang_uz' },
        { text: '🇷🇺 Русский', callback_data: 'lang_ru' }
      ],
      [
        { text: '🇬🇧 English', callback_data: 'lang_en' }
      ]
    ]
  };
}
