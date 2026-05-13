
export async function getReferralByReferredId(client, referredId) {
  const result = await client.query(
    'SELECT * FROM referrals WHERE referred_id = $1 ORDER BY level ASC',
    [referredId]
  );
  return result.rows;
}

export async function getReferralsByReferrerId(client, referrerId) {
  const result = await client.query(
    `SELECT r.*, u.username, u.first_name, u.last_name, c.name AS campaign_name, c.channel_id
     FROM referrals r
     LEFT JOIN users u ON u.telegram_id = r.referred_id
     LEFT JOIN campaigns c ON c.id = r.campaign_id
     WHERE r.referrer_id = $1 ORDER BY r.created_at DESC`,
    [referrerId]
  );
  return result.rows;
}

export async function createReferral(client, data) {
  const result = await client.query(
    `INSERT INTO referrals (referrer_id, referred_id, campaign_id, level, reward_amount, is_subscribed, is_rewarded)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (referrer_id, referred_id, level) DO NOTHING
     RETURNING *`,
    [
      data.referrerId,
      data.referredId,
      data.campaignId,
      data.level,
      data.rewardAmount,
      data.isSubscribed,
      data.isRewarded
    ]
  );
  return result.rows[0] || null;
}

export async function updateReferralSubscription(client, referralId, isSubscribed, isRewarded) {
  const result = await client.query(
    `UPDATE referrals SET is_subscribed = $1, is_rewarded = $2, updated_at = NOW()
     WHERE id = $3 RETURNING *`,
    [isSubscribed, isRewarded, referralId]
  );
  return result.rows[0] || null;
}

export async function getReferralSummaryByReferrer(client, referrerId) {
  const result = await client.query(
    `SELECT count(*) FILTER (WHERE is_subscribed) AS active_count,
            count(*) FILTER (WHERE is_rewarded) AS rewarded_count,
            SUM(reward_amount) FILTER (WHERE is_rewarded) AS earned_total,
            count(*) AS total_count
     FROM referrals WHERE referrer_id = $1`,
    [referrerId]
  );
  return result.rows[0] || {
    active_count: 0,
    rewarded_count: 0,
    earned_total: 0,
    total_count: 0
  };
}
