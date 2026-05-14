
-- Add role column to user_accounts
ALTER TABLE user_accounts ADD COLUMN role text NOT NULL DEFAULT 'student';

-- Create user_profiles table for persistent profile data
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bio text DEFAULT '',
  location text DEFAULT '',
  website text DEFAULT '',
  interests text[] DEFAULT '{}',
  avatar_color text DEFAULT 'av-c1',
  banner_color text DEFAULT 'banner-c1',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to user_profiles" ON user_profiles FOR ALL USING (true) WITH CHECK (true);

-- Create messages table for teacher-student messaging
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to messages" ON messages FOR ALL USING (true) WITH CHECK (true);

-- Create activity_days table for streak tracking
CREATE TABLE activity_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE activity_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to activity_days" ON activity_days FOR ALL USING (true) WITH CHECK (true);

-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;
