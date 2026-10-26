import { expect, test } from '@playwright/test';
import { createDemoData } from '../../src/services/demoSeed.js';

const tileURL = 'https://tile.openstreetmap.org/**';
const pageErrors = new WeakMap();
const serveTile = (route) => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#eef1ea"/><path d="M0 128H256M128 0V256" stroke="#d4dccd"/></svg>' });

async function seedBrowser(page, prepare = () => {}) {
  const data = createDemoData();
  prepare(data);
  await page.addInitScript((seed) => {
    if (!localStorage.getItem('harani.demo.v1')) localStorage.setItem('harani.demo.v1', JSON.stringify(seed));
    window.locationRequests = 0;
    const getPosition = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    navigator.geolocation.getCurrentPosition = (...args) => { window.locationRequests += 1; return getPosition(...args); };
  }, data);
  return data;
}

async function loginAs(page, role = 'Buyer') {
  await page.goto('/login');
  await page.getByRole('button', { name: `${role} sample account` }).click();
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await expect(page).toHaveURL(role === 'Buyer' ? /\/marketplace$/ : /\/farmer\/dashboard$/);
}

test.beforeEach(async ({ page }) => {
  const errors = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  // Exercise Leaflet without depending on or burdening the public tile service.
  await page.route(tileURL, serveTile);
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});

