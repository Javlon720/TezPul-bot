import { logger } from '../../utils/logger.js';

export async function getActiveSegments(client) {
  try {
    const res = await client.query(
      `SELECT * FROM spin_segments WHERE is_active = true ORDER BY sort_order ASC`
    );
    return res.rows;
  } catch (err) {
    logger.error('getActiveSegments error', err.message);
    throw err;
  }
}

export async function saveSpinResult(client, userId, segmentId, prizeType, prizeValue, isWin) {
  try {
    await client.query(
      `INSERT INTO spin_results (user_id, segment_id, prize_type, prize_value, is_win)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, segmentId, prizeType, prizeValue, isWin]
    );

    if (isWin && prizeType === 'pul') {
      await client.query(
        `UPDATE users SET spin_balance = spin_balance + $1 WHERE telegram_id = $2`,
        [Number(prizeValue), userId]
      );
    }

    if (isWin && prizeType === 'bonus_spin') {
      await client.query(
        `UPDATE users SET spin_count = spin_count + $1 WHERE telegram_id = $2`,
        [Number(prizeValue) || 1, userId]
      );
    }
  } catch (err) {
    logger.error('saveSpinResult error', err.message);
    throw err;
  }
}

export async function getUserSpinInfo(client, userId) {
  try {
    const res = await client.query(
      `SELECT spin_balance, spin_count, pending_refs, referral_code
       FROM users WHERE telegram_id = $1`,
      [userId]
    );
    return res.rows[0] || null;
  } catch (err) {
    logger.error('getUserSpinInfo error', err.message);
    throw err;
  }
}

export async function incrementPendingRefs(client, userId) {
  try {
    const res = await client.query(
      `UPDATE users
       SET pending_refs = pending_refs + 1
       WHERE telegram_id = $1
       RETURNING pending_refs`,
      [userId]
    );
    const newPending = res.rows[0]?.pending_refs;
    if (newPending >= 2) {
      await client.query(
        `UPDATE users
         SET spin_count = spin_count + 1, pending_refs = 0
         WHERE telegram_id = $1`,
        [userId]
      );
    }
    return res.rows[0];
  } catch (err) {
    logger.error('incrementPendingRefs error', err.message);
    throw err;
  }
}

export async function getUserSpinHistory(client, userId, limit = 10) {
  try {
    const res = await client.query(
      `SELECT sr.*, ss.label, ss.color
       FROM spin_results sr
       LEFT JOIN spin_segments ss ON ss.id = sr.segment_id
       WHERE sr.user_id = $1
       ORDER BY sr.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return res.rows;
  } catch (err) {
    logger.error('getUserSpinHistory error', err.message);
    throw err;
  }
}

export async function consumeSpin(client, userId) {
  try {
    const res = await client.query(
      `UPDATE users
       SET spin_count = spin_count - 1
       WHERE telegram_id = $1 AND spin_count > 0
       RETURNING spin_count`,
      [userId]
    );
    return res.rows[0] || null;
  } catch (err) {
    logger.error('consumeSpin error', err.message);
    throw err;
  }
}

export async function updateSegment(client, segmentId, type, value, label, color) {
  try {
    const res = await client.query(
      `UPDATE spin_segments
       SET type = $2, value = $3, label = $4, color = $5, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [segmentId, type, value, label, color]
    );
    return res.rows[0];
  } catch (err) {
    logger.error('updateSegment error', err.message);
    throw err;
  }
}

export async function getSpinStats(client) {
  try {
    const res = await client.query(
      `SELECT
         COUNT(*)                                                              AS total_spins,
         COUNT(*) FILTER (WHERE is_win = true)                                AS total_wins,
         COUNT(*) FILTER (WHERE is_win = false)                               AS total_miss,
         SUM(CASE WHEN prize_type = 'pul' AND is_win THEN prize_value::NUMERIC ELSE 0 END) AS total_money
       FROM spin_results`
    );
    return res.rows[0];
  } catch (err) {
    logger.error('getSpinStats error', err.message);
    throw err;
  }
}
