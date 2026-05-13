-- CREATE TABLE IF NOT EXISTS admin_channels (
--     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--     admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     channel_name VARCHAR(255) NOT NULL,
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
-- );

-- CREATE INDEX idx_admin_channels_admin_id ON admin_channels(admin_id);



DROP TABLE IF EXISTS admin_channels CASCADE;

CREATE TABLE admin_channels (
  id SERIAL PRIMARY KEY,
  admin_telegram_id BIGINT NOT NULL,
  channel_id BIGINT NOT NULL,
  granted_by BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(admin_telegram_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_channels_admin_id ON admin_channels(admin_telegram_id);