
export async function getUserByTelegramId(client, telegramId) {
  const result = await client.query(
    'SELECT * FROM users WHERE telegram_id = $1',
    [telegramId]
  );
  return result.rows[0] || null;
}

export async function getUserByReferralCode(client, referralCode) {
  const result = await client.query(
    'SELECT * FROM users WHERE referral_code = $1',
    [referralCode]
  );
  return result.rows[0] || null;
}

export async function createOrUpdateUser(client, userData, referralCode, referredBy = null) {
  const result = await client.query(
    `INSERT INTO users (telegram_id, username, first_name, last_name, phone, language, referral_code, referred_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (telegram_id) DO UPDATE SET
       username = EXCLUDED.username,
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       phone = COALESCE(EXCLUDED.phone, users.phone),
       updated_at = NOW()
     RETURNING *`,
    [
      userData.telegramId,
      userData.username,
      userData.firstName,
      userData.lastName,
      userData.phone || null,
      userData.language || 'uz',
      referralCode,
      referredBy
    ]
  );
  return result.rows[0];
}

export async function createOrUpdateUserState(client, telegramId, state, stateData = null) {
  const result = await client.query(
    `INSERT INTO user_states (telegram_id, state, state_data)
     VALUES ($1, $2, $3)
     ON CONFLICT (telegram_id) DO UPDATE SET
       state = EXCLUDED.state,
       state_data = EXCLUDED.state_data,
       updated_at = NOW()
     RETURNING *`,
    [telegramId, state, stateData]
  );
  return result.rows[0];
}

export async function getUserState(client, telegramId) {
  const result = await client.query(
    'SELECT * FROM user_states WHERE telegram_id = $1',
    [telegramId]
  );
  return result.rows[0] || null;
}

export async function clearUserState(client, telegramId) {
  const result = await client.query(
    `UPDATE user_states SET state = 'IDLE', state_data = NULL, updated_at = NOW()
     WHERE telegram_id = $1 RETURNING *`,
    [telegramId]
  );
  return result.rows[0] || null;
}

export async function setUserLanguage(client, telegramId, language) {
  const result = await client.query(
    `UPDATE users SET language = $1, updated_at = NOW() WHERE telegram_id = $2 RETURNING *`,
    [language, telegramId]
  );
  return result.rows[0] || null;
}

export async function updateUserPhone(client, telegramId, phone) {
  const result = await client.query(
    `UPDATE users SET phone = $1, updated_at = NOW() WHERE telegram_id = $2 RETURNING *`,
    [phone, telegramId]
  );
  return result.rows[0] || null;
}

export async function deactivateUser(client, telegramId) {
  await client.query(
    `UPDATE users SET is_active = false, updated_at = NOW() WHERE telegram_id = $1`,
    [telegramId]
  );
}

export async function getAllUsers(client) {
  const result = await client.query('SELECT * FROM users ORDER BY created_at DESC');
  return result.rows;
}
