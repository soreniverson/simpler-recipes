-- Supabase schema for cross-device sync
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

-- User data table - stores all synced data per user
CREATE TABLE IF NOT EXISTS user_data (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  favorites JSONB DEFAULT '{"version":2,"folders":[],"items":[]}',
  favorites_updated_at TIMESTAMPTZ DEFAULT NOW(),
  meal_plans JSONB DEFAULT '{"version":1,"plans":{}}',
  meal_plans_updated_at TIMESTAMPTZ DEFAULT NOW(),
  pantry JSONB DEFAULT '{"version":1,"items":[]}',
  pantry_updated_at TIMESTAMPTZ DEFAULT NOW(),
  settings JSONB DEFAULT '{}',
  settings_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can view own data" ON user_data
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data" ON user_data
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own data" ON user_data
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to auto-create user_data row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_data (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user_data on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Index for faster lookups (though primary key already provides this)
CREATE INDEX IF NOT EXISTS idx_user_data_user_id ON user_data(user_id);
