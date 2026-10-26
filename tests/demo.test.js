import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { createDemoData } from '../src/services/demoSeed.js';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();
const { getSnapshot, mutateData, processTimeEvents, STORAGE_KEY } = await import('../src/services/storageService.js');
const { createListing, updateListing, withdrawListing, relistListing, getListingById, getListings, filterListings } = await import('../src/services/produceService.js');
const { createReservation, transitionReservation, completeHandover, recordPayment, getReservations } = await import('../src/services/reservationService.js');
const { signIn, signUp, signOut, updateProfile, getSessionId, SESSION_KEY, requestVerification, resetPassword } = await import('../src/services/authService.js');
const { setUserStatus, reviewVerification, moderateListing } = await import('../src/services/adminService.js');
const { getUserNotifications, markAsRead, markAllAsRead } = await import('../src/services/notificationService.js');

let revision = 100;
beforeEach(async () => {
  localStorage.clear(); sessionStorage.clear();
  const seed = createDemoData();
  seed.revision = revision++;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  await processTimeEvents();
  await signOut();
});

const listingValues = (updates = {}) => ({ produce_name: 'Test tomatoes', category: 'Fruit vegetables', listed_quantity: 50, unit: 'kg', price_per_unit: 20, pickup_location: 'La Trinidad town center', urgency: 'planned', selling_deadline: new Date(Date.now() + 48 * 3600000).toISOString(), harvest_date: '', condition_details: 'Sample produce', pickup_available: true, delivery_available: true, delivery_fee: 20, image_url: '', ...updates });
const reserve = (listingId, count, buyerId = 'buyer-demo', options = {}) => createReservation({ listing_id: listingId, buyer_id: buyerId, quantity: count, fulfillment_method: 'pickup', request_id: crypto.randomUUID(), ...options });

test('partial reservations share one inventory and cannot oversell', async () => {
  const listing = await createListing('farmer-demo', listingValues());
  await reserve(listing.id, 5);
  await reserve(listing.id, 15, 'buyer-business');
  assert.equal(getListingById(getSnapshot(), listing.id).available_quantity, 30);
  await assert.rejects(reserve(listing.id, 31), /not enough/);
  const stock = getListingById(getSnapshot(), listing.id);
  assert.equal(stock.reserved_quantity, 20);
  assert.equal(stock.listed_quantity, stock.available_quantity + stock.reserved_quantity + stock.sold_quantity);
});

test('concurrent requests cannot both consume the last stock', async () => {
  const listing = await createListing('farmer-demo', listingValues({ listed_quantity: 10 }));
  const results = await Promise.allSettled([reserve(listing.id, 7), reserve(listing.id, 7, 'buyer-business')]);
  assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(getListingById(getSnapshot(), listing.id).available_quantity, 3);
});

test('fractional quantities and duplicate request references are handled exactly once', async () => {
  const listing = await createListing('farmer-demo', listingValues({ listed_quantity: 1 }));
  const request_id = crypto.randomUUID();
  const first = await reserve(listing.id, 0.25, 'buyer-demo', { request_id });
  const second = await reserve(listing.id, 0.25, 'buyer-demo', { request_id });
  assert.equal(first.id, second.id);
  assert.equal(getListingById(getSnapshot(), listing.id).available_quantity, 0.75);
  for (const count of [0, -1, NaN, Infinity, 0.001]) await assert.rejects(reserve(listing.id, count));
});

test('cancellation and rejection release inventory and notify both accounts', async () => {
  const listing = await createListing('farmer-demo', listingValues());
  const first = await reserve(listing.id, 5);
  const second = await reserve(listing.id, 15, 'buyer-business');
  await transitionReservation(first.id, 'buyer-demo', 'cancel');
  await transitionReservation(second.id, 'farmer-demo', 'reject', 'Unable to fulfill.');
  assert.equal(getListingById(getSnapshot(), listing.id).available_quantity, 50);
  assert.ok(getUserNotifications(getSnapshot(), 'buyer-demo').some((item) => item.title === 'Reservation cancelled'));
  assert.ok(getUserNotifications(getSnapshot(), 'farmer-demo').some((item) => item.title === 'Reservation rejected'));
});

