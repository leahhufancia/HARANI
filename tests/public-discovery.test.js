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
const {
  createListing, updateListing, withdrawListing, relistListing,
  getListings, getListingById, getPublicListings, getPublicListingById,
} = await import('../src/services/produceService.js');
const { createReservation, transitionReservation } = await import('../src/services/reservationService.js');

let revision = 200;
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  const seed = createDemoData();
  seed.revision = revision++;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  await processTimeEvents();
});

function fixture(updates = {}, farmerUpdates = {}, now = Date.now()) {
  const data = createDemoData(now);
  data.listings = [Object.assign(data.listings[0], updates)];
  data.reservations = [];
  Object.assign(data.profiles.find((profile) => profile.id === 'farmer-demo'), farmerUpdates);
  return data;
}

const listingValues = (updates = {}) => ({
  produce_name: 'Test tomatoes', category: 'Fruit vegetables', listed_quantity: 50,
  unit: 'kg', price_per_unit: 20, pickup_location: 'Seller-selected pickup point',
  urgency: 'planned', selling_deadline: new Date(Date.now() + 48 * 3600000).toISOString(),
  pickup_available: true, delivery_available: false, delivery_fee: 0, ...updates,
});

test('public DTOs allowlist listing and farmer fields without changing internal readers', () => {
  const data = fixture({ internal_notes: 'private-listing-note', pickup_location_public: false }, {
    full_name: 'Private legal name', email: 'private@example.test', phone: 'private-phone',
    location: 'Private home', farm_address: 'Private farm', farm_latitude: 88.888, farm_longitude: 177.777,
    identity_documents: { secret: 'private-document' },
  });
  const before = structuredClone(data);
  const [listing] = getPublicListings(data);
  assert.deepEqual(Object.keys(listing).sort(), [
    'id', 'farmer_id', 'produce_name', 'category', 'condition_details', 'harvest_date',
    'unit', 'price_per_unit', 'available_quantity', 'urgency', 'selling_deadline',
    'created_at', 'updated_at', 'image_url', 'pickup_available', 'delivery_available',
    'delivery_fee', 'status', 'pickup_location', 'pickup_barangay', 'pickup_latitude',
    'pickup_longitude', 'pickup_location_public', 'location_is_demo', 'farmer',
  ].sort());
  assert.deepEqual(listing.farmer, {
    id: 'farmer-demo', seller_name: 'Santos Family Farm', verification_status: 'verified', status: 'active', role: 'farmer',
  });
  assert.deepEqual(getPublicListingById(data, listing.id), listing);
  const json = JSON.stringify(listing);
  for (const value of ['Private legal name', 'private@example.test', 'private-phone', 'Private home', 'Private farm', '88.888', '177.777', 'private-document', 'private-listing-note']) {
    assert.equal(json.includes(value), false, value);
  }
  assert.equal(getListingById(data, listing.id).farmer.full_name, 'Private legal name');
  assert.equal(getListings(data)[0].listed_quantity, 50);
  assert.equal(getListings(data)[0].reserved_quantity, 0);
  assert.deepEqual(data, before);
  data.profiles.find((profile) => profile.id === 'farmer-demo').seller_name = '';
  assert.equal(getPublicListings(data)[0].farmer.seller_name, 'Local farmer');
});

test('only explicit boolean consent publishes pickup text, area, and valid pins', () => {
  for (const consent of [undefined, null, false, 0, 1, 'true', 'false', {}, []]) {
    const data = fixture({ pickup_location_public: consent });
    const before = structuredClone(data);
    const [listing] = getPublicListings(data);
    assert.equal(listing.pickup_location_public, false);
    assert.equal(listing.pickup_location, '');
    assert.equal(listing.pickup_barangay, '');
    assert.equal(listing.pickup_latitude, null);
    assert.equal(listing.pickup_longitude, null);
    assert.deepEqual(data, before);
  }
  const [listing] = getPublicListings(fixture({ pickup_location_public: true }));
  assert.equal(listing.pickup_location, 'Barangay Carolina, Naga City');
  assert.equal(listing.pickup_barangay, 'Carolina');
  assert.equal(listing.pickup_latitude, 13.6217);
  assert.equal(listing.pickup_longitude, 123.1942);
});

