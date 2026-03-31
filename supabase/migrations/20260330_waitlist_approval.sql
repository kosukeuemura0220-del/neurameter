-- Add approved column to waitlist
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS approved boolean DEFAULT false;

-- RPC to check if a user's email is approved
CREATE OR REPLACE FUNCTION is_approved_user(check_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM waitlist
    WHERE email = check_email AND approved = true
  );
END;
$$;
