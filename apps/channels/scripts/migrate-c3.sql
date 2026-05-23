-- Foundry Channels — C3 migration

-- AI-generated topic summary stored inline on the topic
ALTER TABLE channel_topics ADD COLUMN IF NOT EXISTS summary JSONB;
-- summary shape: { bullets: string[], action_items: string[], generated_at: string }

-- Index to efficiently find topics that already have a summary
CREATE INDEX IF NOT EXISTS idx_topics_summary ON channel_topics((summary IS NOT NULL));
