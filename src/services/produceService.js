import { getSnapshot, mutateData } from './storageService.js';
import { CATEGORIES } from './demoSeed.js';
import { ACTIVE_STATUSES, addAudit, addNotification, inventory, newId, numberValue, requireProfile } from './dataRules.js';
import { getCoordinates } from '../utils/location.js';

export { CATEGORIES };
export const UNITS = ['kg', 'g', 'bundle', 'piece', 'crate'];

export function getListings(data = getSnapshot()) {
  return data.listings.map((listing) => {
    const stock = inventory(data, listing.id);
    let status = listing.status;
    if (status === 'active') {
      if (stock.sold_quantity >= listing.listed_quantity) status = 'sold';
      else if (Date.parse(listing.selling_deadline) <= Date.now()) status = 'expired';
      else if (stock.available_quantity <= 0) status = 'reserved';
    }
    return { ...listing, ...stock, status, farmer: data.profiles.find((profile) => profile.id === listing.farmer_id) };
  }).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

export const getListingById = (data, id) => getListings(data).find((listing) => listing.id === id);

export function filterListings(listings, filters = {}) {
  const search = String(filters.search || '').trim().toLowerCase();
  const result = listings.filter((listing) => listing.status === 'active' && listing.farmer?.status === 'active'
    && (!search || listing.produce_name.toLowerCase().includes(search))
    && (!filters.category || listing.category === filters.category)
    && (filters.minPrice === '' || filters.minPrice == null || listing.price_per_unit >= Number(filters.minPrice))
    && (filters.maxPrice === '' || filters.maxPrice == null || listing.price_per_unit <= Number(filters.maxPrice))
    && (!filters.minQuantity || listing.available_quantity >= Number(filters.minQuantity))
    && (!filters.unit || listing.unit === filters.unit)
    && (!filters.urgency || listing.urgency === filters.urgency)
    && (!filters.fulfillment || (filters.fulfillment === 'pickup' ? listing.pickup_available : listing.delivery_available)));
  return result.sort((a, b) => {
    if (filters.sort === 'price-low') return a.price_per_unit - b.price_per_unit;
    if (filters.sort === 'price-high') return b.price_per_unit - a.price_per_unit;
    if (filters.sort === 'soonest') return Date.parse(a.selling_deadline) - Date.parse(b.selling_deadline);
    return Date.parse(b.created_at) - Date.parse(a.created_at);
  });
}

function validateListing(values) {
  const produce_name = String(values.produce_name || '').trim();
  const pickup_location = String(values.pickup_location || '').trim();
  const condition_details = String(values.condition_details || '').trim();
  if (produce_name.length < 2 || produce_name.length > 100) throw new Error('Produce name must contain 2 to 100 characters.');
  if (!CATEGORIES.includes(values.category)) throw new Error('Select a produce category.');
  if (!UNITS.includes(values.unit)) throw new Error('Select a supported unit of measurement.');
  if (!pickup_location || pickup_location.length > 200) throw new Error('Provide a general pickup location of up to 200 characters.');
  const hasMapPin = [values.pickup_latitude, values.pickup_longitude].some((value) => value != null && String(value).trim() !== '');
  const coordinates = getCoordinates(values.pickup_latitude, values.pickup_longitude);
  if (hasMapPin && !coordinates) throw new Error('Provide both valid pickup coordinates: latitude from -90 to 90 and longitude from -180 to 180.');
  if (condition_details.length > 1500) throw new Error('Keep condition details under 1,500 characters.');
  if (!['sell-now', 'sell-today', 'planned'].includes(values.urgency)) throw new Error('Choose a selling urgency.');
  const deadline = Date.parse(values.selling_deadline);
  if (!Number.isFinite(deadline) || deadline <= Date.now()) throw new Error('The selling deadline must be in the future.');
  const harvest_date = values.harvest_date || '';
  if (harvest_date && (!/^\d{4}-\d{2}-\d{2}$/.test(harvest_date) || !Number.isFinite(Date.parse(harvest_date)) || harvest_date > new Date().toLocaleDateString('en-CA') || Date.parse(harvest_date) > deadline)) {
    throw new Error('Harvest date must be a valid date, not in the future, and before the selling deadline.');
  }
  const pickup_available = values.pickup_available !== false;
  const delivery_available = Boolean(values.delivery_available);
  if (!pickup_available && !delivery_available) throw new Error('Offer pickup, delivery, or both.');
  const image_url = String(values.image_url || '');
  if (image_url && ((!/^https:\/\//i.test(image_url) && !/^data:image\/(jpeg|png|webp);base64,/i.test(image_url)) || image_url.length > 1500000)) {
    throw new Error('Use a HTTPS image URL or a JPG, PNG, or WebP photo smaller than 1 MB.');
  }
  return {
    produce_name, category: values.category, condition_details, pickup_location, harvest_date,
    pickup_latitude: coordinates?.[0] ?? null, pickup_longitude: coordinates?.[1] ?? null,
    listed_quantity: numberValue(values.listed_quantity, 'Listed quantity', { positive: true }), unit: values.unit,
    price_per_unit: numberValue(values.price_per_unit, 'Selling price'), urgency: values.urgency,
    selling_deadline: new Date(deadline).toISOString(), pickup_available, delivery_available,
    delivery_fee: delivery_available ? numberValue(values.delivery_fee ?? 0, 'Delivery cost') : 0, image_url,
  };
}

export async function createListing(farmerId, values) {
  return mutateData((data) => {
    requireProfile(data, farmerId, 'farmer');
    const now = new Date().toISOString();
    const listing = { ...validateListing(values), id: newId('produce'), farmer_id: farmerId, status: 'active', created_at: now, updated_at: now };
    data.listings.unshift(listing);
    addAudit(data, farmerId, 'listing_created', 'listing', listing.id, `${listing.produce_name} published in the local demo.`);
    return listing;
  });
}

function ownedListing(data, id, farmerId) {
  requireProfile(data, farmerId, 'farmer');
  const listing = data.listings.find((item) => item.id === id && item.farmer_id === farmerId);
  if (!listing) throw new Error('This listing was not found in your harvest.');
  return listing;
}

function checkInventoryChanges(data, listing, next) {
  const stock = inventory(data, listing.id);
  if (next.listed_quantity < stock.reserved_quantity + stock.sold_quantity) throw new Error('Listed quantity cannot be less than the quantity already reserved and sold.');
  if ((stock.reserved_quantity > 0 || stock.sold_quantity > 0) && next.unit !== listing.unit) throw new Error('The unit cannot change after produce has been reserved or sold. Create a new listing for a different unit.');
  const active = data.reservations.filter((reservation) => reservation.listing_id === listing.id && ACTIVE_STATUSES.includes(reservation.status));
  if (active.length && (next.produce_name !== listing.produce_name || next.pickup_location !== listing.pickup_location || next.pickup_latitude !== (listing.pickup_latitude ?? null) || next.pickup_longitude !== (listing.pickup_longitude ?? null))) throw new Error('Keep the produce name and pickup location unchanged while reservations are open.');
  if (active.some((reservation) => Date.parse(reservation.expires_at) > Date.parse(next.selling_deadline))) throw new Error('The deadline cannot be earlier than an existing reservation expiry.');
}

export async function updateListing(id, farmerId, values) {
  return mutateData((data) => {
    const listing = ownedListing(data, id, farmerId);
    const current = getListingById(data, id);
    if (!['active', 'reserved'].includes(current.status)) throw new Error('Only active listings can be edited. Use Relist for eligible expired or withdrawn produce.');
    const next = validateListing({ ...listing, ...values });
    checkInventoryChanges(data, listing, next);
    Object.assign(listing, next, { updated_at: new Date().toISOString() });
    addAudit(data, farmerId, 'listing_updated', 'listing', id, `${listing.produce_name} updated. Existing orders retain their agreed quantities and prices.`);
    const buyers = new Set(data.reservations.filter((item) => item.listing_id === id && ACTIVE_STATUSES.includes(item.status)).map((item) => item.buyer_id));
    buyers.forEach((buyerId) => {
      if (data.profiles.find((profile) => profile.id === buyerId)?.preferences?.listing_updates !== false) addNotification(data, buyerId, 'A reserved listing was updated', `${listing.produce_name} has updated listing information. Your agreed order price and pickup details have not changed.`, `/marketplace/${id}`);
    });
    return listing;
  });
}

export async function withdrawListing(id, farmerId) {
  return mutateData((data) => {
    const listing = ownedListing(data, id, farmerId);
    if (!['active', 'reserved'].includes(getListingById(data, id).status)) throw new Error('This listing is not eligible for withdrawal.');
    if (inventory(data, id).reserved_quantity > 0) throw new Error('Resolve open reservations before withdrawing this listing.');
    listing.status = 'withdrawn';
    listing.updated_at = new Date().toISOString();
    addAudit(data, farmerId, 'listing_withdrawn', 'listing', id, `${listing.produce_name} withdrawn from the demo marketplace.`);
    return listing;
  });
}

export async function relistListing(id, farmerId, values) {
  return mutateData((data) => {
    const listing = ownedListing(data, id, farmerId);
    const current = getListingById(data, id);
    if (!['expired', 'withdrawn'].includes(current.status) || current.reserved_quantity > 0 || current.available_quantity <= 0) throw new Error('Only expired or withdrawn produce with unsold quantity and no open reservations can be relisted.');
    const next = validateListing({ ...listing, ...values });
    checkInventoryChanges(data, listing, next);
    if (next.listed_quantity <= current.sold_quantity) throw new Error('Relisted produce needs an available quantity.');
    Object.assign(listing, next, { status: 'active', updated_at: new Date().toISOString(), created_at: new Date().toISOString() });
    addAudit(data, farmerId, 'listing_relisted', 'listing', id, `${listing.produce_name} relisted with a new selling deadline.`);
    return listing;
  });
}
