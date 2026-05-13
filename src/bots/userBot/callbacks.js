import { userService } from '../../services/user.service.js';

const languageLabels = {
  uz: 'O‘zbekcha',
  ru: 'Русский',
  en: 'English'
};

export async function handleUserCallback(callbackQuery, { api }) {
  const chatId = callbackQuery.from.id;
  const data = callbackQuery.data;

  if (data.startsWith('lang_')) {
    const language = data.split('_')[1];
    await userService.updateLanguage(chatId, language);
    await api.answerCallbackQuery(callbackQuery.id, `Language set to ${languageLabels[language] || language}`);
    await api.sendMessage(chatId, `✅ Til o‘zgartirildi: ${languageLabels[language] || language}`);
    return;
  }

  await api.answerCallbackQuery(callbackQuery.id, 'Action received.');
}
