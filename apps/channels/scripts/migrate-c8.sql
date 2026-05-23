-- C8: Communication Memory — embedding index

CREATE EXTENSION IF NOT EXISTS vector;

-- Embedding columns on source tables
ALTER TABLE channel_messages
  ADD COLUMN IF NOT EXISTS embedding vector(768);

ALTER TABLE video_transcripts
  ADD COLUMN IF NOT EXISTS embedding vector(768);

-- HNSW indexes for cosine similarity (best accuracy for recall)
CREATE INDEX IF NOT EXISTS channel_messages_embedding_hnsw
  ON channel_messages USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS video_transcripts_embedding_hnsw
  ON video_transcripts USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;