test('published coordinate pairs accept zero and valid boundary values', () => {
  for (const [latitude, longitude] of [[0, 0], ['0', '0'], [-90, 180], [90, -180], [' 13.6217 ', '123.1942']]) {
    const [listing] = getPublicListings(fixture({ pickup_latitude: latitude, pickup_longitude: longitude }));
    assert.equal(listing.pickup_latitude, Number(latitude));
    assert.equal(listing.pickup_longitude, Number(longitude));
  }
});

test('absent, partial, malformed, and out-of-range pins never use profile coordinates', () => {
  for (const [latitude, longitude] of [
    [undefined, undefined], [null, null], ['', ''], [' ', ' '], [13, null], [0, undefined],
    [NaN, 123], [13, Infinity], [91, 123], [-91, 123], [13, 181], [13, -181],
    [false, false], [[], []], [{}, {}], ['Carolina', 'Naga'],
  ]) {
    const data = fixture({ pickup_latitude: latitude, pickup_longitude: longitude }, { farm_latitude: 13.5, farm_longitude: 123.5 });
    const before = structuredClone(data);
    const [listing] = getPublicListings(data);
    assert.equal(listing.pickup_latitude, null);
    assert.equal(listing.pickup_longitude, null);
    assert.equal(listing.pickup_location_public, true);
    assert.equal(listing.pickup_barangay, 'Carolina');
    assert.deepEqual(data, before);
  }
  const data = fixture({}, { farm_latitude: 13.5, farm_longitude: 123.5 });
  delete data.listings[0].pickup_latitude;
  delete data.listings[0].pickup_longitude;
  const before = structuredClone(data);
  assert.equal(getPublicListings(data)[0].pickup_latitude, null);
  assert.equal(getPublicListingById(data, 'tomatoes').pickup_longitude, null);
  assert.deepEqual(data, before);
});

test('discovery requires an effective active listing and an active farmer role', () => {
  for (const status of ['reserved', 'sold', 'expired', 'withdrawn', 'moderated', 'draft', '', null, undefined]) {
    assert.deepEqual(getPublicListings(fixture({ status })), [], String(status));
  }
  for (const profile of [{ status: 'suspended' }, { status: undefined }, { role: 'buyer' }, { role: 'admin' }, { role: undefined }]) {
    const data = fixture({}, profile);
    assert.deepEqual(getPublicListings(data), []);
    assert.equal(getPublicListingById(data, 'tomatoes'), undefined);
  }
  const data = fixture();
  data.profiles = [];
  assert.deepEqual(getPublicListings(data), []);
  assert.equal(getPublicListingById(data, 'tomatoes'), undefined);
  assert.equal(getPublicListings(fixture({}, { verification_status: 'pending' })).length, 1);
});

test('discovery requires a finite future deadline and finite positive remaining stock', () => {
  const now = Date.now();
  for (const deadline of [new Date(now - 1).toISOString(), new Date(now).toISOString(), 'not-a-date', '', null, undefined]) {
    assert.deepEqual(getPublicListings(fixture({ selling_deadline: deadline }, {}, now), now), []);
  }
  assert.equal(getPublicListings(fixture({ selling_deadline: new Date(now + 1).toISOString() }, {}, now), now).length, 1);
  for (const quantity of [0, -1, NaN, Infinity, -Infinity]) {
    assert.deepEqual(getPublicListings(fixture({ listed_quantity: quantity }), now), []);
  }
  const data = fixture({ listed_quantity: 5 });
  data.reservations = [{ listing_id: 'tomatoes', status: 'pending', quantity: 5, expires_at: new Date(now + 3600000).toISOString() }];
  assert.deepEqual(getPublicListings(data, now), []);
  data.reservations[0].status = 'completed';
  assert.deepEqual(getPublicListings(data, now), []);
});

