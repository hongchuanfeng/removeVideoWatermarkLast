-- Supabase Database Schema
-- This file contains all the SQL scripts to create the necessary tables for the RemoveWatermark application

-- ============================================
-- 1. User Credits Table
-- ============================================
-- Stores user credit information and free trial status
CREATE TABLE IF NOT EXISTS user_credits (
  user_id TEXT PRIMARY KEY,
  credits INTEGER DEFAULT 0 NOT NULL,
  has_used_free_trial BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);

-- ============================================
-- 2. Subscription Orders Table
-- ============================================
-- Stores subscription order records from Creem payment system
CREATE TABLE IF NOT EXISTS subscription_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  product_id TEXT,
  credits INTEGER NOT NULL,
  event_type TEXT,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscription_orders_user_id ON subscription_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_orders_transaction_id ON subscription_orders(transaction_id);
CREATE INDEX IF NOT EXISTS idx_subscription_orders_created_at ON subscription_orders(created_at DESC);

-- ============================================
-- 3. Conversion Records Table
-- ============================================
-- Stores video and image conversion records
CREATE TABLE IF NOT EXISTS conversion_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'video_watermark_removed', 'video_logo_removed', 'video_subtitle_removed', 'image_watermark_removed'
  file_name TEXT NOT NULL, -- 文件名
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  original_file_url TEXT, -- 原始文件URL
  result_file_url TEXT, -- 结果文件URL
  credits_used INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  progress INTEGER DEFAULT 0, -- 0-100 percentage
  task_id TEXT, -- 腾讯云任务ID
  video_duration INTEGER, -- 视频时长（秒），图片处理时为NULL
  input_type TEXT DEFAULT 'video', -- 'video' or 'image'
  input_url TEXT, -- 输入文件URL
  output_url TEXT -- 输出文件URL
);

CREATE INDEX IF NOT EXISTS idx_conversion_records_user_id ON conversion_records(user_id);
CREATE INDEX IF NOT EXISTS idx_conversion_records_status ON conversion_records(status);
CREATE INDEX IF NOT EXISTS idx_conversion_records_created_at ON conversion_records(created_at DESC);

-- ============================================
-- 4. Contact Messages Table
-- ============================================
-- Stores contact form messages from users
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  user_id TEXT, -- Optional: user ID if user is logged in
  status TEXT NOT NULL DEFAULT 'new', -- 'new', 'read', 'replied', 'archived'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_user_id ON contact_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_email ON contact_messages(email);

-- ============================================
-- 5. System Logs Table
-- ============================================
-- Stores system operation logs for keep-alive and monitoring
CREATE TABLE IF NOT EXISTS system_logs (
  id BIGSERIAL PRIMARY KEY,
  log_time TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  log_data TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_system_logs_log_time ON system_logs(log_time DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
-- System logs table does not need RLS as it's for internal system use

-- User Credits: Users can only read their own credits
CREATE POLICY "Users can view their own credits"
  ON user_credits
  FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own credits"
  ON user_credits
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own credits"
  ON user_credits
  FOR UPDATE
  USING (auth.uid()::text = user_id);

-- Subscription Orders: Users can only read their own orders
CREATE POLICY "Users can view their own orders"
  ON subscription_orders
  FOR SELECT
  USING (auth.uid()::text = user_id);

-- Conversion Records: Users can only read their own conversions
CREATE POLICY "Users can view their own conversions"
  ON conversion_records
  FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own conversions"
  ON conversion_records
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own conversions"
  ON conversion_records
  FOR UPDATE
  USING (auth.uid()::text = user_id);

-- Contact Messages: Anyone can insert, but only admins can read all
-- For now, allow users to insert messages without authentication
CREATE POLICY "Anyone can insert contact messages"
  ON contact_messages
  FOR INSERT
  WITH CHECK (true);

-- Note: For production, you may want to add admin policies to read all messages
-- CREATE POLICY "Admins can view all messages"
--   ON contact_messages
--   FOR SELECT
--   USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================
-- Functions and Triggers
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to ensure user_credits record exists (called from application)
-- This function can be called with SECURITY DEFINER to bypass RLS if needed
CREATE OR REPLACE FUNCTION ensure_user_credits(p_user_id TEXT)
RETURNS void AS $$
BEGIN
  INSERT INTO user_credits (user_id, credits, has_used_free_trial)
  VALUES (p_user_id, 0, false)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers to automatically update updated_at
CREATE TRIGGER update_user_credits_updated_at
  BEFORE UPDATE ON user_credits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversion_records_updated_at
  BEFORE UPDATE ON conversion_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contact_messages_updated_at
  BEFORE UPDATE ON contact_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

