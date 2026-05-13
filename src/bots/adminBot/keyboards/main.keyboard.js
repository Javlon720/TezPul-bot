
export function adminMainKeyboard() {
  return {
    resize_keyboard: true,
    one_time_keyboard: false,
    is_persistent: true,
    keyboard: [
      [{ text: '👥 Users' }, { text: '📊 Statistics' }],
      [{ text: '💰 Payments' }, { text: '📢 Campaigns' }],
      [{ text: '🔐 Admins' }, { text: '⚙️ Settings' }]
    ]
  };
}