test('public reads reject invalid prices or fulfillment but allow free produce', () => {
  for (const price of [-1, NaN, Infinity, -Infinity, null, undefined, '', '20', true]) {
    const data = fixture({ price_per_unit: price });
    assert.deepEqual(getPublicListings(data), []);
    assert.equal(getPublicListingById(data, 'tomatoes'), undefined);
  }
  for (const values of [
    { pickup_available: false, delivery_available: false },
    { pickup_available: 'true' }, { delivery_available: undefined },
    { delivery_available: true, delivery_fee: -1 }, { delivery_available: true, delivery_fee: NaN },
    { delivery_available: true, delivery_fee: Infinity }, { delivery_available: true, delivery_fee: undefined },
    { delivery_available: true, delivery_fee: '0' },
  ]) {
    const data = fixture(values);
    assert.deepEqual(getPublicListings(data), []);
    assert.equal(getPublicListingById(data, 'tomatoes'), undefined);
  }
  assert.equal(getPublicListings(fixture({ price_per_unit: 0, pickup_available: false, delivery_available: true, delivery_fee: 0 })).length, 1);
  assert.equal(getPublicListings(fixture({ delivery_available: false }))[0].delivery_fee, 0);
});

test('public inventory excludes elapsed holds without mutating reservations or notifications', () => {
  const now = Date.now();
  const data = fixture({ listed_quantity: 20 }, {}, now);
  const reservation = (status, quantity, expires = now + 3600000) => ({ listing_id: 'tomatoes', status, quantity, expires_at: new Date(expires).toISOString() });
  data.reservations = [
    reservation('pending', 3), reservation('confirmed', 4), reservation('ready', 5),
    reservation('pending', 19, now - 1), reservation('confirmed', 19, now - 1), reservation('ready', 19, now),
    reservation('completed', 2, now - 1), reservation('cancelled', 99), reservation('rejected', 99), reservation('expired', 99),
  ];
  const before = structuredClone(data);
  assert.equal(getPublicListings(data, now)[0].available_quantity, 6);
  assert.deepEqual(data, before);
  data.reservations.push({ listing_id: 'tomatoes', status: 'pending', quantity: 1, expires_at: 'invalid' });
  assert.equal(getPublicListings(data, now)[0].available_quantity, 5);
});

test('public details retain reserved, sold, and expired receipts but never hidden records', async () => {
  const listing = await createListing('farmer-demo', listingValues({ listed_quantity: 2 }));
  const order = await createReservation({ listing_id: listing.id, buyer_id: 'buyer-demo', quantity: 2, fulfillment_method: 'pickup', request_id: crypto.randomUUID() });
  assert.equal(getPublicListings().some((item) => item.id === listing.id), false);
  assert.equal(getPublicListingById(getSnapshot(), listing.id).status, 'reserved');
  assert.equal(getPublicListingById(getSnapshot(), listing.id).available_quantity, 0);
  await mutateData((data) => { data.reservations.find((item) => item.id === order.id).status = 'completed'; });
  assert.equal(getPublicListingById(getSnapshot(), listing.id).status, 'sold');

  const expired = fixture({ selling_deadline: new Date(Date.now() - 1000).toISOString() });
  assert.deepEqual(getPublicListings(expired), []);
  assert.equal(getPublicListingById(expired, 'tomatoes').status, 'expired');
  for (const status of ['reserved', 'sold', 'expired']) {
    assert.equal(getPublicListingById(fixture({ status }), 'tomatoes').status, status);
  }
  for (const status of ['withdrawn', 'moderated', 'hidden', 'draft', null]) {
    assert.equal(getPublicListingById(fixture({ status }), 'tomatoes'), undefined);
  }
  assert.equal(getPublicListingById(fixture({ selling_deadline: 'invalid' }), 'tomatoes'), undefined);
  assert.equal(getPublicListingById(fixture(), 'missing-id'), undefined);
});

