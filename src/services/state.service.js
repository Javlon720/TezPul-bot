import { query } from '../db/db.js';

const DEFAULT_STATE = 'IDLE';

export const stateService = {
  async getState(telegramId) {
    if (!telegramId) return { state: DEFAULT_STATE, meta: {} };
    try {
      const res = await query('SELECT state, meta FROM user_states WHERE telegram_id = $1', [telegramId]);
      if (res.rows.length === 0) {
        return { state: DEFAULT_STATE, meta: {} };
      }
      return {
        state: res.rows[0].state || DEFAULT_STATE,
        meta: res.rows[0].meta || {}
      };
    } catch (error) {
      console.error('Failed to load user state:', error);
      return { state: DEFAULT_STATE, meta: {} };
    }
  },

  async setState(telegramId, state, meta = {}) {
    if (!telegramId || !state) return null;

    try {
      const res = await query(
        `INSERT INTO user_states (telegram_id, state, meta)
         VALUES ($1, $2, $3)
         ON CONFLICT (telegram_id) DO UPDATE
         SET state = EXCLUDED.state, meta = EXCLUDED.meta, updated_at = NOW()
         RETURNING *`,
        [telegramId, state, meta]
      );
      return res.rows[0] || null;
    } catch (error) {
      console.error('Failed to save user state:', error);
      return null;
    }
  },

  async resetState(telegramId) {
    return this.setState(telegramId, DEFAULT_STATE, {});
  }
};
