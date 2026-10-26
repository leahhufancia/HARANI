-- HARANI DATABASE FUNCTIONS
-- Run this in your Supabase SQL Editor after schema.sql

-- Function to create reservation with atomic inventory check
CREATE OR REPLACE FUNCTION create_reservation(
  p_listing_id UUID,
  p_buyer_id UUID,
  p_quantity DECIMAL,
  p_pickup_or_delivery TEXT,
  p_additional_costs DECIMAL DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_listing RECORD;
  v_farmer_id UUID;
  v_unit TEXT;
  v_price_per_unit DECIMAL;
  v_reserved_quantity DECIMAL;
  v_available_quantity DECIMAL;
  v_total_amount DECIMAL;
  v_reservation_reference TEXT;
  v_expires_at TIMESTAMP WITH TIME ZONE;
  v_new_reservation RESERVATIONS;
BEGIN
  -- Get listing details with lock
  SELECT * INTO v_listing
  FROM produce_listings
  WHERE id = p_listing_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Listing not found or not active');
  END IF;

  -- Calculate current reserved quantity
  SELECT COALESCE(SUM(quantity), 0) INTO v_reserved_quantity
  FROM reservations
  WHERE listing_id = p_listing_id
  AND status IN ('pending', 'confirmed', 'ready');

  -- Calculate available quantity
  v_available_quantity := v_listing.available_quantity - v_reserved_quantity;

  -- Check if enough stock
  IF p_quantity > v_available_quantity THEN
    RETURN json_build_object('error', 'Insufficient stock available');
  END IF;

  -- Calculate total amount
  v_total_amount := (p_quantity * v_listing.price_per_unit) + p_additional_costs;

  -- Generate unique reference
  v_reservation_reference := 'RES-' || upper(substr(md5(random()::text), 1, 8));

  -- Set expiration (24 hours from now)
  v_expires_at := NOW() + INTERVAL '24 hours';

  -- Create reservation
  INSERT INTO reservations (
    listing_id,
    buyer_id,
    farmer_id,
    quantity,
    unit,
    agreed_price,
    additional_costs,
    total_amount,
    reservation_reference,
    pickup_or_delivery,
    status,
    expires_at
  ) VALUES (
    p_listing_id,
    p_buyer_id,
    v_listing.farmer_id,
    p_quantity,
    v_listing.unit,
    v_listing.price_per_unit,
    p_additional_costs,
    v_total_amount,
    v_reservation_reference,
    p_pickup_or_delivery,
    'pending',
    v_expires_at
  ) RETURNING * INTO v_new_reservation;

  -- Notify farmer
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    link,
    related_reservation_id,
    related_listing_id
  ) VALUES (
    v_listing.farmer_id,
    'new_reservation',
    'New Reservation',
    'You have a new reservation request for ' || v_listing.produce_name,
    '/farmer/reservations',
    v_new_reservation.id,
    p_listing_id
  );

  RETURN json_build_object('success', true, 'reservation', v_new_reservation);
END;
$$;

-- Function to confirm reservation
CREATE OR REPLACE FUNCTION confirm_reservation(p_reservation_id UUID)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_reservation RECORD;
BEGIN
  -- Get reservation with lock
  SELECT * INTO v_reservation
  FROM reservations
  WHERE id = p_reservation_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Reservation not found or not in pending status');
  END IF;

  -- Update reservation status
  UPDATE reservations
  SET status = 'confirmed',
      confirmed_at = NOW()
  WHERE id = p_reservation_id;

  -- Notify buyer
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    link,
    related_reservation_id
  ) VALUES (
    v_reservation.buyer_id,
    'reservation_confirmed',
    'Reservation Confirmed',
    'Your reservation has been confirmed by the seller',
    '/buyer/reservations',
    p_reservation_id
  );

  RETURN json_build_object('success', true);
END;
$$;

-- Function to reject reservation
CREATE OR REPLACE FUNCTION reject_reservation(
  p_reservation_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_reservation RECORD;
BEGIN
  -- Get reservation with lock
  SELECT * INTO v_reservation
  FROM reservations
  WHERE id = p_reservation_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Reservation not found or not in pending status');
  END IF;

  -- Update reservation status
  UPDATE reservations
  SET status = 'rejected',
      rejection_reason = p_reason,
      cancelled_at = NOW()
  WHERE id = p_reservation_id;

  -- Notify buyer
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    link,
    related_reservation_id
  ) VALUES (
    v_reservation.buyer_id,
    'reservation_rejected',
    'Reservation Rejected',
    'Your reservation has been rejected' ||
      CASE WHEN p_reason IS NOT NULL THEN ': ' || p_reason ELSE '' END,
    '/buyer/reservations',
    p_reservation_id
  );

  RETURN json_build_object('success', true);
END;
$$;

-- Function to cancel reservation
CREATE OR REPLACE FUNCTION cancel_reservation(p_reservation_id UUID)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_reservation RECORD;
BEGIN
  -- Get reservation with lock
  SELECT * INTO v_reservation
  FROM reservations
  WHERE id = p_reservation_id
  AND status IN ('pending', 'confirmed')
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Reservation not found or cannot be cancelled');
  END IF;

  -- Update reservation status
  UPDATE reservations
  SET status = 'cancelled',
      cancelled_at = NOW()
  WHERE id = p_reservation_id;

  -- Notify farmer
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    link,
    related_reservation_id
  ) VALUES (
    v_reservation.farmer_id,
    'reservation_cancelled',
    'Reservation Cancelled',
    'A reservation has been cancelled by the buyer',
    '/farmer/reservations',
    p_reservation_id
  );

  RETURN json_build_object('success', true);