test('new listings persist optional location fields privately by default without profile backfill', async () => {
  await mutateData((data) => Object.assign(data.profiles.find((profile) => profile.id === 'farmer-demo'), { farm_latitude: 13.5, farm_longitude: 123.5 }));
  const listing = await createListing('farmer-demo', listingValues({ location_is_demo: true }));
  assert.equal(listing.pickup_barangay, '');
  assert.equal(listing.pickup_location_public, false);
  assert.equal(listing.location_is_demo, false);
  assert.equal(listing.pickup_latitude, null);
  assert.equal(listing.pickup_longitude, null);
  const published = await createListing('farmer-demo', listingValues({ pickup_barangay: ' Carolina ', pickup_location_public: true, pickup_latitude: '0', pickup_longitude: 0 }));
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)).listings.find((item) => item.id === published.id);
  assert.equal(stored.pickup_barangay, 'Carolina');
  assert.equal(stored.pickup_location_public, true);
  assert.equal(stored.pickup_latitude, 0);
  assert.equal(stored.pickup_longitude, 0);
  assert.equal(stored.location_is_demo, false);
});

test('listing validation enforces string areas, strict consent, and optional valid coordinate pairs', async () => {
  for (const pickup_barangay of [101, false, {}, [], 'a'.repeat(101)]) {
    await assert.rejects(createListing('farmer-demo', listingValues({ pickup_barangay })), /barangay/);
  }
  await createListing('farmer-demo', listingValues({ pickup_barangay: 'a'.repeat(100) }));
  for (const pickup_location_public of ['true', 'false', 0, 1, null, {}, []]) {
    await assert.rejects(createListing('farmer-demo', listingValues({ pickup_location_public })), /consent/);
  }
  for (const [pickup_latitude, pickup_longitude] of [[13, undefined], [91, 123], [0, Infinity], [false, false], ['', 123]]) {
    await assert.rejects(createListing('farmer-demo', listingValues({ pickup_latitude, pickup_longitude })), /coordinates/);
  }
  for (const [pickup_latitude, pickup_longitude] of [[undefined, undefined], [null, null], ['', '']]) {
    const listing = await createListing('farmer-demo', listingValues({ pickup_latitude, pickup_longitude }));
    assert.equal(listing.pickup_latitude, null);
    assert.equal(listing.pickup_longitude, null);
  }
});

test('partial edits and consent changes preserve persisted coordinates instead of inventing new ones', async () => {
  const listing = await createListing('farmer-demo', listingValues({ pickup_barangay: 'Carolina', pickup_latitude: '13.6217', pickup_longitude: '123.1942' }));
  await updateListing(listing.id, 'farmer-demo', { price_per_unit: 30 });
  await updateListing(listing.id, 'farmer-demo', { pickup_location_public: true });
  const updated = await updateListing(listing.id, 'farmer-demo', { pickup_location_public: false });
  assert.equal(updated.pickup_latitude, 13.6217);
  assert.equal(updated.pickup_longitude, 123.1942);
  assert.equal(updated.pickup_location, listing.pickup_location);
  assert.equal(updated.pickup_barangay, 'Carolina');
  assert.equal(getPublicListingById(getSnapshot(), listing.id).pickup_latitude, null);
  const cleared = await updateListing(listing.id, 'farmer-demo', { pickup_latitude: '', pickup_longitude: '' });
  assert.equal(cleared.pickup_latitude, null);
  assert.equal(cleared.pickup_longitude, null);
});

