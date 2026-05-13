CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    reward DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    channel_id BIGINT UNIQUE NOT NULL, -- The Telegram channel ID associated with the campaign
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_campaigns_channel_id ON campaigns(channel_id);
