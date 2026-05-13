import { query } from '../pool.js';

export async function getAdminState(adminTelegramId) {
  const res = await query(
    'SELECT state, state_data FROM admin_states WHERE admin_telegram_id = $1',
    [adminTelegramId]
  );
  return res.rows[0] || { state: 'IDLE', state_data: {} };
}

export async function setAdminState(adminTelegramId, state, stateData = {}) {
  const res = await query(
    `INSERT INTO admin_states (admin_telegram_id, state, state_data, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (admin_telegram_id) DO UPDATE
       SET state = EXCLUDED.state,
           state_data = EXCLUDED.state_data,
           updated_at = NOW()
     RETURNING *`,
    [adminTelegramId, state, JSON.stringify(stateData)]
  );
  return res.rows[0];
}

export async function resetAdminState(adminTelegramId) {
  return setAdminState(adminTelegramId, 'IDLE', {});
}
