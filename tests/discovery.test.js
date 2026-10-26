import assert from 'node:assert/strict';
import { test } from 'node:test';
import { discoverListings, invalidDiscoveryFilters } from '../src/services/discoveryService.js';
import { distanceKm, distanceLabel } from '../src/utils/location.js';

const listing = (id, longitude, updates = {}) => ({
  id, farmer_id: 'seller', farmer: { status: 'active', role: 'farmer' }, status: 'active', produce_name: `Tomatoes ${id}`,
  category: 'Fruit vegetables', unit: 'kg', price_per_unit: 20, available_quantity: 10, pickup_available: true, delivery_available: false,
  pickup_location_public: true, pickup_latitude: 0, pickup_longitude: longitude, pickup_barangay: 'Published barangay',
  created_at: '2026-10-25T10:00:00Z', selling_deadline: '2026-11-01T10:00:00Z', ...updates,
});
const produce = [listing('far', 0.2, { price_per_unit: 5 }), listing('near', 0.005, { price_per_unit: 30 }), listing('middle', 0.05, { price_per_unit: 15 }), listing('missing', null)];

test('nearby defaults and every radius filter the same map and list records', () => {
  for (const [radius, ids] of [['1', ['near']], ['5', ['near']], ['10', ['near', 'middle']], ['25', ['near', 'middle', 'far']], ['all', ['near', 'middle', 'far']]]) {
    const results = discoverListings(produce, { radius, sort: 'nearest' }, [0, 0]);
    assert.deepEqual(results.listings.map((item) => item.id), ids);
    assert.deepEqual(results.mapListings.map((item) => item.id), ids);
    assert.equal(results.excludedUnlocatedCount, 1);
  }
  assert.equal(produce[0].distance_km, undefined, 'filtering never mutates service data');
});

test('search, category, price, quantity, unit, fulfillment and distance compose', () => {
  const results = discoverListings(produce, { search: 'tomatoes', category: 'Fruit vegetables', minPrice: 10, maxPrice: 20, minQuantity: 5, unit: 'kg', fulfillment: 'pickup', radius: '10', sort: 'price-low' }, [0, 0]);
  assert.deepEqual(results.listings.map((item) => item.id), ['middle']);
  assert.deepEqual(results.mapListings.map((item) => item.id), ['middle']);
  assert.equal(discoverListings(produce, { search: 'spinach', radius: 'all' }, [0, 0]).listings.length, 0);
  assert.equal(discoverListings(produce, { category: 'Alliums', radius: 'all' }, [0, 0]).listings.length, 0);
});

test('price and newest sorts work, including records without a location outside distance searches', () => {
  const price = discoverListings(produce, { radius: 'all', sort: 'price-low' }, [0, 0]);
  assert.deepEqual(price.listings.map((item) => item.id), ['far', 'middle', 'missing', 'near']);
  assert.equal(price.mapListings.length, 3);
  const recent = discoverListings([listing('older', 0, { created_at: '2026-10-20T00:00:00Z' }), listing('newer', 1)], { sort: 'recent', radius: 'all' });
  assert.deepEqual(recent.listings.map((item) => item.id), ['newer', 'older']);
});

test('permission-free barangay browsing never infers distances from place names', () => {
  const results = discoverListings(produce, { barangay: 'Published barangay', radius: '1', sort: 'nearest' });
  assert.equal(results.listings.length, 4);
  assert.ok(results.listings.every((item) => item.distance_km === null));
  assert.equal(results.unlocatedCount, 1);
  assert.equal(results.excludedUnlocatedCount, 0);
  assert.equal(discoverListings(produce, { barangay: 'Some other place' }).listings.length, 0);
});

test('manual map searches distinguish search-point distance from buyer distance', () => {
  const results = discoverListings(produce, { radius: '1', sort: 'nearest' }, [0, 0.2], [0, 0]);
  assert.equal(results.listings[0].id, 'far');
  assert.equal(results.listings[0].distance_km, 0);
  assert.equal(results.listings[0].buyer_distance_km, distanceKm([0, 0], [0, 0.2]));
  assert.match(distanceLabel({ ...results.listings[0], location_is_demo: true }, 'from map search point'), /from map search point \(sample pin\)/);
});

test('invalid filter values fail closed and cannot create a misleading radius', () => {
  for (const filters of [{ minPrice: -1 }, { maxPrice: 'no' }, { minQuantity: Infinity }, { minPrice: 50, maxPrice: 10 }, { radius: '100' }]) {
    assert.equal(invalidDiscoveryFilters(filters), true);
    assert.deepEqual(discoverListings(produce, filters, [0, 0]).listings, []);
  }
  assert.equal(invalidDiscoveryFilters({ minPrice: '0', maxPrice: '0', radius: 'all' }), false);
});
