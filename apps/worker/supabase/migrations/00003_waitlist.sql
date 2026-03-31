-- Waitlist table for landing page email capture
CREATE TABLE IF NOT EXISTS waitlist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  source     TEXT DEFAULT 'website',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Allow anonymous inserts (landing page has no auth)
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can join waitlist"
  ON waitlist FOR INSERT
  TO anon
  WITH CHECK (true);

-- Only authenticated service role can read
CREATE POLICY "Service role can read waitlist"
  ON waitlist FOR SELECT
  TO service_role
  USING (true);
