export function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isUpdate(value) {
  return isObject(value) && ('message' in value || 'callback_query' in value);
}

export function isMessageUpdate(update) {
  return isUpdate(update) && isObject(update.message) && isObject(update.message.chat) && isObject(update.message.from);
}

export function isCallbackQuery(update) {
  return isUpdate(update) && isObject(update.callback_query) && typeof update.callback_query.data === 'string';
}

export function isTextMessage(message) {
  return isObject(message) && typeof message.text === 'string';
}

export function isContactMessage(message) {
  return isObject(message) && isObject(message.contact) && typeof message.contact.phone_number === 'string' && typeof message.contact.user_id === 'number';
}

export function isPhotoMessage(message) {
  return isObject(message) && Array.isArray(message.photo) && message.photo.length > 0;
}

export function normalizeText(text) {
  return typeof text === 'string' ? text.trim() : '';
}
