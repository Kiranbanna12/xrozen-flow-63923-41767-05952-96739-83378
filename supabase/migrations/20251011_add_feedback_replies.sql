-- Add parent_id column to video_feedback table for nested replies (YouTube-style)
-- Migration: Add Reply Support to Video Feedback

-- Add parent_id column to enable threaded comments
ALTER TABLE video_feedback ADD COLUMN IF NOT EXISTS parent_id TEXT REFERENCES video_feedback(id) ON DELETE CASCADE;

-- Add index for faster query of replies
CREATE INDEX IF NOT EXISTS idx_video_feedback_parent_id ON video_feedback(parent_id);

-- Add index for version_id + parent_id combination (for fetching top-level comments)
CREATE INDEX IF NOT EXISTS idx_video_feedback_version_parent ON video_feedback(version_id, parent_id);