END;
$$;

-- Function to complete handover
CREATE OR REPLACE FUNCTION complete_handover(p_reservation_id UUID)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_reservation RECORD;
  v_listing RECORD;
  v_verification_code TEXT;
  v_harvest_pass HARVEST_PASSES;
BEGIN
  -- Get reservation with lock
  SELECT * INTO v_reservation
  FROM reservations
  WHERE id = p_reservation_id AND status = 'ready'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Reservation not found or not ready for handover');
  END IF;

  -- Get listing
  SELECT * INTO v_listing
  FROM produce_listings
  WHERE id = v_reservation.listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Listing not found');
  END IF;

  -- Generate verification code
  v_verification_code := upper(substr(md5(random()::text), 1, 12));

  -- Create harvest pass
  INSERT INTO harvest_passes (
    reservation_id,
    verification_code
  ) VALUES (
    p_reservation_id,
    v_verification_code
  ) RETURNING * INTO v_harvest_pass;

  -- Update reservation status
  UPDATE reservations
  SET status = 'completed',
      completed_at = NOW()
  WHERE id = p_reservation_id;

  -- Update listing quantity
  UPDATE produce_listings
  SET available_quantity = available_quantity - v_reservation.quantity
  WHERE id = v_reservation.listing_id;

  -- Check if listing is now sold out
  IF (SELECT available_quantity FROM produce_listings WHERE id = v_reservation.listing_id) = 0 THEN
    UPDATE produce_listings
    SET status = 'sold'
    WHERE id = v_reservation.listing_id;
  END IF;

  -- Notify both parties
  INSERT INTO notifications (user_id, type, title, message, link, related_reservation_id)
  VALUES
    (v_reservation.buyer_id, 'handover_completed', 'Handover Completed', 'Your purchase has been completed', '/buyer/purchases', p_reservation_id),
    (v_reservation.farmer_id, 'handover_completed', 'Handover Completed', 'A sale has been completed', '/farmer/sales-handover', p_reservation_id);

  RETURN json_build_object('success', true, 'harvest_pass', v_harvest_pass);
END;
$$;

-- Function to verify harvest pass
CREATE OR REPLACE FUNCTION verify_harvest_pass(
  p_verification_code TEXT,
  p_verifier_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_harvest_pass RECORD;
  v_reservation RECORD;
BEGIN
  -- Get harvest pass
  SELECT * INTO v_harvest_pass
  FROM harvest_passes
  WHERE verification_code = p_verification_code;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Invalid verification code');
  END IF;

  -- Get reservation
  SELECT * INTO v_reservation
  FROM reservations
  WHERE id = v_harvest_pass.reservation_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Reservation not found');
  END IF;

  -- Check if already verified
  IF v_harvest_pass.verified_at IS NOT NULL THEN
    RETURN json_build_object('error', 'Harvest pass already verified');
  END IF;

  -- Check if verifier is authorized (farmer or buyer of the reservation)
  IF p_verifier_id NOT IN (v_reservation.farmer_id, v_reservation.buyer_id) THEN
    RETURN json_build_object('error', 'Not authorized to verify this pass');
  END IF;

  -- Mark as verified
  UPDATE harvest_passes
  SET verified_at = NOW(),
      verified_by = p_verifier_id
  WHERE id = v_harvest_pass.id;

  -- Record verification
  INSERT INTO handover_verifications (
    harvest_pass_id,
    verified_by,
    verification_method,
    verified_at
  ) VALUES (
    v_harvest_pass.id,
    p_verifier_id,
    'code',
    NOW()
  );

  RETURN json_build_object('success', true, 'reservation', v_reservation);
END;
$$;

-- Function to process expired reservations (run periodically)
CREATE OR REPLACE FUNCTION process_expired_reservations()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update expired pending reservations
  UPDATE reservations
  SET status = 'expired',
      cancelled_at = NOW()
  WHERE status = 'pending'
  AND expires_at < NOW();

  -- Notify affected parties
  INSERT INTO notifications (user_id, type, title, message, link, related_reservation_id)
  SELECT
    buyer_id,
    'reservation_expired',
    'Reservation Expired',
    'Your reservation has expired',
    '/buyer/reservations',
    id
  FROM reservations
  WHERE status = 'expired'
  AND cancelled_at = NOW();

  INSERT INTO notifications (user_id, type, title, message, link, related_reservation_id)
  SELECT DISTINCT
    farmer_id,
    'reservation_expired',
    'Reservation Expired',
    'A reservation has expired',
    '/farmer/reservations',
    id
  FROM reservations
  WHERE status = 'expired'
  AND cancelled_at = NOW();
END;
$$;

-- Create a pg_cron job to process expired reservations daily (if pg_cron is available)
-- SELECT cron.schedule('process-expired-reservations', '0 0 * * *', 'SELECT process_expired_reservations()');
