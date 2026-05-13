import { addAdmin, removeAdmin, listAdmins } from '../../../db/queries/admins.queries.js';
import { config } from '../../../config/index.js';

export async function handleAdminCommand(bot, msg) {
  if (!msg?.text || !msg?.from || !msg.chat) {
    return;
  }

  const text = msg.text.trim();
  const args = text.split(/\s+/).slice(1);
  const command = args[0];
  const chatId = msg.chat.id;
  const senderId = msg.from.id;

  if (command === 'add') {
    if (senderId !== config.superAdminId) {
      await bot.sendMessage(chatId, `❌ Sizda yetarli huquq yo'q.`, { parse_mode: 'Markdown' });
      return;
    }
    const [adminId, channelId] = args.slice(1);
    if (!adminId || !channelId) {
      await bot.sendMessage(chatId, 'Format: /admin add <telegram_id> <channel_id>', { parse_mode: 'Markdown' });
      return;
    }
    const added = await addAdmin(bot.client, Number(adminId), Number(channelId), senderId);
    if (added) {
      await bot.sendMessage(chatId, `✅ Admin muvaffaqiyatli qo'shildi.`, { parse_mode: 'Markdown' });
    } else {
      await bot.sendMessage(chatId, '⚠️ Admin allaqachon mavjud.', { parse_mode: 'Markdown' });
    }
    return;
  }

  if (command === 'remove') {
    if (senderId !== config.superAdminId) {
      await bot.sendMessage(chatId, `❌ Sizda yetarli huquq yo'q.`, { parse_mode: 'Markdown' });
      return;
    }
    const adminId = args[1];
    if (!adminId) {
      await bot.sendMessage(chatId, 'Format: /admin remove <telegram_id>', { parse_mode: 'Markdown' });
      return;
    }
    const removed = await removeAdmin(bot.client, Number(adminId));
    if (removed) {
      await bot.sendMessage(chatId, '✅ Admin olib tashlandi.', { parse_mode: 'Markdown' });
    } else {
      await bot.sendMessage(chatId, '⚠️ Bunday admin topilmadi.', { parse_mode: 'Markdown' });
    }
    return;
  }

  if (command === 'list') {
    const admins = await listAdmins(bot.client);
    if (!admins.length) {
      await bot.sendMessage(chatId, `👤 Hech qanday admin mavjud emas.`, { parse_mode: 'Markdown' });
      return;
    }
    const adminList = admins
      .map((admin) => `• ${admin.admin_telegram_id} | Kanal: ${admin.channel_id}`)
      .join('\n');
    await bot.sendMessage(chatId, `👥 Adminlar ro'yhati:\n${adminList}`, { parse_mode: 'Markdown' });
    return;
  }

  await bot.sendMessage(chatId, `❌ Noto'g'ri admin komandasi. /admin add|remove|list`, { parse_mode: 'Markdown' });
}