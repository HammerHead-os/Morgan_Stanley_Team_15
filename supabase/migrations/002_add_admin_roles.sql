-- ==============================================================================
-- 1. CREATE ADMINS TABLE
-- ==============================================================================

-- This table stores the auth.users IDs of anyone who is an admin.
CREATE TABLE public.admins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Secure the admins table itself
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Only admins can see the list of other admins
CREATE POLICY "Admins can view the admin list"
ON public.admins FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = (select auth.uid()))
);

-- ==============================================================================
-- 2. CREATE HELPER FUNCTION
-- ==============================================================================
-- Creating a reusable function keeps our policies clean and prevents us from 
-- writing the same subquery 12 times. 

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN 
LANGUAGE sql 
SECURITY DEFINER 
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins WHERE user_id = (select auth.uid())
  );
$$;

-- ==============================================================================
-- 3. ADD ADMIN POLICIES TO ALL EXISTING TABLES
-- ==============================================================================

-- Participants
CREATE POLICY "Admins have full access to participants"
ON public.participants FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admins have full access to participant_activities"
ON public.participant_activities FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Volunteers
CREATE POLICY "Admins have full access to volunteers"
ON public.volunteers FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admins have full access to volunteer_activities"
ON public.volunteer_activities FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Donors
CREATE POLICY "Admins have full access to donors"
ON public.donors FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admins have full access to donor_records"
ON public.donor_records FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());