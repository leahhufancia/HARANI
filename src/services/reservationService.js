import { getSnapshot, mutateData } from './storageService.js';
import { getListingById } from './produceService.js';
import { ACTIVE_STATUSES, addAudit, closeReservation, inventory, newId, notifyOrder, numberValue, requireProfile, round } from './dataRules.js';
import { listingCoordinates } from '../utils/location.js';

export function getReservations(data = getSnapshot(), { buyerId, farmerId } = {}) {
  return data.reservations.filter((item) => (!buyerId || item.buyer_id === buyerId) && (!farmerId || item.farmer_id === farmerId)).map((reservation) => ({
    ...reservation,
    listing: getListingById(data, reservation.listing_id),
    buyer: data.profiles.find((item) => item.id === reservation.buyer_id),
    farmer: data.profiles.find((item) => item.id === reservation.farmer_id),
  })).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

export async function createReservation(values) {
  return mutateData((data) => createReservationInData(data, values));
}

// Shared by direct reservations and atomic, multi-listing cart checkout.
export function createReservationInData(data, values) {
  requireProfile(data, values.buyer_id, 'buyer');
  if (!values.request_id) throw new Error('A reservation request reference is required. Please retry from the produce page.');
  const existing = data.reservations.find((item) => item.buyer_id === values.buyer_id && item.request_id === values.request_id);
  if (existing) return existing;
  const listing = getListingById(data, values.listing_id);
  if (!listing || listing.status !== 'active' || listing.farmer?.status !== 'active') throw new Error('This produce is no longer available for reservation.');
  const count = numberValue(values.quantity, 'Reservation quantity', { positive: true });
  if (count > inventory(data, listing.id).available_quantity) throw new Error('There is not enough available produce. Refresh the quantity and try again.');
  if (!['pickup', 'delivery'].includes(values.fulfillment_method)) throw new Error('Choose pickup or delivery.');
  if (values.fulfillment_method === 'pickup' && !listing.pickup_available) throw new Error('Pickup is not available for this listing.');
  if (values.fulfillment_method === 'delivery' && !listing.delivery_available) throw new Error('Delivery is not available for this listing.');
  const price = numberValue(listing.price_per_unit, 'Selling price');
  const subtotal = round(count * price);
  const additional_costs = values.fulfillment_method === 'delivery' ? numberValue(listing.delivery_fee, 'Delivery cost') : 0;
  const pickupCoordinates = listingCoordinates(listing);
  const id = newId('order');
  const reservation = {
    id, request_id: values.request_id, reservation_reference: `HRN-${id.slice(6, 14).toUpperCase()}-${id.slice(-4).toUpperCase()}`,
    listing_id: listing.id, buyer_id: values.buyer_id, farmer_id: listing.farmer_id,
    produce_name: listing.produce_name, image_url: listing.image_url, quantity: count, unit: listing.unit,
    price_per_unit: price, subtotal, additional_costs, total_amount: round(subtotal + additional_costs),
    pickup_location: listing.pickup_location_public ? listing.pickup_location : 'Location not provided',
    pickup_latitude: pickupCoordinates?.[0] ?? null, pickup_longitude: pickupCoordinates?.[1] ?? null,
    pickup_barangay: listing.pickup_location_public ? listing.pickup_barangay || '' : '',
    fulfillment_method: values.fulfillment_method,
    fulfillment_notes: String(values.fulfillment_notes || '').trim().slice(0, 500),
    status: 'pending', fulfillment_status: 'awaiting_confirmation', payment_status: 'not_recorded',
    created_at: new Date().toISOString(), expires_at: new Date(Math.min(Date.now() + 24 * 3600000, Date.parse(listing.selling_deadline))).toISOString(),
    confirmed_at: null, ready_at: null, completed_at: null, harvest_pass: null,
  };
  data.reservations.unshift(reservation);
  notifyOrder(data, reservation, 'New reservation', `${reservation.reservation_reference}: ${count} ${listing.unit} of ${listing.produce_name} is held while the farmer reviews the request.`);
  addAudit(data, values.buyer_id, 'reservation_created', 'reservation', id, `${count} ${listing.unit} of ${listing.produce_name} reserved.`);
  return reservation;
}

function findOrder(data, id, actorId) {
  const actor = requireProfile(data, actorId);
  const reservation = data.reservations.find((item) => item.id === id);
  if (!reservation || ![reservation.farmer_id, reservation.buyer_id].includes(actor.id)) throw new Error('This reservation does not belong to your demo account.');
  return reservation;
}

export async function transitionReservation(id, actorId, action, reason = '') {
  return mutateData((data) => {
    const reservation = findOrder(data, id, actorId);
    const isFarmer = reservation.farmer_id === actorId;
    if (action === 'cancel') {
      if (!ACTIVE_STATUSES.includes(reservation.status)) throw new Error('Only open reservations can be cancelled.');
      closeReservation(data, reservation, 'cancelled', String(reason).trim() || 'Cancelled by the demo account holder.', actorId);
    } else if (action === 'reject') {
      if (!isFarmer || reservation.status !== 'pending') throw new Error('Only the farmer can reject a pending reservation.');
      closeReservation(data, reservation, 'rejected', String(reason).trim() || 'The farmer could not accept this request.', actorId);
    } else if (action === 'confirm') {
      if (!isFarmer || reservation.status !== 'pending') throw new Error('Only pending reservations can be confirmed by the farmer.');
      reservation.status = 'confirmed';
      reservation.fulfillment_status = 'preparing';
      reservation.confirmed_at = new Date().toISOString();
      reservation.expires_at = data.listings.find((item) => item.id === reservation.listing_id).selling_deadline;
      reservation.harvest_pass = { verification_code: `HP-${globalThis.crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`, verified_at: null, verified_by: null };
      notifyOrder(data, reservation, 'Reservation confirmed', `${reservation.reservation_reference} is confirmed. The Digital Harvest Pass is now available.`);
      addAudit(data, actorId, 'reservation_confirmed', 'reservation', id, 'Reservation confirmed and a demo Harvest Pass issued.');
    } else if (action === 'ready') {
      if (!isFarmer || reservation.status !== 'confirmed') throw new Error('Only a confirmed reservation can be marked ready by the farmer.');
      reservation.status = 'ready';
      reservation.fulfillment_status = reservation.fulfillment_method === 'delivery' ? 'ready_for_delivery' : 'ready_for_pickup';
      reservation.ready_at = new Date().toISOString();
      notifyOrder(data, reservation, `Ready for ${reservation.fulfillment_method}`, `${reservation.produce_name} is ready. Bring the Digital Harvest Pass to the demo handover.`);
      addAudit(data, actorId, 'reservation_ready', 'reservation', id, `Order ready for ${reservation.fulfillment_method}.`);
    } else {
      throw new Error('Unsupported reservation action.');
    }
    return reservation;
  });
}

export async function completeHandover(id, farmerId, code) {
  return mutateData((data) => {
    requireProfile(data, farmerId, 'farmer');
    const reservation = findOrder(data, id, farmerId);
    if (reservation.farmer_id !== farmerId) throw new Error('Only the seller can complete this handover.');
    if (reservation.status !== 'ready' || reservation.harvest_pass?.verified_at) throw new Error('This order is not ready or its handover has already been completed.');
    if (!code || String(code).trim().toUpperCase() !== reservation.harvest_pass.verification_code) throw new Error('The verification code does not match this Harvest Pass.');
    const now = new Date().toISOString();
    reservation.status = 'completed';
    reservation.fulfillment_status = 'handed_over';
    reservation.completed_at = now;
    reservation.harvest_pass.verified_at = now;
    reservation.harvest_pass.verified_by = farmerId;
    notifyOrder(data, reservation, 'Handover completed', `${reservation.reservation_reference} is complete. Payment is separate and has not been automatically confirmed.`);
    addAudit(data, farmerId, 'handover_completed', 'reservation', id, 'Demo Harvest Pass verified and quantity moved from reserved to sold. Payment unchanged.');
    return reservation;
  });
}

export async function recordPayment(id, farmerId) {
  return mutateData((data) => {
    requireProfile(data, farmerId, 'farmer');
    const reservation = findOrder(data, id, farmerId);
    if (reservation.farmer_id !== farmerId || reservation.status !== 'completed' || reservation.payment_status !== 'not_recorded') throw new Error('Only the seller can record payment once for a completed handover.');
    reservation.payment_status = 'recorded_by_seller';
    reservation.payment_recorded_at = new Date().toISOString();
    notifyOrder(data, reservation, 'Demo payment manually recorded', `${reservation.reservation_reference}: the seller marked payment as received in this demo. No money was transferred or verified by Harani.`);
    addAudit(data, farmerId, 'payment_recorded', 'reservation', id, 'Manual demo payment record by seller. Not a processor confirmation.');
    return reservation;
  });
}
