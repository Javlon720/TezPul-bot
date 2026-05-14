
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  phone VARCHAR(20),
  language VARCHAR(5) NOT NULL DEFAULT 'uz',
  referral_code VARCHAR(50) UNIQUE NOT NULL,
  referred_by BIGINT REFERENCES users(telegram_id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_states (
  telegram_id BIGINT PRIMARY KEY REFERENCES users(telegram_id) ON DELETE CASCADE,
  state VARCHAR(50) NOT NULL DEFAULT 'IDLE',
  state_data JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_states (
  admin_telegram_id BIGINT PRIMARY KEY,
  state VARCHAR(50) NOT NULL DEFAULT 'IDLE',
  state_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_states_telegram_id ON admin_states(admin_telegram_id);

CREATE TABLE IF NOT EXISTS campaigns (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  channel_id BIGINT NOT NULL,
  channel_username VARCHAR(255),
  reward_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  level2_reward_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referrals (
  id SERIAL PRIMARY KEY,
  referrer_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  referred_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
  level INTEGER NOT NULL DEFAULT 1,
  reward_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_subscribed BOOLEAN NOT NULL DEFAULT false,
  is_rewarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(referrer_id, referred_id, level)
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(12,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','partial','paid','cancelled')),
  proof_file_id VARCHAR(255),
  proof_updated_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_channels (
  id SERIAL PRIMARY KEY,
  admin_telegram_id BIGINT NOT NULL,
  channel_id BIGINT NOT NULL,
  granted_by BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(admin_telegram_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Spin tizimi uchun ustunlar (mavjud jadvalga qo'shiladi)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS spin_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spin_count   INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_refs INTEGER       NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS spin_segments (
  id         SERIAL PRIMARY KEY,
  type       VARCHAR(20)  NOT NULL CHECK (type IN ('pul','premium','bonus_spin','miss')),
  value      VARCHAR(50)  NOT NULL DEFAULT '',
  label      VARCHAR(50)  NOT NULL,
  color      VARCHAR(10)  NOT NULL DEFAULT '#1D9E75',
  sort_order INTEGER      NOT NULL DEFAULT 0,
  is_active  BOOLEAN      NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spin_results (
  id          SERIAL PRIMARY KEY,
  user_id     BIGINT      NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  segment_id  INTEGER     REFERENCES spin_segments(id) ON DELETE SET NULL,
  prize_type  VARCHAR(20) NOT NULL,
  prize_value VARCHAR(50) NOT NULL DEFAULT '',
  is_win      BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spin_results_user_id ON spin_results(user_id);
CREATE INDEX IF NOT EXISTS idx_spin_results_created  ON spin_results(created_at);
CREATE INDEX IF NOT EXISTS idx_spin_segments_active   ON spin_segments(is_active);

CREATE INDEX IF NOT EXISTS idx_users_is_active         ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_referred_by       ON users(referred_by);
CREATE INDEX IF NOT EXISTS idx_referrals_campaign_id   ON referrals(campaign_id);
CREATE INDEX IF NOT EXISTS idx_referrals_ref_campaign  ON referrals(referred_id, campaign_id);
CREATE INDEX IF NOT EXISTS idx_payments_status_user    ON payments(status, user_id);
CREATE INDEX IF NOT EXISTS idx_spin_results_user_time  ON spin_results(user_id, created_at DESC);

INSERT INTO spin_segments (type, value, label, color, sort_order) VALUES
  ('pul',     '5000',  '5 000',   '#1D9E75', 1),
  ('miss',    '',      'Miss',    '#D3D1C7', 2),
  ('pul',     '2000',  '2 000',   '#534AB7', 3),
  ('miss',    '',      'Miss',    '#D3D1C7', 4),
  ('pul',     '10000', '10 000',  '#E24B4A', 5),
  ('miss',    '',      'Miss',    '#D3D1C7', 6),
  ('premium', '1 oy',  'Premium', '#BA7517', 7),
  ('pul',     '1000',  '1 000',   '#185FA5', 8)
ON CONFLICT DO NOTHING;
