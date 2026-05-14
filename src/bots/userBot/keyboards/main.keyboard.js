
export function mainKeyboard(languageText) {
  return {
    resize_keyboard: true,
    one_time_keyboard: false,
    is_persistent: true,
    keyboard: [
      [{ text: languageText('menu_check') }, { text: languageText('menu_report') }],
      [{ text: languageText('menu_share') }],
      [{ text: languageText('menu_payment') }, { text: languageText('menu_info') }],
      [{ text: languageText('menu_spin') }],
      [{ text: languageText('menu_language') }]
    ]
  };
}
