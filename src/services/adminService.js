import { mutateData } from './storageService.js';
import { ACTIVE_STATUSES, addAudit, addNotification, closeReservation, requireProfile } from './dataRules.js';

function requireReason(reason) {
  const text = String(reason || '').trim();
  if (text.length < 3 || text.length > 500) throw new Error('Provide a reason of 3 to 500 characters for the audit history.');
  return text;
}

export async function setUserStatus(id, adminId, status, reason) {
  return mutateData((data) => {
    requireProfile(data, adminId, 'admin');
    const profile = data.profiles.find((item) => item.id === id);
    const note = requireReason(reason);
    if (!profile || profile.role === 'admin' || !['active', 'suspended'].includes(status) || profile.status === status) throw new Error('This account is not eligible for that status change.');
    profile.status = status;
    if (status === 'suspended') {
      data.reservations.filter((item) => [item.buyer_id, item.farmer_id].includes(id) && ACTIVE_STATUSES.includes(item.status)).forEach((item) => closeReservation(data, item, 'cancelled', 'An account on this order was suspended in the demo.', adminId));
    }
    addAudit(data, adminId, `user_${status}`, 'profile', id, note);
    addNotification(data, id, `Demo account ${status}`, note, `/${profile.role}/profile`);
    return profile;
  });
}

export async function reviewVerification(id, adminId, decision, reason) {
  return mutateData((data) => {
    requireProfile(data, adminId, 'admin');
    const verification = data.verifications.find((item) => item.id === id);
    const note = requireReason(reason);
    if (!verification || verification.status !== 'pending' || !['verified', 'rejected'].includes(decision)) throw new Error('Only a pending demo verification can be reviewed.');
    const profile = data.profiles.find((item) => item.id === verification.user_id);
    verification.status = decision;
    verification.reviewed_at = new Date().toISOString();
    verification.reviewed_by = adminId;
    verification.reason = note;
    profile.verification_status = decision;
    addAudit(data, adminId, `verification_${decision}`, 'verification', id, note);
    addNotification(data, profile.id, 'Demo verification reviewed', `Your sample profile was ${decision}. This is not a real identity verification. ${note}`, `/${profile.role}/profile`);
    return verification;
  });
}

export async function moderateListing(id, adminId, hidden, reason) {
  return mutateData((data) => {
    requireProfile(data, adminId, 'admin');
    const listing = data.listings.find((item) => item.id === id);
    const note = requireReason(reason);
    if (!listing || (hidden ? listing.status !== 'active' : listing.status !== 'moderated')) throw new Error('This listing is not eligible for that moderation action.');
    listing.status = hidden ? 'moderated' : 'active';
    listing.moderation_reason = note;
    listing.updated_at = new Date().toISOString();
    if (hidden) {
      data.reservations.filter((item) => item.listing_id === id && ACTIVE_STATUSES.includes(item.status)).forEach((item) => closeReservation(data, item, 'cancelled', 'The listing was removed by the demo administrator.', adminId));
    }
    addAudit(data, adminId, hidden ? 'listing_moderated' : 'listing_restored', 'listing', id, note);
    addNotification(data, listing.farmer_id, hidden ? 'Listing hidden by demo administrator' : 'Listing restored', `${listing.produce_name}: ${note}`, '/farmer/harvest');
    return listing;
  });
}
