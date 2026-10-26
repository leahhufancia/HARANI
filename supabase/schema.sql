-- HARANI DATABASE SCHEMA
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PROFILES TABLE
-- Extends Supabase auth.users with additional fields
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('farmer', 'buyer', 'admin')),
  full_name TEXT,
  phone TEXT,
  location TEXT,
  buyer_type TEXT CHECK (buyer_type IN ('household', 'business')),
  farm_address TEXT,
  farm_latitude DECIMAL(10, 8),
  farm_longitude DECIMAL(11, 8),
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PRODUCE CATEGORIES
CREATE TABLE public.produce_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PRODUCE LISTINGS
CREATE TABLE public.produce_listings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  farmer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.produce_categories(id) ON DELETE SET NULL,
  produce_name TEXT NOT NULL,
  description TEXT,
  harvest_date DATE,
  condition_details TEXT,
  available_quantity DECIMAL(10, 2) NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('kg', 'bundle', 'piece', 'crate', 'sack')),
  price_per_unit DECIMAL(10, 2) NOT NULL,
  pickup_location TEXT NOT NULL,
  pickup_latitude DECIMAL(10, 8),
  pickup_longitude DECIMAL(11, 8),
  selling_urgency TEXT NOT NULL CHECK (selling_urgency IN ('sell-now', 'sell-today', 'planned')),
  selling_deadline DATE NOT NULL,
  delivery_available BOOLEAN DEFAULT FALSE,
  image_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'reserved', 'sold', 'expired', 'withdrawn')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- LISTING IMAGES
CREATE TABLE public.listing_images (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  listing_id UUID REFERENCES public.produce_listings(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RESERVATIONS
CREATE TABLE public.reservations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  listing_id UUID REFERENCES public.produce_listings(id) ON DELETE CASCADE NOT NULL,
  buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  farmer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  unit TEXT NOT NULL,
  agreed_price DECIMAL(10, 2) NOT NULL,
  additional_costs DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  reservation_reference TEXT UNIQUE NOT NULL,
  pickup_or_delivery TEXT NOT NULL CHECK (pickup_or_delivery IN ('pickup', 'delivery')),
  pickup_details TEXT,
  delivery_address TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'ready', 'completed', 'cancelled', 'rejected', 'expired')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  ready_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DIGITAL HARVEST PASSES
CREATE TABLE public.harvest_passes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE CASCADE NOT NULL UNIQUE,
  verification_code TEXT UNIQUE NOT NULL,
  qr_code_url TEXT,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- HANDOVER VERIFICATION RECORDS
CREATE TABLE public.handover_verifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  harvest_pass_id UUID REFERENCES public.harvest_passes(id) ON DELETE CASCADE NOT NULL,
  verified_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  verification_method TEXT NOT NULL CHECK (verification_method IN ('code', 'qr', 'manual')),
  verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  notes TEXT
);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  related_reservation_id UUID REFERENCES public.reservations(id) ON DELETE CASCADE,
  related_listing_id UUID REFERENCES public.produce_listings(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- VERIFICATION SUBMISSIONS
CREATE TABLE public.verification_submissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  document_type TEXT NOT NULL,
  document_url TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_notes TEXT
);

-- AUDIT LOGS
CREATE TABLE public.audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  affected_table TEXT NOT NULL,
  affected_record_id UUID,
  old_values JSONB,
  new_values JSONB,
  reason TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX idx_produce_listings_farmer_id ON public.produce_listings(farmer_id);
CREATE INDEX idx_produce_listings_status ON public.produce_listings(status);
CREATE INDEX idx_produce_listings_category_id ON public.produce_listings(category_id);
CREATE INDEX idx_produce_listings_selling_urgency ON public.produce_listings(selling_urgency);
CREATE INDEX idx_produce_listings_selling_deadline ON public.produce_listings(selling_deadline);
CREATE INDEX idx_reservations_buyer_id ON public.reservations(buyer_id);
CREATE INDEX idx_reservations_farmer_id ON public.reservations(farmer_id);
CREATE INDEX idx_reservations_listing_id ON public.reservations(listing_id);
CREATE INDEX idx_reservations_status ON public.reservations(status);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX idx_audit_logs_actor_id ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at);

-- ROW LEVEL SECURITY POLICIES

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Produce Listings
ALTER TABLE public.produce_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farmers can view own listings"
  ON public.produce_listings FOR SELECT
  USING (auth.uid() = farmer_id);

CREATE POLICY "Buyers can view active listings"
  ON public.produce_listings FOR SELECT
  USING (
    status = 'active' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'buyer'
    )
  );

CREATE POLICY "Farmers can create own listings"
  ON public.produce_listings FOR INSERT
  WITH CHECK (auth.uid() = farmer_id);

CREATE POLICY "Farmers can update own listings"
  ON public.produce_listings FOR UPDATE
  USING (auth.uid() = farmer_id);

CREATE POLICY "Admins can view all listings"
  ON public.produce_listings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Reservations
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farmers can view own reservations"
  ON public.reservations FOR SELECT
  USING (auth.uid() = farmer_id);

CREATE POLICY "Buyers can view own reservations"
  ON public.reservations FOR SELECT
  USING (auth.uid() = buyer_id);

CREATE POLICY "Buyers can create reservations"
  ON public.reservations FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Farmers can update reservation status"
  ON public.reservations FOR UPDATE
  USING (auth.uid() = farmer_id);

CREATE POLICY "Buyers can cancel own reservations"
  ON public.reservations FOR UPDATE
  USING (
    auth.uid() = buyer_id AND
    status IN ('pending', 'confirmed')
  );

CREATE POLICY "Admins can view all reservations"
  ON public.reservations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Audit Logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Insert default produce categories
INSERT INTO public.produce_categories (name, description) VALUES
  ('Vegetables', 'Fresh vegetables'),
  ('Fruits', 'Fresh fruits'),
  ('Herbs', 'Culinary and medicinal herbs'),
  ('Root Crops', 'Root vegetables and tubers'),
  ('Leafy Greens', 'Leafy green vegetables');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_produce_listings_updated_at BEFORE UPDATE ON public.produce_listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
