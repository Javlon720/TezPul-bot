import { ta } from '../../../services/admin-i18n.service.js';

export function adminMainKeyboard(lang = 'uz') {
  return {
    resize_keyboard: true,
    one_time_keyboard: false,
    is_persistent: true,
    keyboard: [
      [{ text: ta('btn_users', lang) },     { text: ta('btn_statistics', lang) }],
      [{ text: ta('btn_payments', lang) },  { text: ta('btn_campaigns', lang) }],
      [{ text: ta('btn_spin', lang) },      { text: ta('btn_admins', lang) }],
      [{ text: ta('btn_settings', lang) },  { text: ta('btn_language', lang) }]
    ]
  };
}
