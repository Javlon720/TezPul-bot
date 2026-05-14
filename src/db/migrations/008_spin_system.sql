-- users jadvaliga spin ustunlari qo'shish
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS spin_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spin_count   INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_refs INTEGER       NOT NULL DEFAULT 0;

-- G'ildirak sektorlari — admin boshqaradi
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

-- Spin natijalari — audit log
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
CREATE INDEX IF NOT EXISTS idx_spin_results_created ON spin_results(created_at);
CREATE INDEX IF NOT EXISTS idx_spin_segments_active  ON spin_segments(is_active);

-- Default sektorlar (8 ta)
INSERT INTO spin_segments (type, value, label, color, sort_order) VALUES
  ('pul',        '5000',  '5 000',   '#1D9E75', 1),
  ('miss',       '',      'Miss',    '#D3D1C7', 2),
  ('pul',        '2000',  '2 000',   '#534AB7', 3),
  ('miss',       '',      'Miss',    '#D3D1C7', 4),
  ('pul',        '10000', '10 000',  '#E24B4A', 5),
  ('miss',       '',      'Miss',    '#D3D1C7', 6),
  ('premium',    '1 oy',  'Premium', '#BA7517', 7),
  ('pul',        '1000',  '1 000',   '#185FA5', 8)
ON CONFLICT DO NOTHING;
