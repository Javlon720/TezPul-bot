
export function validateTelegramId(value) {
  return Number.isInteger(value) && value > 0;
}

export function validatePhone(phone) {
  return typeof phone === 'string' && /^\+?[0-9]{9,15}$/.test(phone.trim());
}

export function validateAmount(amount) {
  const value = Number(amount);
  return Number.isFinite(value) && value >= 0 && /^\d+(\.\d{1,2})?$/.test(String(amount));
}

export function validateCallbackData(data) {
  return typeof data === 'string' && data.length > 0 && data.length <= 64 && /^[a-zA-Z0-9_:\-]+$/.test(data);
}

export function sanitizeText(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/[<>]/g, '').trim();
}
