import { getSnapshot, mutateData } from './storageService.js';
import { getListingById } from './produceService.js';
import { createReservationInData } from './reservationService.js';
import { newId, requireProfile, round } from './dataRules.js';

export const validCartQuantity = (value) => ['number', 'string'].includes(typeof value) && String(value).trim() !== '' && Number.isSafeInteger(Number(value)) && Number(value) > 0 && Number(value) <= 1000000;
export const validCartPrice = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1000000 && Math.abs(round(value) - value) < 0.0000001;
const text = (value) => typeof value === 'string' ? value : '';
const safeImage = (value) => /^https:\/\//i.test(text(value)) || /^data:image\/(jpeg|png|webp);base64,/i.test(text(value)) ? value : '';

function readCart(data, buyerId) {
  const empty = { version: 1, buyer_id: buyerId, items: [], checkout: null };
  const warning = 'Some saved cart data could not be restored. Please add any missing products again.';
  if (data.carts == null) return { cart: empty, warning: '' };
  if (!Array.isArray(data.carts)) return { cart: empty, warning };
  const records = data.carts.filter((cart) => cart?.buyer_id === buyerId);
  if (!records.length) return { cart: empty, warning: '' };
  const saved = records[0];
  if (records.length !== 1 || saved.version !== 1 || !Array.isArray(saved.items)) return { cart: empty, warning };
  let damaged = false;
  const seen = new Set();
  const items = [];
  for (const item of saved.items) {
    if (!item || !text(item.listing_id) || !text(item.farmer_id) || !text(item.unit) || !validCartQuantity(item.quantity) || seen.has(item.listing_id)) {
      damaged = true;
      continue;
    }
    seen.add(item.listing_id);
    items.push({
      listing_id: item.listing_id, farmer_id: item.farmer_id, unit: item.unit,
      produce_name: text(item.produce_name) || 'Unavailable produce', farmer_name: text(item.farmer_name) || 'Farmer unavailable',
      image_url: safeImage(item.image_url), price_per_unit: validCartPrice(item.price_per_unit) ? item.price_per_unit : null,
      quantity: Number(item.quantity), selected: item.selected !== false,
    });
  }
  const checkout = saved.checkout && text(saved.checkout.id) && ['draft', 'completed'].includes(saved.checkout.status) && text(saved.checkout.signature)
    ? { id: saved.checkout.id, status: saved.checkout.status, signature: saved.checkout.signature } : null;
  if (saved.checkout && !checkout) damaged = true;
  return { cart: { ...empty, items, checkout }, warning: damaged ? warning : '' };
}

export function cartListingError(listing, buyerId) {
  if (!listing || listing.status !== 'active' || listing.farmer?.status !== 'active') return 'This produce is no longer available.';
  if (listing.farmer_id === buyerId) return 'You cannot add your own produce to a buyer cart.';
  if (!text(listing.produce_name).trim() || !text(listing.unit).trim() || !text(listing.farmer_id) || !Number.isFinite(Date.parse(listing.selling_deadline))) return 'Product details are incomplete. This produce cannot be checked out.';
  if (!validCartPrice(listing.price_per_unit)) return 'The price is unavailable. This produce cannot be checked out.';
  if (!Number.isFinite(listing.available_quantity) || listing.available_quantity < 1) return 'There is not enough stock for a whole-unit cart quantity.';
  if (!listing.pickup_available && !(listing.delivery_available && validCartPrice(listing.delivery_fee))) return 'No valid pickup or delivery option is available.';
  return '';
}

