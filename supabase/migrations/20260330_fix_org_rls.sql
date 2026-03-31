-- Allow authenticated users to INSERT into organizations
CREATE POLICY "org_insert"
  ON organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to add themselves as owner of a new org
-- Replaces the old policy that required has_org_role (which fails for brand new orgs)
DROP POLICY IF EXISTS "org_members_insert" ON org_members;
CREATE POLICY "org_members_insert"
  ON org_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      role = 'owner'::org_role
      OR has_org_role(org_id, ARRAY['owner'::org_role, 'admin'::org_role])
    )
  );

-- Create waitlist table for LP early access form
CREATE TABLE IF NOT EXISTS waitlist (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  source text DEFAULT 'website',
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can insert waitlist"
  ON waitlist
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- SECURITY DEFINER function to create org + member + default project atomically
CREATE OR REPLACE FUNCTION create_organization(org_name text, org_slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_org_id uuid;
BEGIN
  INSERT INTO organizations (name, slug)
  VALUES (org_name, org_slug)
  RETURNING id INTO new_org_id;

  INSERT INTO org_members (org_id, user_id, role)
  VALUES (new_org_id, auth.uid(), 'owner');

  INSERT INTO projects (org_id, name, slug)
  VALUES (new_org_id, 'Default', 'default');

  RETURN new_org_id;
END;
$$;
