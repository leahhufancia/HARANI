export const CATEGORIES = ['Leafy vegetables', 'Fruit vegetables', 'Root vegetables', 'Squash & gourds', 'Alliums'];

const photo = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`;

export function createDemoData(now = Date.now()) {
  const at = (hours) => new Date(now + hours * 3600000).toISOString();
  const profiles = [
    { id: 'farmer-demo', role: 'farmer', full_name: 'Maria Santos', email: 'farmer@harani.demo', seller_name: 'Santos Family Farm', location: 'Barangay Carolina, Naga City', verification_status: 'verified' },
    { id: 'farmer-reyes', role: 'farmer', full_name: 'Ernesto Reyes', email: 'ernesto@harani.demo', seller_name: 'Reyes Vegetable Garden', location: 'Barangay San Felipe, Naga City', verification_status: 'pending' },
    { id: 'buyer-demo', role: 'buyer', full_name: 'Ana Cruz', email: 'buyer@harani.demo', buyer_type: 'household', location: 'Naga City', verification_status: 'unverified' },
    { id: 'buyer-business', role: 'buyer', full_name: 'Lina Ramos', email: 'lina@harani.demo', buyer_type: 'business', business_name: 'Lina\'s Kitchen (demo)', business_type: 'Carenderia', location: 'Naga City', verification_status: 'unverified' },
    { id: 'admin-demo', role: 'admin', full_name: 'Harani Administrator', email: 'admin@harani.demo', location: '', verification_status: 'verified' },
  ].map((profile) => ({ phone: '', categories: [], preferences: { deadline_reminders: true }, status: 'active', onboarding_complete: true, created_at: at(-168), ...profile }));

  const produce = [
    ['tomatoes', 'Fresh tomatoes', 'Fruit vegetables', 50, 20, 'sell-now', 8, 'photo-1546094096-0df4bcaaa337', 'farmer-demo'],
    ['spinach', 'Fresh spinach', 'Leafy vegetables', 25, 35, 'sell-today', 20, 'photo-1576045057995-568f588f82fb', 'farmer-demo'],
    ['carrots', 'Sweet carrots', 'Root vegetables', 40, 45, 'planned', 72, 'photo-1447175008436-054170c2e979', 'farmer-demo'],
    ['cabbage', 'Green cabbage', 'Leafy vegetables', 60, 25, 'sell-today', 24, 'photo-1594282486552-05b4d80fbb9f', 'farmer-reyes'],
    ['potatoes', 'Fresh potatoes', 'Root vegetables', 35, 50, 'planned', 48, 'photo-1518977676601-b53f82aba655', 'farmer-demo'],
    ['squash', 'Local squash', 'Squash & gourds', 45, 30, 'planned', 96, 'photo-1570586437263-ab629fccc818', 'farmer-reyes'],
    ['onions', 'Red onions', 'Alliums', 20, 65, 'planned', 120, 'photo-1508747703725-719777637510', 'farmer-reyes'],
  ];
  const listings = produce.map(([id, produce_name, category, listed_quantity, price_per_unit, urgency, hours, image, farmer_id], index) => ({
    id, farmer_id, produce_name, category, listed_quantity, price_per_unit, urgency,
    selling_deadline: at(hours), unit: 'kg', status: 'active', image_url: photo(image),
    condition_details: 'Freshly harvested surplus. Naturally varied sizes; inspect the produce together at handover. Sample listing for the Harani demo.',
    harvest_date: at(-24).slice(0, 10), pickup_location: profiles.find((profile) => profile.id === farmer_id).location,
    pickup_available: true, delivery_available: index % 2 === 0, delivery_fee: index % 2 === 0 ? 20 : 0,
    created_at: at(-24 - index * 2), updated_at: at(-24),
  }));

  const orders = [
    ['order-1001', 'tomatoes', 'buyer-demo', 5, 'pending', -1],
    ['order-1002', 'cabbage', 'buyer-business', 10, 'confirmed', -2],
    ['order-1003', 'potatoes', 'buyer-demo', 3, 'ready', -3],
    ['order-1004', 'carrots', 'buyer-demo', 4, 'completed', -26],
  ];
  const reservations = orders.map(([id, listing_id, buyer_id, count, status, hours], index) => {
    const listing = listings.find((item) => item.id === listing_id);
    return {
      id, request_id: `seed-${id}`, reservation_reference: `HRN-DEMO-${1001 + index}`,
      listing_id, buyer_id, farmer_id: listing.farmer_id, quantity: count, unit: listing.unit,
      produce_name: listing.produce_name, image_url: listing.image_url, price_per_unit: listing.price_per_unit,
      subtotal: count * listing.price_per_unit, additional_costs: 0, total_amount: count * listing.price_per_unit,
      fulfillment_method: 'pickup', fulfillment_notes: 'Demo pickup. Agree on the exact time with the seller.',
      pickup_location: listing.pickup_location, status,
      fulfillment_status: { pending: 'awaiting_confirmation', confirmed: 'preparing', ready: 'ready_for_pickup', completed: 'handed_over' }[status],
      payment_status: 'not_recorded', created_at: at(hours), expires_at: status === 'pending' ? at(4) : listing.selling_deadline,
      confirmed_at: status !== 'pending' ? at(hours + 0.1) : null,
      ready_at: ['ready', 'completed'].includes(status) ? at(hours + 0.2) : null,
      completed_at: status === 'completed' ? at(-24) : null,
      harvest_pass: status === 'pending' ? null : { verification_code: `DEMO-${1042 + index}`, verified_at: status === 'completed' ? at(-24) : null, verified_by: status === 'completed' ? listing.farmer_id : null },
    };
  });

  return {
    schemaVersion: 1, revision: 0, profiles, listings, reservations,
    notifications: [
      { id: 'notice-1', user_id: 'farmer-demo', title: 'A reservation needs your attention', message: 'Ana reserved 5 kg of tomatoes in the demo. Confirm or reject the request.', link: '/farmer/reservations?reservation=order-1001', created_at: at(-1), is_read: false },
      { id: 'notice-2', user_id: 'buyer-demo', title: 'Your potatoes are ready for pickup', message: 'Open your Digital Harvest Pass before the demo handover.', link: '/buyer/reservations?reservation=order-1003', created_at: at(-0.5), is_read: false },
      { id: 'notice-3', user_id: 'buyer-demo', title: 'Carrot handover completed', message: 'A sample completed order is in My Purchases. No payment has been recorded.', link: '/buyer/purchases?reservation=order-1004', created_at: at(-24), is_read: true },
    ],
    verifications: [
      { id: 'verification-reyes', user_id: 'farmer-reyes', status: 'pending', submitted_at: at(-48), notes: 'Sample seller profile provided for a simulated review. No identity documents were collected.', document_label: 'Demo seller profile (no real document)', reason: '', reviewed_at: null, reviewed_by: null },
    ],
    auditLogs: [
      { id: 'audit-seed', actor_id: 'system', actor_name: 'Demo setup', action: 'demo_initialized', entity_type: 'demo', entity_id: 'local-browser', details: 'Sample profiles, produce, and reservation histories created in this browser. These are not real transactions.', created_at: at(-26) },
    ],
  };
}