export function getCart(data = getSnapshot(), buyerId) {
  const buyer = data.profiles.find((profile) => profile.id === buyerId && profile.role === 'buyer' && profile.status === 'active');
  const { cart, warning } = buyer ? readCart(data, buyerId) : { cart: { items: [], checkout: null }, warning: '' };
  const items = cart.items.map((item) => {
    const listing = getListingById(data, item.listing_id);
    const sameFarmer = listing?.farmer_id === item.farmer_id;
    const productError = cartListingError(listing, buyerId) || (!sameFarmer ? 'This seller has changed. Remove this product and add it again.' : '')
      || (listing.unit !== item.unit ? 'The listing unit has changed. Remove this product and add it again.' : '');
    const price = listing && sameFarmer ? listing.price_per_unit : item.price_per_unit;
    const stock = Number.isFinite(listing?.available_quantity) && sameFarmer ? Math.max(0, listing.available_quantity) : 0;
    return {
      ...item, listing,
      produce_name: sameFarmer && text(listing.produce_name).trim() ? listing.produce_name : item.produce_name,
      farmer_name: sameFarmer ? listing.farmer?.seller_name || listing.farmer?.full_name || item.farmer_name : item.farmer_name,
      image_url: sameFarmer ? safeImage(listing.image_url) : item.image_url,
      price_per_unit: validCartPrice(price) ? price : null,
      priceChanged: sameFarmer && validCartPrice(price) && item.price_per_unit !== price,
      available_quantity: stock, max_quantity: Math.floor(stock), productError,
      error: productError || (item.quantity > stock ? `Only ${stock} ${item.unit} available. Reduce the quantity to continue.` : ''),
      subtotal: validCartPrice(price) ? round(price * item.quantity) : null,
    };
  });
  const selectedItems = items.filter((item) => item.selected);
  return {
    items, selectedItems, checkout: cart.checkout, warning,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    selectedQuantity: selectedItems.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: selectedItems.some((item) => item.subtotal === null) ? null : round(selectedItems.reduce((sum, item) => sum + item.subtotal, 0)),
  };
}

function editableCart(data, buyerId) {
  requireProfile(data, buyerId, 'buyer');
  const { cart } = readCart(data, buyerId);
  if (!Array.isArray(data.carts)) data.carts = [];
  data.carts = data.carts.filter((item) => item?.buyer_id !== buyerId);
  data.carts.push(cart);
  return cart;
}

function snapshotItem(listing, count, selected = true) {
  return {
    listing_id: listing.id, farmer_id: listing.farmer_id, produce_name: listing.produce_name,
    farmer_name: listing.farmer.seller_name || listing.farmer.full_name, unit: listing.unit,
    price_per_unit: listing.price_per_unit, quantity: count, image_url: safeImage(listing.image_url), selected,
  };
}

function validateQuantity(listing, value, buyerId) {
  const error = cartListingError(listing, buyerId);
  if (error) throw new Error(error);
  if (!validCartQuantity(value)) throw new Error('Choose a positive whole-number quantity.');
  if (Number(value) > listing.available_quantity) throw new Error(`Only ${listing.available_quantity} ${listing.unit} available. Reduce the quantity to continue.`);
}

const invalidateDraft = (cart) => { if (cart.checkout?.status === 'draft') cart.checkout = null; };

export async function addCartItem(buyerId, listingId, value) {
  return mutateData((data) => {
    const cart = editableCart(data, buyerId);
    const listing = getListingById(data, listingId);
    validateQuantity(listing, value, buyerId);
    const existing = cart.items.find((item) => item.listing_id === listingId);
    if (existing && (existing.farmer_id !== listing.farmer_id || existing.unit !== listing.unit)) throw new Error('This listing has changed. Remove the old cart item and add it again.');
    const count = (existing?.quantity || 0) + Number(value);
    validateQuantity(listing, count, buyerId);
    const item = snapshotItem(listing, count);
    if (existing) Object.assign(existing, item);
    else cart.items.push(item);
    invalidateDraft(cart);
    return item;
  });
}

export async function setCartQuantity(buyerId, listingId, value) {
  return mutateData((data) => {
    const cart = editableCart(data, buyerId);
    const item = cart.items.find((entry) => entry.listing_id === listingId);
    if (!item) throw new Error('This product is no longer in your cart.');
    const listing = getListingById(data, listingId);
    validateQuantity(listing, value, buyerId);
    if (listing.farmer_id !== item.farmer_id || listing.unit !== item.unit) throw new Error('This listing has changed. Remove it and add it again.');
    Object.assign(item, snapshotItem(listing, Number(value), item.selected));
    invalidateDraft(cart);
  });
}