test('every open reservation state locks name, pickup text, area, coordinates, and consent', async () => {
  for (const state of ['pending', 'confirmed', 'ready']) {
    const listing = await createListing('farmer-demo', listingValues({ pickup_barangay: 'Carolina', pickup_latitude: 13.6217, pickup_longitude: 123.1942, pickup_location_public: true }));
    const order = await createReservation({ listing_id: listing.id, buyer_id: 'buyer-demo', quantity: 2, fulfillment_method: 'pickup', request_id: crypto.randomUUID() });
    if (state !== 'pending') await transitionReservation(order.id, 'farmer-demo', 'confirm');
    if (state === 'ready') await transitionReservation(order.id, 'farmer-demo', 'ready');
    for (const changes of [
      { produce_name: 'Changed produce' }, { pickup_location: 'Changed pickup' }, { pickup_barangay: 'San Felipe' },
      { pickup_latitude: 0 }, { pickup_longitude: 0 }, { pickup_latitude: '', pickup_longitude: '' },
      { pickup_location_public: false },
    ]) {
      const saved = localStorage.getItem(STORAGE_KEY);
      await assert.rejects(updateListing(listing.id, 'farmer-demo', changes), /pickup location unchanged/);
      assert.equal(localStorage.getItem(STORAGE_KEY), saved);
    }
    const updated = await updateListing(listing.id, 'farmer-demo', { price_per_unit: 30 });
    assert.equal(updated.pickup_latitude, listing.pickup_latitude);
    assert.equal(updated.pickup_barangay, 'Carolina');
    assert.equal(updated.pickup_location_public, true);
    assert.equal(getSnapshot().reservations.find((item) => item.id === order.id).price_per_unit, 20);
    await transitionReservation(order.id, 'buyer-demo', 'cancel');
    const moved = await updateListing(listing.id, 'farmer-demo', { pickup_location: 'New pickup', pickup_barangay: 'San Felipe', pickup_latitude: 0, pickup_longitude: 0, pickup_location_public: false });
    assert.equal(moved.pickup_location, 'New pickup');
    assert.equal(moved.pickup_latitude, 0);
    assert.equal(moved.pickup_location_public, false);
  }
});

test('legacy listings remain unconfirmed and price-only edits retain their existing pins during holds', async () => {
  await mutateData((data) => {
    const listing = data.listings.find((item) => item.id === 'tomatoes');
    delete listing.pickup_barangay;
    delete listing.pickup_location_public;
    delete listing.location_is_demo;
    listing.pickup_latitude = String(listing.pickup_latitude);
    listing.pickup_longitude = String(listing.pickup_longitude);
  });
  const saved = localStorage.getItem(STORAGE_KEY);
  const snapshot = structuredClone(getSnapshot());
  assert.equal(getPublicListings()[0].pickup_location_public, false);
  assert.equal(getPublicListingById(getSnapshot(), 'tomatoes').pickup_latitude, null);
  assert.equal(localStorage.getItem(STORAGE_KEY), saved);
  assert.deepEqual(getSnapshot(), snapshot);
  const updated = await updateListing('tomatoes', 'farmer-demo', { price_per_unit: 30 });
  assert.equal(updated.pickup_latitude, 13.6217);
  assert.equal(updated.pickup_longitude, 123.1942);
  assert.equal(updated.pickup_barangay, '');
  assert.equal(updated.pickup_location_public, false);
  assert.equal(updated.location_is_demo, false);
  await assert.rejects(updateListing('tomatoes', 'farmer-demo', { pickup_location_public: true }), /pickup location unchanged/);
});

test('only unchanged seeded sample locations retain demo provenance, including on relist', async () => {
  const seed = createDemoData();
  assert.ok(seed.listings.every((listing) => listing.pickup_location_public === true && listing.location_is_demo === true));
  assert.deepEqual([...new Set(seed.listings.map((listing) => listing.pickup_barangay))].sort(), ['Carolina', 'San Felipe']);
  const created = await createListing('farmer-demo', listingValues({ location_is_demo: true }));
  assert.equal((await updateListing(created.id, 'farmer-demo', { location_is_demo: true })).location_is_demo, false);
  assert.equal((await updateListing('spinach', 'farmer-demo', { price_per_unit: 40 })).location_is_demo, true);
  await withdrawListing('spinach', 'farmer-demo');
  assert.equal((await relistListing('spinach', 'farmer-demo', { selling_deadline: listingValues().selling_deadline })).location_is_demo, true);
  await withdrawListing('spinach', 'farmer-demo');
  const moved = await relistListing('spinach', 'farmer-demo', { pickup_latitude: 0, pickup_longitude: 0, selling_deadline: listingValues().selling_deadline });
  assert.equal(moved.location_is_demo, false);
  assert.equal(moved.pickup_location_public, true);
});
