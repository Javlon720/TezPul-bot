
export async function getCampaignByCode(client, code) {
  const result = await client.query(
    'SELECT * FROM campaigns WHERE LOWER(name) = LOWER($1) LIMIT 1',
    [code]
  );
  return result.rows[0] || null;
}

export async function getCampaignById(client, campaignId) {
  const result = await client.query('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
  return result.rows[0] || null;
}

export async function getDefaultActiveCampaign(client) {
  const result = await client.query(
    'SELECT * FROM campaigns WHERE is_active = true ORDER BY created_at DESC LIMIT 1'
  );
  return result.rows[0] || null;
}

export async function listCampaigns(client) {
  const result = await client.query('SELECT * FROM campaigns ORDER BY created_at DESC');
  return result.rows;
}

export async function getCampaignsByIds(client, ids) {
  if (!ids.length) return [];
  const result = await client.query(
    'SELECT * FROM campaigns WHERE id = ANY($1::int[])',
    [ids]
  );
  return result.rows;
}

export async function getActiveCampaigns(client) {
  const result = await client.query(
    'SELECT * FROM campaigns WHERE is_active = true ORDER BY created_at DESC'
  );
  return result.rows;
}
