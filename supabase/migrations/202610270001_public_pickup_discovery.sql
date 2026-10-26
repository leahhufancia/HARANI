-- Additive migration for the checked-in schema.sql, not the browser-local demo store.
-- No existing pickup pins or private profile locations are copied, cleared, or published.
BEGIN;

ALTER TABLE public.produce_listings
  ADD COLUMN pickup_barangay TEXT NOT NULL DEFAULT '',
  ADD COLUMN pickup_location_public BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.produce_listings
  ADD CONSTRAINT produce_listings_pickup_barangay_length
    CHECK (char_length(pickup_barangay) <= 100) NOT VALID,
  ADD CONSTRAINT produce_listings_pickup_coordinate_pair
    CHECK (
      (pickup_latitude IS NULL AND pickup_longitude IS NULL)
      OR (
        pickup_latitude IS NOT NULL AND pickup_longitude IS NOT NULL
        AND pickup_latitude BETWEEN -90 AND 90
        AND pickup_longitude BETWEEN -180 AND 180
      )
    ) NOT VALID;

-- NOT VALID preserves legacy rows as-is, while new/updated rows must have a valid pair.
-- Old invalid pairs also stay masked by the RPC until an owner corrects them.
-- These are public seller labels, never a backfill from full_name or other private data.
ALTER TABLE public.profiles
  ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended')),
  ADD COLUMN seller_name TEXT NOT NULL DEFAULT '';

