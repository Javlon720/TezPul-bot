
export async function upsertBotChannel(client, data) {
  const { channel_id, channel_title, channel_username, channel_type, bot_status } = data;
  const isActive = ['administrator', 'member'].includes(bot_status);

  const res = await client.query(
    `INSERT INTO bot_channels (
       channel_id, channel_title, channel_username, channel_type, bot_status,
       is_active, added_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     ON CONFLICT (channel_id) DO UPDATE SET
       channel_title    = EXCLUDED.channel_title,
       channel_username = EXCLUDED.channel_username,
       channel_type     = EXCLUDED.channel_type,
       bot_status       = EXCLUDED.bot_status,
       is_active        = EXCLUDED.is_active,
       removed_at       = CASE WHEN EXCLUDED.is_active = false THEN NOW() ELSE NULL END,
       updated_at       = NOW()
     RETURNING *`,
    [channel_id, channel_title, channel_username, channel_type, bot_status, isActive]
  );
  return res.rows[0];
}

export async function getActiveBotChannels(client) {
  const res = await client.query(
    `SELECT * FROM bot_channels WHERE is_active = true ORDER BY added_at DESC`
  );
  return res.rows;
}

export async function getAllBotChannels(client) {
  const res = await client.query(
    `SELECT * FROM bot_channels ORDER BY added_at DESC`
  );
  return res.rows;
}

export async function getBotChannelById(client, channelId) {
  const res = await client.query(
    `SELECT * FROM bot_channels WHERE channel_id = $1 LIMIT 1`,
    [channelId]
  );
  return res.rows[0] || null;
}
