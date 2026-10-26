import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clusterListings, distanceKm, getCoordinates, listingCoordinates } from '../src/utils/location.js';

test('pickup pins accept finite coordinates, numeric input values, and zero', () => {
  assert.deepEqual(getCoordinates(13.6217, 123.1942), [13.6217, 123.1942]);
  assert.deepEqual(getCoordinates(' 13.6217 ', '123.1942'), [13.6217, 123.1942]);
  assert.deepEqual(getCoordinates(0, 0), [0, 0]);
  assert.deepEqual(getCoordinates(-90, 180), [-90, 180]);
});

test('missing, partial, malformed, or out-of-range pins cannot render a map', () => {
  for (const [latitude, longitude] of [
    [undefined, undefined], [null, null], ['', ''], [' ', ' '],
    [13.6217, null], ['', 123.1942], [NaN, 123], [13, Infinity],
    [91, 123], [-91, 123], [13, 181], [13, -181],
    [false, false], [[], []], ['Naga City', 'Carolina'],
  ]) {
    assert.equal(getCoordinates(latitude, longitude), null);
  }
});

test('Haversine uses actual coordinates, including zero, poles and the date line', () => {
  assert.equal(distanceKm([0, 0], [0, 0]), 0);
  assert.ok(Math.abs(distanceKm([0, 0], [0, 1]) - 111.195) < 0.001);
  assert.ok(Math.abs(distanceKm([0, 179.9], [0, -179.9]) - 22.239) < 0.001);
  assert.ok(Math.abs(distanceKm([90, 0], [-90, 0]) - 20015.1144) < 0.001);
  assert.equal(distanceKm(null, [13, 123]), null);
  assert.equal(distanceKm([91, 0], [13, 123]), null);
  assert.equal(distanceKm(['Carolina', 'Naga City'], [13, 123]), null);
});

test('screen-space clusters preserve collocated products and anchor only at published pins', () => {
  const listing = (id, longitude, price) => ({ id, farmer_id: 'same-farmer', pickup_location_public: true, pickup_latitude: 0, pickup_longitude: longitude, price_per_unit: price });
  const products = [listing('first', 0, 10), listing('second', 0, 20), listing('near', 0.01, 30), listing('far', 2, 40), { ...listing('private', 0, 50), pickup_location_public: false }];
  const groups = clusterListings(products, ([latitude, longitude]) => ({ x: longitude * 100, y: latitude * 100 }));
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].coordinates, [0, 0]);
  assert.deepEqual(groups[0].listings.map((item) => item.price_per_unit), [10, 20, 30]);
  assert.deepEqual(groups.flatMap((group) => group.listings.map((item) => item.id)), ['first', 'second', 'near', 'far']);
  assert.equal(listingCoordinates(products[4]), null);
  assert.equal(clusterListings(products, ([latitude, longitude]) => ({ x: longitude * 10000, y: latitude * 10000 })).length, 3);
});