export async function selectCartItems(buyerId, listingIds, selected) {
  return mutateData((data) => {
    const cart = editableCart(data, buyerId);
    cart.items.forEach((item) => { if (listingIds.includes(item.listing_id)) item.selected = Boolean(selected); });
    invalidateDraft(cart);
  });
}

export async function removeCartItems(buyerId, listingIds) {
  return mutateData((data) => {
    const cart = editableCart(data, buyerId);
    cart.items = cart.items.filter((item) => !listingIds.includes(item.listing_id));
    invalidateDraft(cart);
  });
}

export async function clearCart(buyerId) {
  return mutateData((data) => {
    const cart = editableCart(data, buyerId);
    cart.items = [];
    invalidateDraft(cart);
  });
}

export function groupCartItems(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.farmer_id)) groups.set(item.farmer_id, { farmer_id: item.farmer_id, farmer_name: item.farmer_name || item.farmer?.seller_name || item.farmer?.full_name || 'Farmer unavailable', items: [] });
    groups.get(item.farmer_id).items.push(item);
  }
  return [...groups.values()];
}

// Only reviewed terms are signed, not changing stock counts or decorative images.
function selectionSignature(items) {
  return JSON.stringify(items.map((item) => [item.listing_id, item.farmer_id, item.quantity, item.unit, item.price_per_unit, item.produce_name,
    item.listing?.pickup_available, item.listing?.delivery_available, item.listing?.delivery_fee, item.listing?.pickup_location,
    item.listing?.pickup_location_public, item.listing?.pickup_barangay, item.listing?.pickup_latitude, item.listing?.pickup_longitude,
    item.listing?.selling_deadline]).sort((a, b) => a[0].localeCompare(b[0])));
}

export function checkoutIssue(cart, checkDraft = true) {
  if (!cart.selectedItems.length) return 'Select at least one available product to continue.';
  const invalid = cart.selectedItems.find((item) => item.error);
  if (invalid) return `${invalid.produce_name}: ${invalid.error}`;
  if (checkDraft && (cart.checkout?.status !== 'draft' || cart.checkout.signature !== selectionSignature(cart.selectedItems))) return 'Your cart or the listing details have changed. Return to your cart and review them before checkout.';
  return '';
}

export async function prepareCartCheckout(buyerId) {
  return mutateData((data) => {
    const cart = editableCart(data, buyerId);
    const view = getCart(data, buyerId);
    const issue = checkoutIssue(view, false);
    if (issue) throw new Error(issue);
    const signature = selectionSignature(view.selectedItems);
    if (cart.checkout?.status !== 'draft' || cart.checkout.signature !== signature) cart.checkout = { id: newId('checkout'), status: 'draft', signature };
    return cart.checkout;
  });
}

export async function checkoutCart(buyerId, checkoutId, arrangements) {
  return mutateData((data) => {
    requireProfile(data, buyerId, 'buyer');
    if (!text(checkoutId)) throw new Error('Open checkout from your cart first.');
    // Persisted reservation keys survive refresh, repeated clicks, and multi-tab retries.
    const previous = data.reservations.filter((item) => item.buyer_id === buyerId && item.checkout_id === checkoutId);
    if (previous.length) return previous;
    const cart = editableCart(data, buyerId);
    const view = getCart(data, buyerId);
    const issue = checkoutIssue(view);
    if (issue) throw new Error(issue);
    if (cart.checkout.id !== checkoutId) throw new Error('This checkout has been replaced. Review your current cart.');
    const reservations = view.selectedItems.map((item) => {
      const option = arrangements?.[item.listing_id];
      if (!option) throw new Error(`Choose pickup or delivery for ${item.produce_name}.`);
      const reservation = createReservationInData(data, {
        buyer_id: buyerId, listing_id: item.listing_id, quantity: item.quantity,
        fulfillment_method: option.fulfillment_method, fulfillment_notes: option.fulfillment_notes,
        request_id: `${checkoutId}:${item.listing_id}`,
      });
      reservation.checkout_id = checkoutId;
      return reservation;
    });
    const checkedOut = new Set(view.selectedItems.map((item) => item.listing_id));
    cart.items = cart.items.filter((item) => !checkedOut.has(item.listing_id));
    cart.checkout.status = 'completed';
    return reservations;
  });
}
