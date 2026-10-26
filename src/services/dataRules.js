export const ACTIVE_STATUSES = ['pending', 'confirmed', 'ready'];
export const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
export const newId = (prefix) => `${prefix}-${globalThis.crypto.randomUUID()}`;

export function requireProfile(data, id, role) {
  const profile = data.profiles.find((item) => item.id === id);
  if (!profile || profile.status !== 'active' || (role && profile.role !== role)) {
    throw new Error('This demo account cannot perform that action. Log in with the appropriate active account.');
  }
  return profile;
}

export function inventory(data, listingId) {
  let reserved = 0;
  let sold = 0;
  for (const reservation of data.reservations) {
    if (reservation.listing_id !== listingId) continue;
    if (ACTIVE_STATUSES.includes(reservation.status)) reserved += reservation.quantity;
    if (reservation.status === 'completed') sold += reservation.quantity;
  }
  const listing = data.listings.find((item) => item.id === listingId);
  return { reserved_quantity: round(reserved), sold_quantity: round(sold), available_quantity: round((listing?.listed_quantity || 0) - reserved - sold) };
}

export function addAudit(data, actorId, action, entityType, entityId, details, now = Date.now()) {
  const actor = data.profiles.find((item) => item.id === actorId);
  data.auditLogs.unshift({ id: newId('audit'), actor_id: actorId, actor_name: actor?.full_name || 'Demo system', action, entity_type: entityType, entity_id: entityId, details, created_at: new Date(now).toISOString() });
}

export function addNotification(data, userId, title, message, link, dedupeKey, now = Date.now()) {
  if (dedupeKey && data.notifications.some((item) => item.user_id === userId && item.dedupe_key === dedupeKey)) return;
  data.notifications.unshift({ id: newId('notice'), user_id: userId, title, message, link, dedupe_key: dedupeKey || null, created_at: new Date(now).toISOString(), is_read: false });
}

export function notifyOrder(data, reservation, title, message, now = Date.now()) {
  addNotification(data, reservation.buyer_id, title, message, `/buyer/${reservation.status === 'completed' ? 'purchases' : 'reservations'}?reservation=${reservation.id}`, null, now);
  addNotification(data, reservation.farmer_id, title, message, `/farmer/${['ready', 'completed'].includes(reservation.status) ? 'sales' : 'reservations'}?reservation=${reservation.id}`, null, now);
}

export function closeReservation(data, reservation, status, reason, actorId, now = Date.now()) {
  reservation.status = status;
  reservation.fulfillment_status = status;
  reservation.reason = reason;
  reservation.updated_at = new Date(now).toISOString();
  notifyOrder(data, reservation, `Reservation ${status}`, `${reservation.reservation_reference}: ${reason} The held quantity has been released.`, now);
  addAudit(data, actorId, `reservation_${status}`, 'reservation', reservation.id, reason, now);
}

export function maintainData(data, now = Date.now()) {
  for (const reservation of data.reservations) {
    if (ACTIVE_STATUSES.includes(reservation.status) && Date.parse(reservation.expires_at) <= now) {
      closeReservation(data, reservation, 'expired', 'The reservation window has ended.', 'system', now);
    } else if (reservation.status === 'ready' && Date.parse(reservation.expires_at) - now <= 4 * 3600000) {
      for (const userId of [reservation.farmer_id, reservation.buyer_id]) {
        const path = userId === reservation.farmer_id ? '/farmer/sales' : '/buyer/reservations';
        addNotification(data, userId, 'Handover reminder', `${reservation.produce_name} is ready. Complete the handover before the reservation expires.`, `${path}?reservation=${reservation.id}`, `pickup-reminder:${reservation.id}:${reservation.expires_at}`, now);
      }
    }
  }
  for (const listing of data.listings) {
    if (listing.status !== 'active') continue;
    const remaining = inventory(data, listing.id).available_quantity;
    if (remaining <= 0) continue;
    const hours = (Date.parse(listing.selling_deadline) - now) / 3600000;
    const farmer = data.profiles.find((item) => item.id === listing.farmer_id);
    if (hours <= 0) {
      addNotification(data, listing.farmer_id, 'Selling deadline reached', `${listing.produce_name} is no longer available in the marketplace. Review the produce before relisting.`, '/farmer/harvest', `expired:${listing.id}:${listing.selling_deadline}`, now);
    } else if (hours <= 24 && farmer?.preferences?.deadline_reminders !== false) {
      addNotification(data, listing.farmer_id, 'A harvest is selling soon', `${listing.produce_name} is approaching its selling deadline. Review your remaining quantity.`, '/farmer/harvest', `deadline:${listing.id}:${listing.selling_deadline}`, now);
    }
  }
}

export function numberValue(value, label, { min = 0, max = 1000000, positive = false } = {}) {
  const number = Number(value);
  if (value === '' || value == null || !Number.isFinite(number) || number < min || number > max || (positive && number <= 0)) {
    throw new Error(`${label} must be ${positive ? 'greater than zero' : `at least ${min}`} and no more than ${max.toLocaleString()}.`);
  }
  if (Math.abs(round(number) - number) > 0.0000001) throw new Error(`${label} supports up to two decimal places.`);
  return round(number);
}
