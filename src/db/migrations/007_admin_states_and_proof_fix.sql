CREATE TABLE IF NOT EXISTS admin_states (
  admin_telegram_id BIGINT PRIMARY KEY,
  state VARCHAR(50) NOT NULL DEFAULT 'IDLE',
  state_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_states_telegram_id ON admin_states(admin_telegram_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'proof_image'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'proof_file_id'
  ) THEN
    ALTER TABLE payments RENAME COLUMN proof_image TO proof_file_id;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'proof_file_id'
  ) THEN
    ALTER TABLE payments ADD COLUMN proof_file_id VARCHAR(255);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'proof_updated_at'
  ) THEN
    ALTER TABLE payments ADD COLUMN proof_updated_at TIMESTAMPTZ;
  END IF;
END $$;
