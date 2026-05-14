import { addAdmin, removeAdmin, listAdmins } from '../../../db/queries/admins.queries.js';
import { dbPool } from '../../../db/pool.js';
import { config } from '../../../config/index.js';

function adminListText(admins) {
  const rows = admins.length
    ? admins.map((a) => `• \`${a.admin_telegram_id}\` | Kanal: \`${a.channel_id}\``).join('\n')
    : "Hali admin qo'shilmagan";

  return (
    `🔐 *Adminlar (${admins.length} ta):*\n\n` +
    `${rows}\n\n` +
    `*Boshqaruv:*\n` +
    `/admin-add <id> <channel_id>\n` +
    `/admin-remove <id>\n` +
    `/admin-list`
  );
}

export async function handleAdminAdd(bot, msg) {
  if (!msg?.text || !msg?.from || !msg.chat) return;

  const chatId = msg.chat.id;
  const senderId = msg.from.id;

  if (Number(senderId) !== Number(config.superAdminId)) {
    await bot.sendMessage(chatId, `❌ Sizda yetarli huquq yo'q.`);
    return;
  }

  const args = msg.text.trim().split(/\s+/).slice(1);
  const [adminId, channelId] = args;

  if (!adminId || !channelId) {
    await bot.sendMessage(chatId,
      `Format: /admin-add <telegram_id> <channel_id>`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  try {
    const added = await addAdmin(dbPool, Number(adminId), Number(channelId), senderId);
    if (added) {
      await bot.sendMessage(chatId,
        `✅ Admin muvaffaqiyatli qo'shildi.\n\nID: \`${adminId}\`\nKanal: \`${channelId}\``,
        { parse_mode: 'Markdown' }
      );
    } else {
      await bot.sendMessage(chatId, `⚠️ Bu admin allaqachon mavjud.`);
    }
  } catch (err) {
    await bot.sendMessage(chatId, `❌ Xatolik: ${err.message}`);
  }
}

export async function handleAdminRemove(bot, msg) {
  if (!msg?.text || !msg?.from || !msg.chat) return;

  const chatId = msg.chat.id;
  const senderId = msg.from.id;

  if (Number(senderId) !== Number(config.superAdminId)) {
    await bot.sendMessage(chatId, `❌ Sizda yetarli huquq yo'q.`);
    return;
  }

  const args = msg.text.trim().split(/\s+/).slice(1);
  const adminId = args[0];

  if (!adminId) {
    await bot.sendMessage(chatId, `Format: /admin-remove <telegram_id>`, { parse_mode: 'Markdown' });
    return;
  }

  try {
    const removed = await removeAdmin(dbPool, Number(adminId));
    if (removed) {
      await bot.sendMessage(chatId,
        `✅ Admin olib tashlandi.\n\nID: \`${adminId}\``,
        { parse_mode: 'Markdown' }
      );
    } else {
      await bot.sendMessage(chatId, `⚠️ Bunday admin topilmadi.`);
    }
  } catch (err) {
    await bot.sendMessage(chatId, `❌ Xatolik: ${err.message}`);
  }
}

export async function handleAdminList(bot, msg) {
  if (!msg?.chat) return;
  try {
    const admins = await listAdmins(dbPool);
    await bot.sendMessage(msg.chat.id, adminListText(admins), { parse_mode: 'Markdown' });
  } catch (err) {
    await bot.sendMessage(msg.chat.id, `❌ Xatolik: ${err.message}`);
  }
}

// eski /admin add|remove|list — orqaga muvofiqligi uchun saqlanadi
export async function handleAdminCommand(bot, msg) {
  if (!msg?.text || !msg?.from || !msg.chat) return;

  const args = msg.text.trim().split(/\s+/).slice(1);
  const command = args[0];
  const chatId = msg.chat.id;

  if (!command) {
    await bot.sendMessage(chatId,
      `🔐 *Admin komandalari:*\n\n` +
      `/admin-add <id> <channel_id>\n` +
      `/admin-remove <id>\n` +
      `/admin-list`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  if (command === 'add') {
    await handleAdminAdd(bot, { ...msg, text: `/admin-add ${args.slice(1).join(' ')}` });
    return;
  }
  if (command === 'remove') {
    await handleAdminRemove(bot, { ...msg, text: `/admin-remove ${args.slice(1).join(' ')}` });
    return;
  }
  if (command === 'list') {
    await handleAdminList(bot, msg);
    return;
  }

  await bot.sendMessage(chatId,
    `❌ Noto'g'ri komanda.\n\nFoydalanish: /admin-add | /admin-remove | /admin-list`,
    { parse_mode: 'Markdown' }
  );
}