test('marketplace is a full-width product grid without a map, tile requests or GPS prompts', async ({ page }, testInfo) => {
  await seedBrowser(page);
  const mapRequests = [];
  page.on('request', (request) => { if (request.url().includes('tile.openstreetmap.org')) mapRequests.push(request.url()); });
  await page.goto('/marketplace');
  await expect(page.getByRole('heading', { name: 'Available Produce' })).toBeVisible();
  await expect(page.locator('.marketplace-product')).toHaveCount(7);
  await expect(page.locator('.leaflet-container')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Search this area|Fit results|My location/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Nearby Map' })).toHaveCount(0);
  await expect(page.getByText('No matching pickup pins')).toHaveCount(0);
  expect(mapRequests).toEqual([]);
  expect(await page.evaluate(() => window.locationRequests)).toBe(0);
  const cards = page.locator('.marketplace-product');
  const first = await cards.nth(0).boundingBox();
  const second = await cards.nth(1).boundingBox();
  const third = await cards.nth(2).boundingBox();
  const fourth = await cards.nth(3).boundingBox();
  expect(second.x).toBeGreaterThan(first.x + first.width);
  expect(third.y).toBe(first.y);
  expect(fourth.y).toBeGreaterThan(first.y);
  const tomatoes = page.getByRole('article', { name: 'Fresh tomatoes', exact: true });
  await expect(tomatoes).toContainText('Santos Family Farm');
  await expect(tomatoes).toContainText('20.00');
  await expect(tomatoes).toContainText('45 kg left');
  await expect(tomatoes).toContainText('Barangay Carolina');
  await expect(tomatoes).toContainText('Harvested');
  await expect(tomatoes).toContainText('Available until');
  await expect(tomatoes.getByRole('link', { name: 'View Product', exact: true })).toBeVisible();
  await expect(tomatoes.getByRole('button', { name: 'Add to Cart', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'My Reservations', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= document.body.scrollHeight + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('desktop-product-grid.png') });
});

test('card clicks open the correct saved pickup map and returning preserves filters', async ({ page }) => {
  await seedBrowser(page);
  await page.goto('/marketplace?category=Fruit%20vegetables&sort=price-low');
  await page.getByRole('article', { name: 'Fresh tomatoes', exact: true }).getByText('Fruit vegetables', { exact: true }).click();
  await expect(page).toHaveURL(/\/marketplace\/tomatoes$/);
  await expect(page.getByRole('heading', { name: 'Fresh tomatoes', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pickup Location', exact: true })).toBeVisible();
  const map = page.getByRole('region', { name: 'Pickup map for Fresh tomatoes', exact: true });
  await expect(map).toBeVisible();
  const pin = map.locator('.leaflet-marker-icon');
  await expect(pin).toHaveCount(1);
  await expect(pin).toHaveAttribute('title', 'Pickup for Fresh tomatoes');
  const mapBounds = await map.boundingBox();
  const pinBounds = await pin.boundingBox();
  expect(Math.abs(pinBounds.x + 12 - mapBounds.x - mapBounds.width / 2)).toBeLessThan(3);
  expect(Math.abs(pinBounds.y + 41 - mapBounds.y - mapBounds.height / 2)).toBeLessThan(3);
  expect(mapBounds.height).toBeLessThanOrEqual(322);
  await pin.click();
  await expect(page.locator('.leaflet-popup-content')).toContainText('Fresh tomatoes');
  await expect(page.locator('.leaflet-popup-content')).toContainText('Barangay Carolina');
  await expect(page.locator('.leaflet-popup-content')).toContainText('Sample pickup pin');
  await map.locator('.leaflet-control-zoom-in').click();
  await map.locator('.leaflet-container').focus();
  const before = await pin.getAttribute('style');
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => pin.getAttribute('style')).not.toBe(before);
  expect(await page.evaluate(() => window.locationRequests)).toBe(0);
  await page.getByRole('link', { name: 'Back to Marketplace', exact: true }).click();
  expect(new URL(page.url()).searchParams.get('category')).toBe('Fruit vegetables');
  await expect(page.getByLabel('Sort by')).toHaveValue('price-low');
  await expect(page.locator('.leaflet-container')).toHaveCount(0);
});

test('View Product and location links show only the chosen product and seller', async ({ page }) => {
  const data = await seedBrowser(page);
  await page.goto('/marketplace');
  const cabbage = data.listings.find((item) => item.id === 'cabbage');
  const farmer = data.profiles.find((profile) => profile.id === cabbage.farmer_id);
  await page.getByRole('article', { name: 'Green cabbage', exact: true }).getByRole('link', { name: 'View Product', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Green cabbage', exact: true })).toBeVisible();
  await expect(page.getByText(farmer.seller_name, { exact: true })).toBeVisible();
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1);
  await expect(page.locator('.leaflet-marker-icon')).toHaveAttribute('title', 'Pickup for Green cabbage');
  await page.getByRole('link', { name: 'Back to Marketplace', exact: true }).click();
  await page.getByRole('article', { name: 'Fresh spinach', exact: true }).getByRole('link', { name: /Barangay Carolina/ }).click();
  await expect(page).toHaveURL(/\/marketplace\/spinach#pickup-location$/);
  await expect(page.locator('.leaflet-marker-icon')).toHaveAttribute('title', 'Pickup for Fresh spinach');
  expect(await page.evaluate(() => window.locationRequests)).toBe(0);
});

test('search, prices, category, sorting and optional distance filters still compose without a map', async ({ page }) => {
  await seedBrowser(page);
  await page.goto('/marketplace');
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await expect(page.getByLabel('Distance radius')).toBeDisabled();
  await page.getByRole('button', { name: 'Use my location for distance', exact: true }).click();
  await expect(page.getByText('Distance filters are enabled.', { exact: false })).toBeVisible();
  await page.getByLabel('Distance radius').selectOption('1');
  await expect(page.locator('.marketplace-product')).toHaveCount(4);
  await page.getByLabel('Distance radius').selectOption('5');
  await page.getByRole('button', { name: 'Leafy vegetables', exact: true }).click();
  await expect(page.locator('.marketplace-product')).toHaveCount(2);
  await page.getByLabel('Maximum price / unit (PHP)', { exact: true }).fill('30');
  await expect(page.locator('.marketplace-product')).toHaveCount(1);
  await expect(page.locator('.marketplace-product')).toHaveAttribute('data-listing-id', 'cabbage');
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await page.getByLabel('Sort by').selectOption('price-low');
  await expect(page.locator('.marketplace-product').first()).toHaveAttribute('data-listing-id', 'tomatoes');
  await page.getByLabel('Search produce by name').fill('potatoes');
  await expect(page.locator('.marketplace-product')).toHaveCount(1);
  await expect(page.locator('.marketplace-product')).toHaveAttribute('data-listing-id', 'potatoes');
  await expect(page.locator('.leaflet-container')).toHaveCount(0);
  expect(await page.evaluate(() => window.locationRequests)).toBe(1);
});

for (const [code, message] of [[1, 'Location permission was denied.'], [2, 'Your location could not be determined.'], [3, 'Finding your location timed out.']]) {
  test(`optional location error ${code} preserves barangay browsing and product maps`, async ({ page }) => {
    await seedBrowser(page);
    await page.addInitScript((errorCode) => { navigator.geolocation.getCurrentPosition = (_success, error) => error({ code: errorCode }); }, code);
    await page.goto('/marketplace');
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    await page.getByRole('button', { name: 'Use my location for distance', exact: true }).click();
    await expect(page.getByText(message, { exact: false })).toBeVisible();
    await page.getByLabel('Pickup barangay', { exact: true }).selectOption('San Felipe');
    await expect(page.locator('.marketplace-product')).toHaveCount(3);
    await page.getByRole('article', { name: 'Green cabbage', exact: true }).getByRole('link', { name: 'View Product', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Pickup map for Green cabbage', exact: true })).toBeVisible();
    await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1);
  });
}

test('missing and unpublished locations stay visible and reservable without exposing private data', async ({ page }) => {
  await seedBrowser(page, (data) => {
    data.profiles[0].farm_address = 'PRIVATE FARM ADDRESS';
    data.profiles[0].phone = 'PRIVATE PHONE';
    data.listings.forEach((listing, index) => {
      if (index % 2 === 0) { listing.pickup_location_public = false; listing.pickup_location = 'PRIVATE PICKUP ADDRESS'; }
      else { listing.pickup_latitude = null; listing.pickup_longitude = null; }
    });
  });
  await loginAs(page);
  await expect(page.locator('.marketplace-product')).toHaveCount(7);
  await expect(page.locator('.leaflet-container')).toHaveCount(0);
  expect(await page.locator('body').innerText()).not.toContain('PRIVATE');
  await page.getByRole('article', { name: 'Fresh spinach', exact: true }).getByRole('link', { name: 'View Product', exact: true }).click();
  await expect(page.getByText('Interactive map unavailable', { exact: true })).toBeVisible();
  await expect(page.locator('#pickup-location')).toContainText('Barangay Carolina');
  await expect(page.locator('.leaflet-container')).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to Marketplace', exact: true }).click();
  await page.getByRole('article', { name: 'Fresh tomatoes', exact: true }).getByRole('link', { name: 'View Product', exact: true }).click();
  await expect(page.getByText('Pickup location not provided', { exact: true })).toBeVisible();
  await expect(page.getByText('The interactive map is unavailable until the farmer provides a confirmed public pickup pin.', { exact: false })).toBeVisible();
  await expect(page.locator('.leaflet-container')).toHaveCount(0);
  expect(await page.locator('body').innerText()).not.toContain('PRIVATE');
  await page.getByLabel('Quantity (kg)', { exact: true }).fill('45');
  await page.getByRole('button', { name: 'Reserve Produce', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Reservation receipt' })).toBeVisible();
  const order = await page.evaluate(() => JSON.parse(localStorage.getItem('harani.demo.v1')).reservations.find((item) => item.listing_id === 'tomatoes' && item.quantity === 45));
  expect(order.pickup_latitude).toBeNull();
  expect(order.pickup_longitude).toBeNull();
  expect(order.pickup_location).toBe('Location not provided');
});

test('product tile failures offer a retry without disabling purchase controls', async ({ page }) => {
  await seedBrowser(page);
  await page.unroute(tileURL);
  await page.route(tileURL, (route) => route.abort());
  await page.goto('/marketplace');
  await expect(page.getByRole('button', { name: 'Retry map tiles' })).toHaveCount(0);
  await page.getByRole('article', { name: 'Fresh tomatoes', exact: true }).getByRole('link', { name: 'View Product', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry map tiles' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to Cart', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Log In to Reserve Produce', exact: true })).toBeEnabled();
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1);
  await page.unroute(tileURL);
  await page.route(tileURL, serveTile);
  await page.getByRole('button', { name: 'Retry map tiles' }).click();
  await expect(page.getByRole('button', { name: 'Retry map tiles' })).toHaveCount(0);
});

test('grid cart controls do not open details and checkout preserves public-location privacy', async ({ page }) => {
  await seedBrowser(page, (data) => {
    const spinach = data.listings.find((item) => item.id === 'spinach');
    spinach.pickup_location_public = false;
    spinach.pickup_location = 'PRIVATE PICKUP ADDRESS';
  });
  await loginAs(page);
  const spinach = page.getByRole('article', { name: 'Fresh spinach', exact: true });
  await spinach.getByRole('spinbutton').fill('2');
  await spinach.getByRole('button', { name: 'Add to Cart', exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('harani.demo.v1')).carts['buyer-demo']?.items.find((item) => item.listing_id === 'spinach')?.quantity)).toBe(2);
  await expect(page).toHaveURL(/\/marketplace$/);
  await page.goto('/cart');
  await expect(page.getByRole('article', { name: 'Fresh spinach', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Proceed to Checkout', exact: true }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  expect(await page.locator('body').innerText()).not.toContain('PRIVATE');
  await page.getByRole('button', { name: 'Review Reservations', exact: true }).click();
  expect(await page.locator('body').innerText()).not.toContain('PRIVATE');
  await page.getByRole('button', { name: 'Place Demo Reservations', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Order Confirmation', exact: true })).toBeVisible();
  const order = await page.evaluate(() => JSON.parse(localStorage.getItem('harani.demo.v1')).reservations.find((item) => item.listing_id === 'spinach' && item.checkout_id));
  expect(order.quantity).toBe(2);
  expect(order.pickup_location).toBe('Location not provided');
  await page.getByRole('link', { name: 'Return to Cart', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your cart is empty.', exact: true })).toBeVisible();
});

test('selected product keeps the existing partial reservation flow and updates stock', async ({ page }) => {
  await seedBrowser(page);
  await loginAs(page);
  await page.getByRole('article', { name: 'Fresh tomatoes', exact: true }).getByRole('link', { name: 'View Product', exact: true }).click();
  await page.getByLabel('Quantity (kg)', { exact: true }).fill('1.25');
  await page.getByRole('button', { name: 'Reserve Produce', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Reservation receipt' })).toBeVisible();
  const order = await page.evaluate(() => JSON.parse(localStorage.getItem('harani.demo.v1')).reservations.find((item) => item.listing_id === 'tomatoes' && item.quantity === 1.25));
  expect(order.status).toBe('pending');
  expect(order.pickup_latitude).toBe(13.6217);
  expect(order.pickup_longitude).toBe(123.1942);
  await page.getByRole('link', { name: 'Go to My Reservations' }).click();
  await expect(page).toHaveURL(/\/buyer\/reservations\?reservation=/);
  await expect(page.getByText(order.reservation_reference, { exact: false }).first()).toBeVisible();
  await page.goto('/marketplace');
  await expect(page.getByRole('article', { name: 'Fresh tomatoes', exact: true })).toContainText('43.75 kg left');
  await expect(page.locator('.leaflet-container')).toHaveCount(0);
});

test('farmer can choose, approve, create and edit a pickup location without profile backfill', async ({ page }) => {
  await seedBrowser(page);
  await loginAs(page, 'Farmer');
  await page.goto('/farmer/add-produce');
  await expect(page.locator('#pickup_location')).toHaveValue('');
  await expect(page.locator('#pickup_latitude')).toHaveValue('');
  await expect(page.locator('#pickup_location_public')).not.toBeChecked();
  await page.locator('#produce_name').fill('Browser pickup carrots');
  await page.locator('#category').selectOption('Root vegetables');
  await page.locator('#listed_quantity').fill('10');
  await page.locator('#price_per_unit').fill('12.5');
  await page.locator('#pickup_location').fill('Public market main entrance');
  await page.locator('#pickup_barangay').fill('Carolina');
  await page.locator('#pickup_latitude').fill('13.6217');
  await page.locator('#pickup_longitude').fill('123.1942');
  await page.locator('#pickup_location_public').check();
  const map = page.getByRole('region', { name: 'Public pickup pin (optional)', exact: true }).locator('.leaflet-container');
  await expect(map.locator('.leaflet-marker-icon')).toHaveCount(1);
  await expect(page.getByText('Loading map tiles. Manual coordinate entry remains available.', { exact: true })).toBeHidden();
  await map.click({ position: { x: 150, y: 110 } });
  await expect(page.locator('#pickup_location_public')).not.toBeChecked();
  const latitude = Number(await page.locator('#pickup_latitude').inputValue());
  const longitude = Number(await page.locator('#pickup_longitude').inputValue());
  expect(Number.isFinite(latitude) && Number.isFinite(longitude)).toBe(true);
  await page.locator('#pickup_location_public').check();
  await page.getByRole('button', { name: 'Post Produce', exact: true }).click();
  await expect(page).toHaveURL(/\/farmer\/harvest$/);
  const listing = await page.evaluate(() => JSON.parse(localStorage.getItem('harani.demo.v1')).listings.find((item) => item.produce_name === 'Browser pickup carrots'));
  expect(listing.farmer_id).toBe('farmer-demo');
  expect(listing.pickup_location_public).toBe(true);
  expect(listing.pickup_latitude).toBe(latitude);
  expect(listing.pickup_longitude).toBe(longitude);
  await page.goto(`/farmer/harvest/${listing.id}/edit`);
  await expect(page.locator('#pickup_location_public')).toBeChecked();
  await expect(page.locator('#pickup_latitude')).toHaveValue(String(latitude));
  await page.locator('#price_per_unit').fill('13');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(page).toHaveURL(/\/farmer\/harvest$/);
  await page.goto('/marketplace?q=Browser');
  await expect(page.locator('.marketplace-product')).toHaveCount(1);
  await page.getByRole('link', { name: 'View Product', exact: true }).click();
  await expect(page.locator('.leaflet-marker-icon')).toHaveAttribute('title', 'Pickup for Browser pickup carrots');
  expect(await page.evaluate(() => window.locationRequests)).toBe(0);
});

test('existing reservations keep farmer pickup fields and map selection locked', async ({ page }) => {
  await seedBrowser(page);
  await loginAs(page, 'Farmer');
  await page.goto('/farmer/harvest/tomatoes/edit');
  for (const field of ['pickup_location', 'pickup_barangay', 'pickup_latitude', 'pickup_longitude', 'pickup_location_public']) await expect(page.locator(`#${field}`)).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Use my location to move map', exact: true })).toBeDisabled();
  await page.getByRole('region', { name: 'Public pickup pin (optional)', exact: true }).locator('.leaflet-container').click({ position: { x: 150, y: 110 } });
  await expect(page.locator('#pickup_latitude')).toHaveValue('13.6217');
  await expect(page.locator('#pickup_longitude')).toHaveValue('123.1942');
  await expect(page.locator('#pickup_location_public')).toBeChecked();
});

test.describe('mobile product discovery', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('products and their saved pickup maps fit mobile without map/list toggles', async ({ page }, testInfo) => {
    await seedBrowser(page);
    await page.goto('/marketplace');
    await expect(page.locator('.marketplace-product')).toHaveCount(7);
    await expect(page.locator('.leaflet-container')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Map|List \(/ })).toHaveCount(0);
    const first = await page.locator('.marketplace-product').nth(0).boundingBox();
    const second = await page.locator('.marketplace-product').nth(1).boundingBox();
    expect(second.y).toBeGreaterThan(first.y + first.height);
    await page.getByLabel('Search produce by name').fill('spinach');
    await expect(page.locator('.marketplace-product')).toHaveCount(1);
    await page.screenshot({ path: testInfo.outputPath('mobile-product-grid.png'), fullPage: true });
    await page.getByRole('link', { name: 'View Product', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Pickup map for Fresh spinach', exact: true })).toBeVisible();
    await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1);
    expect(await page.evaluate(() => window.locationRequests)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.setViewportSize({ width: 320, height: 740 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('link', { name: 'Back to Marketplace', exact: true }).click();
    await expect(page.getByLabel('Search produce by name')).toHaveValue('spinach');
    await expect(page.locator('.leaflet-container')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});
