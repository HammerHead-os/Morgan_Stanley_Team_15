-- ==============================================================================
-- 1. PARTICIPANTS SCHEMA
-- ==============================================================================

CREATE TABLE public.participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Links this profile to the Supabase Auth system
    auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE, 
    photo_url TEXT,
    name TEXT NOT NULL,
    country TEXT,
    register_date TIMESTAMPTZ DEFAULT NOW(),
    activities_joined_count INTEGER DEFAULT 0,
    programmes_explored_count INTEGER DEFAULT 0,
    family_members JSONB DEFAULT '[]'::JSONB,
    home_district TEXT,
    favourite_programme TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.participant_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
    event_date DATE NOT NULL,
    programme_type TEXT NOT NULL,
    event_name TEXT NOT NULL,
    event_description TEXT,
    family_members_joined TEXT[] DEFAULT '{}', 
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 2. VOLUNTEERS SCHEMA
-- ==============================================================================

CREATE TABLE public.volunteers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    photo_url TEXT,
    name TEXT NOT NULL,
    country TEXT,
    register_date TIMESTAMPTZ DEFAULT NOW(),
    hours_contributed NUMERIC(10, 2) DEFAULT 0.00,
    activities_supported_count INTEGER DEFAULT 0,
    days_volunteered INTEGER DEFAULT 0,
    skills TEXT[] DEFAULT '{}',
    languages TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.volunteer_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    volunteer_id UUID NOT NULL REFERENCES public.volunteers(id) ON DELETE CASCADE,
    event_date DATE NOT NULL,
    programme_type TEXT NOT NULL,
    event_name TEXT NOT NULL,
    event_description TEXT,
    role_in_event TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 3. DONORS SCHEMA
-- ==============================================================================

CREATE TABLE public.donors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    photo_url TEXT,
    name TEXT NOT NULL,
    country TEXT,
    register_date TIMESTAMPTZ DEFAULT NOW(),
    total_donated NUMERIC(12, 2) DEFAULT 0.00,
    gifts_made_count INTEGER DEFAULT 0,
    giving_occasions INTEGER DEFAULT 0,
    regular_donation_amount NUMERIC(12, 2) DEFAULT 0.00,
    primary_fund TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.donor_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_id UUID NOT NULL REFERENCES public.donors(id) ON DELETE CASCADE,
    donation_date DATE NOT NULL,
    donation_type TEXT NOT NULL,
    description TEXT,
    amount_of_money NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- INDEXES FOR PERFORMANCE
-- ==============================================================================
-- Indexing the foreign keys makes our RLS subqueries significantly faster
CREATE INDEX idx_participant_activities_pid ON public.participant_activities(participant_id);
CREATE INDEX idx_volunteer_activities_vid ON public.volunteer_activities(volunteer_id);
CREATE INDEX idx_donor_records_did ON public.donor_records(donor_id);
CREATE INDEX idx_participants_auth_id ON public.participants(auth_id);
CREATE INDEX idx_volunteers_auth_id ON public.volunteers(auth_id);
CREATE INDEX idx_donors_auth_id ON public.donors(auth_id);


-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- 1. Enable RLS on all tables
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donor_records ENABLE ROW LEVEL SECURITY;

-- 2. Participant Policies
-- Users can only manage their own core profile [2]
CREATE POLICY "Users can manage their own participant profile"
ON public.participants FOR ALL TO authenticated
USING (auth_id = (select auth.uid()))
WITH CHECK (auth_id = (select auth.uid()));

-- Users can only manage activities linked to their own participant profile [2]
CREATE POLICY "Users can manage their own participant activities"
ON public.participant_activities FOR ALL TO authenticated
USING (
    participant_id IN (
        SELECT id FROM public.participants WHERE auth_id = (select auth.uid())
    )
)
WITH CHECK (
    participant_id IN (
        SELECT id FROM public.participants WHERE auth_id = (select auth.uid())
    )
);

-- 3. Volunteer Policies
CREATE POLICY "Users can manage their own volunteer profile"
ON public.volunteers FOR ALL TO authenticated
USING (auth_id = (select auth.uid()))
WITH CHECK (auth_id = (select auth.uid()));

CREATE POLICY "Users can manage their own volunteer activities"
ON public.volunteer_activities FOR ALL TO authenticated
USING (
    volunteer_id IN (
        SELECT id FROM public.volunteers WHERE auth_id = (select auth.uid())
    )
)
WITH CHECK (
    volunteer_id IN (
        SELECT id FROM public.volunteers WHERE auth_id = (select auth.uid())
    )
);

-- 4. Donor Policies
CREATE POLICY "Users can manage their own donor profile"
ON public.donors FOR ALL TO authenticated
USING (auth_id = (select auth.uid()))
WITH CHECK (auth_id = (select auth.uid()));

CREATE POLICY "Users can manage their own donor records"
ON public.donor_records FOR ALL TO authenticated
USING (
    donor_id IN (
        SELECT id FROM public.donors WHERE auth_id = (select auth.uid())
    )
)
WITH CHECK (
    donor_id IN (
        SELECT id FROM public.donors WHERE auth_id = (select auth.uid())
    )
);