-- The legacy own-profile UPDATE policy otherwise permits self-promotion or self-approval.
-- Keep its row access unchanged, but reserve identity/role/status/verification changes
-- for active admins or trusted service/database maintenance. This is not a general
-- repair of the legacy schema's other policies or reservation functions.
CREATE FUNCTION public.guard_profile_privileged_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
BEGIN
  IF ROW(NEW.id, NEW.role, NEW.status, NEW.verification_status)
      IS DISTINCT FROM ROW(OLD.id, OLD.role, OLD.status, OLD.verification_status) THEN
    IF auth.role() = 'service_role'
      OR (
        auth.uid() IS NULL
        AND current_setting('role', TRUE) = 'none'
        AND EXISTS (
          SELECT 1 FROM pg_catalog.pg_roles AS database_role
          WHERE database_role.rolname = session_user
            AND (database_role.rolsuper OR database_role.rolbypassrls)
        )
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles AS actor
        WHERE actor.id = auth.uid() AND actor.role = 'admin' AND actor.status = 'active'
      ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Only an active administrator may change privileged profile fields.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_profile_privileged_fields() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_profile_privileged_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_fields();

-- Listing UPDATE already holds the listing row lock used by legacy create_reservation.
-- Only unexpired open holds lock agreed pickup details; no reservation data is returned.
CREATE FUNCTION public.guard_reserved_pickup_location()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
BEGIN
  IF ROW(NEW.produce_name, NEW.pickup_location, NEW.pickup_barangay,
         NEW.pickup_latitude, NEW.pickup_longitude, NEW.pickup_location_public)
      IS DISTINCT FROM
     ROW(OLD.produce_name, OLD.pickup_location, OLD.pickup_barangay,
         OLD.pickup_latitude, OLD.pickup_longitude, OLD.pickup_location_public)
    AND EXISTS (
      SELECT 1 FROM public.reservations AS reservation
      WHERE reservation.listing_id = OLD.id
        AND reservation.status IN ('pending', 'confirmed', 'ready')
        AND reservation.expires_at > CURRENT_TIMESTAMP
    ) THEN
    RAISE EXCEPTION 'Keep the produce name and pickup location unchanged while reservations are open.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_reserved_pickup_location() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_reserved_pickup_location
  BEFORE UPDATE ON public.produce_listings
  FOR EACH ROW EXECUTE FUNCTION public.guard_reserved_pickup_location();

-- Never put NOW()/CURRENT_TIMESTAMP in an index predicate: expiry is evaluated at read time.
CREATE INDEX idx_public_listings_active_deadline
  ON public.produce_listings (selling_deadline, created_at DESC)
  WHERE status = 'active';

CREATE INDEX idx_public_listings_pickup_coordinates
  ON public.produce_listings (pickup_latitude, pickup_longitude)
  WHERE status = 'active' AND pickup_location_public IS TRUE
    AND pickup_latitude BETWEEN -90 AND 90 AND pickup_longitude BETWEEN -180 AND 180;

CREATE INDEX idx_public_listing_unexpired_holds
  ON public.reservations (listing_id, expires_at) INCLUDE (quantity)
  WHERE status IN ('pending', 'confirmed', 'ready');

-- The old buyer policy exposes raw, unconfirmed pickup text and pins. Do not replace
-- it with another broad table read: public/buyer browsing must use the safe RPC below.
-- Existing owner/admin listing policies and all profile policies/grants are unchanged.
DROP POLICY IF EXISTS "Buyers can view active listings" ON public.produce_listings;

-- Legacy inventory contract: available_quantity is UNSOLD stock, not the demo's
-- listed_quantity. complete_handover already subtracts completed quantities, so only
-- UNEXPIRED pending/confirmed/ready holds are subtracted here, never completed orders.
-- A malformed nonpositive/nonfinite hold hides its listing rather than inflating stock.
-- Legacy DATE deadlines include the entire selling day in Asia/Manila. The public
-- timestamp is the EXCLUSIVE next-midnight expiry, not midnight UTC at the day's start.
-- No-argument calls discover active in-stock produce. An ID call may also return a
-- reserved/sold/expired record for receipt continuity, never withdrawn or hidden states.
-- Legacy pickup was mandatory, and there is no listing delivery-fee or demo-pin column:
-- expose pickup_available=true, delivery_fee=0, location_is_demo=false without inventing
-- new stored fulfillment data. Reservation additional_costs remains a separate contract.
CREATE FUNCTION public.get_public_listings(p_listing_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  farmer_id UUID,
  produce_name TEXT,
  category TEXT,
  condition_details TEXT,
  harvest_date DATE,
  unit TEXT,
  price_per_unit NUMERIC,
  available_quantity NUMERIC,
  urgency TEXT,
  selling_deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  image_url TEXT,
  pickup_available BOOLEAN,
  delivery_available BOOLEAN,
  delivery_fee NUMERIC,
  status TEXT,
  pickup_location TEXT,
  pickup_barangay TEXT,
  pickup_latitude NUMERIC,
  pickup_longitude NUMERIC,
  pickup_location_public BOOLEAN,
  location_is_demo BOOLEAN,
  farmer JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  WITH candidates AS (
    SELECT
      listing.id, listing.farmer_id, listing.produce_name,
      COALESCE(category.name, '') AS category,
      listing.condition_details, listing.harvest_date, listing.unit,
      listing.price_per_unit,
      listing.available_quantity - holds.quantity AS remaining_quantity,
      listing.selling_urgency AS urgency,
      (listing.selling_deadline + 1)::TIMESTAMP AT TIME ZONE 'Asia/Manila' AS deadline,
      listing.created_at, listing.updated_at, listing.image_url,
      COALESCE(listing.delivery_available, FALSE) AS delivery_available,
      CASE
        WHEN listing.status <> 'active' THEN listing.status
        WHEN listing.available_quantity = 0 THEN 'sold'
        WHEN listing.selling_deadline < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::DATE THEN 'expired'
        WHEN listing.available_quantity - holds.quantity <= 0 THEN 'reserved'
        ELSE 'active'
      END AS effective_status,
      listing.pickup_location, listing.pickup_barangay,
      listing.pickup_latitude, listing.pickup_longitude, listing.pickup_location_public,
      seller.seller_name, seller.verification_status
    FROM public.produce_listings AS listing
    JOIN public.profiles AS seller
      ON seller.id = listing.farmer_id AND seller.role = 'farmer' AND seller.status = 'active'
    LEFT JOIN public.produce_categories AS category ON category.id = listing.category_id
    LEFT JOIN LATERAL (
      SELECT CASE
        WHEN bool_and(reservation.quantity > 0 AND reservation.quantity < 'Infinity'::NUMERIC) IS NOT FALSE
          THEN COALESCE(sum(reservation.quantity), 0)
        ELSE NULL
      END AS quantity
      FROM public.reservations AS reservation
      WHERE reservation.listing_id = listing.id
        AND reservation.status IN ('pending', 'confirmed', 'ready')
        AND reservation.expires_at > CURRENT_TIMESTAMP
    ) AS holds ON TRUE
    WHERE listing.status IN ('active', 'reserved', 'sold', 'expired')
      AND isfinite(listing.selling_deadline)
      AND listing.available_quantity >= 0 AND listing.available_quantity < 'Infinity'::NUMERIC
      AND listing.price_per_unit >= 0 AND listing.price_per_unit < 'Infinity'::NUMERIC
      AND (
        (p_listing_id IS NULL AND listing.status = 'active'
          AND listing.selling_deadline >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::DATE)
        OR listing.id = p_listing_id
      )
  )
  SELECT
    candidate.id, candidate.farmer_id, candidate.produce_name,
    candidate.category, candidate.condition_details, candidate.harvest_date, candidate.unit,
    candidate.price_per_unit, candidate.remaining_quantity, candidate.urgency,
    candidate.deadline, candidate.created_at, candidate.updated_at, candidate.image_url,
    TRUE, candidate.delivery_available, 0::NUMERIC, candidate.effective_status,
    CASE WHEN candidate.pickup_location_public IS TRUE THEN candidate.pickup_location ELSE '' END,
    CASE WHEN candidate.pickup_location_public IS TRUE THEN candidate.pickup_barangay ELSE '' END,
    CASE WHEN candidate.pickup_location_public IS TRUE
        AND candidate.pickup_latitude BETWEEN -90 AND 90 AND candidate.pickup_longitude BETWEEN -180 AND 180
      THEN candidate.pickup_latitude ELSE NULL END,
    CASE WHEN candidate.pickup_location_public IS TRUE
        AND candidate.pickup_latitude BETWEEN -90 AND 90 AND candidate.pickup_longitude BETWEEN -180 AND 180
      THEN candidate.pickup_longitude ELSE NULL END,
    candidate.pickup_location_public IS TRUE, FALSE,
    jsonb_build_object(
      'id', candidate.farmer_id,
      'seller_name', COALESCE(NULLIF(candidate.seller_name, ''), 'Local farmer'),
      'verification_status', candidate.verification_status,
      'status', 'active',
      'role', 'farmer'
    )
  FROM candidates AS candidate
  WHERE candidate.remaining_quantity >= 0 AND candidate.remaining_quantity < 'Infinity'::NUMERIC
    AND (p_listing_id IS NOT NULL
      OR (candidate.effective_status = 'active' AND candidate.remaining_quantity > 0
        AND candidate.deadline > CURRENT_TIMESTAMP))
  ORDER BY candidate.created_at DESC, candidate.id;
$function$;

REVOKE ALL ON FUNCTION public.get_public_listings(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_listings(UUID) TO anon, authenticated;

COMMIT;
