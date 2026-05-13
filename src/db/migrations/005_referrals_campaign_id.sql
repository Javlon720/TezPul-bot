ALTER TABLE referrals
  ADD COLUMN campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  ADD COLUMN is_active BOOLEAN DEFAULT true,
  ADD COLUMN rewarded BOOLEAN DEFAULT false,
  ADD COLUMN direct_reward DECIMAL(15, 2) DEFAULT 0.00,
  ADD COLUMN parent_reward DECIMAL(15, 2) DEFAULT 0.00,
  ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN revoked_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_referrals_campaign_id ON referrals(campaign_id);
CREATE INDEX IF NOT EXISTS idx_referrals_is_active ON referrals(is_active);