test('handover requires the owning farmer, a ready order, and a matching code', async () => {
  const listing = await createListing('farmer-demo', listingValues());
  const order = await reserve(listing.id, 5);
  await assert.rejects(transitionReservation(order.id, 'buyer-demo', 'confirm'));
  const confirmed = await transitionReservation(order.id, 'farmer-demo', 'confirm');
  assert.ok(confirmed.harvest_pass.verification_code);
  await assert.rejects(completeHandover(order.id, 'farmer-demo', confirmed.harvest_pass.verification_code));
  await transitionReservation(order.id, 'farmer-demo', 'ready');
  await assert.rejects(completeHandover(order.id, 'buyer-demo', confirmed.harvest_pass.verification_code));
  await assert.rejects(completeHandover(order.id, 'farmer-demo', 'WRONG'));
  const completed = await completeHandover(order.id, 'farmer-demo', confirmed.harvest_pass.verification_code);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.fulfillment_status, 'handed_over');
  assert.equal(completed.payment_status, 'not_recorded');
  await assert.rejects(completeHandover(order.id, 'farmer-demo', confirmed.harvest_pass.verification_code));
  await assert.rejects(transitionReservation(order.id, 'buyer-demo', 'cancel'));
  const stock = getListingById(getSnapshot(), listing.id);
  assert.equal(stock.sold_quantity, 5); assert.equal(stock.reserved_quantity, 0); assert.equal(stock.available_quantity, 45);
  await recordPayment(order.id, 'farmer-demo');
  await assert.rejects(recordPayment(order.id, 'farmer-demo'));
  assert.equal(getReservations(getSnapshot(), { buyerId: 'buyer-demo' }).find((item) => item.id === order.id).payment_status, 'recorded_by_seller');
});

test('expiry releases held stock once and cancelled passes cannot complete', async () => {
  const listing = await createListing('farmer-demo', listingValues());
  const order = await reserve(listing.id, 5);
  const confirmed = await transitionReservation(order.id, 'farmer-demo', 'confirm');
  await transitionReservation(order.id, 'farmer-demo', 'ready');
  await mutateData((data) => { data.reservations.find((item) => item.id === order.id).expires_at = new Date(Date.now() - 1000).toISOString(); });
  await processTimeEvents();
  const messages = getSnapshot().notifications.length;
  await processTimeEvents();
  assert.equal(getSnapshot().notifications.length, messages);
  assert.equal(getSnapshot().reservations.find((item) => item.id === order.id).status, 'expired');
  assert.equal(getListingById(getSnapshot(), listing.id).available_quantity, 50);
  await assert.rejects(completeHandover(order.id, 'farmer-demo', confirmed.harvest_pass.verification_code));
});

test('editing cannot reduce committed inventory and agreed prices stay fixed', async () => {
  const listing = await createListing('farmer-demo', listingValues());
  const order = await reserve(listing.id, 5, 'buyer-demo', { fulfillment_method: 'delivery', additional_costs: 999 });
  assert.equal(order.total_amount, 120);
  await updateListing(listing.id, 'farmer-demo', { price_per_unit: 30, delivery_fee: 40 });
  assert.equal(getSnapshot().reservations.find((item) => item.id === order.id).total_amount, 120);
  await assert.rejects(updateListing(listing.id, 'farmer-demo', { listed_quantity: 4 }));
  await assert.rejects(updateListing(listing.id, 'farmer-demo', { unit: 'bundle' }));
  await assert.rejects(updateListing(listing.id, 'farmer-demo', { pickup_location: 'Changed place' }));
  await assert.rejects(withdrawListing(listing.id, 'farmer-demo'));
});

