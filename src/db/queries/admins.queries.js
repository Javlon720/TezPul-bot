
export async function addAdmin(client, adminTelegramId, channelId, grantedBy) {
  const result = await client.query(
    `INSERT INTO admin_channels (admin_telegram_id, channel_id, granted_by)
     VALUES ($1, $2, $3) ON CONFLICT (admin_telegram_id, channel_id) DO NOTHING RETURNING *`,
    [adminTelegramId, channelId, grantedBy]
  );
  return result.rows[0] || null;
}

export async function removeAdmin(client, adminTelegramId) {
  const result = await client.query(
    'DELETE FROM admin_channels WHERE admin_telegram_id = $1 RETURNING *',
    [adminTelegramId]
  );
  return result.rows[0] || null;
}

export async function getAdminByTelegramId(client, adminTelegramId) {
  const result = await client.query(
    'SELECT * FROM admin_channels WHERE admin_telegram_id = $1 LIMIT 1',
    [adminTelegramId]
  );
  return result.rows[0] || null;
}

export async function listAdmins(client) {
  const result = await client.query(
    'SELECT * FROM admin_channels ORDER BY created_at DESC');
  return result.rows;
}
