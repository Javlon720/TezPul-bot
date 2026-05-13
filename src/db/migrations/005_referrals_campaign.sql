ALTER TABLE referrals
  ADD COLUMN campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  ADD COLUMN is_active BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_referrals_campaign_id ON referrals(campaign_id);
CREATE INDEX IF NOT EXISTS idx_referrals_is_active ON referrals(is_active);