test('withdrawal and relisting preserve stock and validate selling details', async () => {
  const listing = await createListing('farmer-demo', listingValues());
  await withdrawListing(listing.id, 'farmer-demo');
  await assert.rejects(reserve(listing.id, 1));
  await relistListing(listing.id, 'farmer-demo', listingValues());
  assert.equal(getListingById(getSnapshot(), listing.id).status, 'active');
  await assert.rejects(createListing('farmer-demo', listingValues({ listed_quantity: -1 })));
  await assert.rejects(createListing('farmer-demo', listingValues({ selling_deadline: '2020-01-01' })));
  await assert.rejects(createListing('farmer-demo', listingValues({ pickup_available: false, delivery_available: false })));
  await assert.rejects(createListing('farmer-demo', listingValues({ image_url: 'javascript:alert(1)' })));
});

test('optional pickup pins persist and cannot change while reservations are open', async () => {
  const listing = await createListing('farmer-demo', listingValues({ pickup_latitude: '13.6217', pickup_longitude: '123.1942' }));
  assert.equal(listing.pickup_latitude, 13.6217);
  assert.equal(listing.pickup_longitude, 123.1942);
  assert.equal(JSON.parse(localStorage.getItem(STORAGE_KEY)).listings.find((item) => item.id === listing.id).pickup_latitude, 13.6217);
  await assert.rejects(createListing('farmer-demo', listingValues({ pickup_latitude: 91, pickup_longitude: 123 })), /coordinates/);
  await assert.rejects(createListing('farmer-demo', listingValues({ pickup_latitude: 13 })), /coordinates/);
  const reservation = await reserve(listing.id, 2);
  await assert.rejects(updateListing(listing.id, 'farmer-demo', { pickup_latitude: 14 }), /pickup location unchanged/);
  await updateListing(listing.id, 'farmer-demo', { price_per_unit: 25 });
  assert.equal(getSnapshot().reservations.find((item) => item.id === reservation.id).total_amount, 40);
  await transitionReservation(reservation.id, 'buyer-demo', 'cancel');
  const cleared = await updateListing(listing.id, 'farmer-demo', { pickup_latitude: '', pickup_longitude: '' });
  assert.equal(cleared.pickup_latitude, null);
  assert.equal(cleared.pickup_longitude, null);
});

test('demo registration is role-specific, rejects duplicates, and never saves passwords', async () => {
  const secret = 'never-persist-this-password';
  const profile = await signUp(' New@Example.com ', secret, 'farmer', { full_name: 'New Farmer', seller_name: 'Demo farm', password: secret, role: 'admin', private_key: 'not-allowed' });
  assert.equal(profile.role, 'farmer'); assert.equal(profile.email, 'new@example.com');
  assert.equal(getSessionId(), profile.id);
  assert.equal(profile.onboarding_complete, false);
  assert.equal(localStorage.getItem(STORAGE_KEY).includes(secret), false);
  assert.equal(localStorage.getItem(STORAGE_KEY).includes('private_key'), false);
  await assert.rejects(signUp('new@example.com', secret, 'buyer', { full_name: 'Duplicate' }), /already uses/);
  await assert.rejects(signUp('invalid', secret, 'buyer', { full_name: 'Invalid' }));
  await assert.rejects(signUp('admin@example.com', secret, 'admin', { full_name: 'Invalid' }));
  await updateProfile(profile.id, { location: 'Baguio', onboarding_complete: true, password: secret });
  assert.equal(getSnapshot().profiles.find((item) => item.id === profile.id).onboarding_complete, true);
  await signOut();
  assert.equal(getSessionId(), null);
  const login = await signIn(profile.email, '', false);
  assert.equal(login.id, profile.id);
  assert.equal(localStorage.getItem(SESSION_KEY), null);
  assert.equal(sessionStorage.getItem(SESSION_KEY), profile.id);
  assert.deepEqual(await resetPassword('someone@example.com'), { simulated: true });
});

test('household profiles do not retain hidden business fields', async () => {
  const profile = await signUp('household@example.com', 'sample123', 'buyer', { full_name: 'Demo Buyer', buyer_type: 'household', business_name: 'Should not persist' });
  assert.equal(profile.buyer_type, 'household'); assert.equal(profile.business_name, '');
  const business = await updateProfile(profile.id, { buyer_type: 'business', business_name: 'Demo eatery' });
  assert.equal(business.business_name, 'Demo eatery');
  const household = await updateProfile(profile.id, { buyer_type: 'household' });
  assert.equal(household.business_name, '');
});

