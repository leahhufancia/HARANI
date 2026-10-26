import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { createDemoData } from '../src/services/demoSeed.js';
import { createReservationInData } from '../src/services/reservationService.js';
import { getSnapshot, mutateData, processTimeEvents, STORAGE_KEY } from '../src/services/storageService.js';
import { addCartItem, checkoutCart, getCart, prepareCartCheckout } from '../src/services/cartService.js';

const saved = new Map();
globalThis.localStorage = { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, String(value)) };
let revision = 500;
beforeEach(async () => {
  const data = createDemoData();
  data.revision = revision++;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  await processTimeEvents();
});

test('direct reservations snapshot published coordinates without exposing unpublished location data', () => {
  const data = createDemoData();
  const values = { listing_id: 'tomatoes', buyer_id: 'buyer-demo', quantity: 1.25, fulfillment_method: 'pickup', request_id: 'public-snapshot' };
  const result = createReservationInData(data, values);
  assert.equal(result.pickup_latitude, 13.6217);
  assert.equal(result.pickup_longitude, 123.1942);
  assert.equal(result.quantity, 1.25);
  data.listings[0].pickup_latitude = 15;
  assert.equal(result.pickup_latitude, 13.6217, 'agreed pickup survives future listing changes');
  data.listings[0].pickup_location_public = false;
  data.listings[0].pickup_location = 'PRIVATE HOME ADDRESS';
  const privateResult = createReservationInData(data, { ...values, request_id: 'unpublished-snapshot' });
  assert.equal(privateResult.pickup_location, 'Location not provided');
  assert.equal(privateResult.pickup_latitude, null);
  assert.equal(privateResult.pickup_longitude, null);
  assert.equal(privateResult.pickup_barangay, '');
});

test('cart checkout requires another review if the public pickup pin changes', async () => {
  await addCartItem('buyer-demo', 'spinach', 2);
  const checkout = await prepareCartCheckout('buyer-demo');
  await mutateData((data) => { data.listings.find((item) => item.id === 'spinach').pickup_latitude += 0.01; });
  await assert.rejects(checkoutCart('buyer-demo', checkout.id, { spinach: { fulfillment_method: 'pickup' } }), /details have changed/);
  assert.equal(getCart(getSnapshot(), 'buyer-demo').items.length, 1);
  const reviewed = await prepareCartCheckout('buyer-demo');
  const receipts = await checkoutCart('buyer-demo', reviewed.id, { spinach: { fulfillment_method: 'pickup' } });
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].pickup_latitude, getSnapshot().listings.find((item) => item.id === 'spinach').pickup_latitude);
  assert.equal(getCart(getSnapshot(), 'buyer-demo').items.length, 0);
});