test('notifications are account-scoped and read state persists', async () => {
  const notice = getUserNotifications(getSnapshot(), 'buyer-demo')[0];
  await assert.rejects(markAsRead(notice.id, 'farmer-demo'));
  await markAsRead(notice.id, 'buyer-demo');
  await markAllAsRead('farmer-demo');
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  assert.equal(saved.notifications.find((item) => item.id === notice.id).is_read, true);
  assert.ok(saved.notifications.filter((item) => item.user_id === 'farmer-demo').every((item) => item.is_read));
});

test('admin moderation cancels open orders, hides listings, and audits reasons', async () => {
  await assert.rejects(moderateListing('tomatoes', 'buyer-demo', true, 'Invalid actor'));
  await moderateListing('tomatoes', 'admin-demo', true, 'Demo listing review');
  assert.equal(getListingById(getSnapshot(), 'tomatoes').status, 'moderated');
  assert.equal(getSnapshot().reservations.find((item) => item.id === 'order-1001').status, 'cancelled');
  assert.ok(!filterListings(getListings(getSnapshot())).some((item) => item.id === 'tomatoes'));
  await moderateListing('tomatoes', 'admin-demo', false, 'Review completed');
  assert.equal(getListingById(getSnapshot(), 'tomatoes').available_quantity, 50);
  assert.ok(getSnapshot().auditLogs.some((item) => item.action === 'listing_moderated' && item.details === 'Demo listing review'));
});

test('suspension blocks login and reservations without destroying completed transactions', async () => {
  await setUserStatus('farmer-demo', 'admin-demo', 'suspended', 'Demo moderation');
  await assert.rejects(signIn('farmer@harani.demo'), /suspended/);
  await assert.rejects(reserve('tomatoes', 1));
  assert.equal(getSnapshot().reservations.find((item) => item.id === 'order-1004').status, 'completed');
  await assert.rejects(setUserStatus('admin-demo', 'admin-demo', 'suspended', 'Cannot suspend admin'));
  await setUserStatus('farmer-demo', 'admin-demo', 'active', 'Review complete');
  assert.equal((await signIn('farmer@harani.demo')).role, 'farmer');
});

test('new sample seller review appears to administrators and cannot be reviewed twice', async () => {
  const user = await signUp('review@example.com', 'sample123', 'farmer', { full_name: 'Review Farmer' });
  const submission = await requestVerification(user.id);
  await assert.rejects(requestVerification(user.id));
  await reviewVerification(submission.id, 'admin-demo', 'verified', 'Sample profile reviewed');
  await assert.rejects(reviewVerification(submission.id, 'admin-demo', 'rejected', 'Duplicate review'));
  assert.equal(getSnapshot().profiles.find((item) => item.id === user.id).verification_status, 'verified');
});

test('combined marketplace filters and sorting operate on the same inventory', () => {
  const result = filterListings(getListings(getSnapshot()), { search: 'a', category: 'Root vegetables', minPrice: 40, maxPrice: 55, minQuantity: 30, unit: 'kg', fulfillment: 'delivery', sort: 'price-high' });
  assert.deepEqual(result.map((item) => item.id), ['potatoes', 'carrots']);
  const soonest = filterListings(getListings(getSnapshot()), { sort: 'soonest' });
  assert.equal(soonest[0].id, 'tomatoes');
});

test('failed persistence does not partially commit a reservation', async () => {
  const before = getListingById(getSnapshot(), 'tomatoes').available_quantity;
  const original = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('Quota exceeded'); };
  try { await assert.rejects(reserve('tomatoes', 1), /could not be saved/); } finally { localStorage.setItem = original; }
  assert.equal(getListingById(getSnapshot(), 'tomatoes').available_quantity, before);
});
