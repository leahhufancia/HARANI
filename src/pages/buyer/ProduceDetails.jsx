import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, MapPin, Minus, Plus, Sprout, Truck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useDemoData from '../../hooks/useDemoData';
import { getListingById } from '../../services/produceService';
import { createReservation } from '../../services/reservationService';
import { dateTime, money, quantity, shortDate } from '../../utils/format';
import ProduceImage from '../../components/marketplace/ProduceImage';
import { EmptyState, Modal, Notice, StatusBadge } from '../../components/common/UI';
import ProduceMap from '../../components/map/ProduceMap';

export default function ProduceDetails() {
  const { productId } = useParams();
  return <ProduceContent key={productId} productId={productId} />;
}

function ProduceContent({ productId }) {
  const data = useDemoData();
  const { user } = useAuth();
  const listing = getListingById(data, productId);
  const navigate = useNavigate();
  const location = useLocation();
  const [count, setCount] = useState(String(Math.min(1, listing?.available_quantity || 1)));
  const [method, setMethod] = useState(listing?.pickup_available ? 'pickup' : 'delivery');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const requestId = useRef(globalThis.crypto.randomUUID());
  const submitting = useRef(false);
  const isOwner = listing?.farmer_id === user?.id;
  const hidden = listing && (listing.status === 'moderated' || listing.farmer?.status !== 'active') && !isOwner && user?.role !== 'admin';

  if (!listing || hidden) return <EmptyState title="This harvest is not available" description="The listing may have been removed. Browse other produce in the marketplace." action={<Link className="btn btn-primary" to="/marketplace">Back to Marketplace</Link>} />;
  const available = listing.status === 'active' && listing.farmer?.status === 'active';
  const countNumber = Number(count);
  const validQuantity = count !== '' && Number.isFinite(countNumber) && countNumber > 0 && countNumber <= listing.available_quantity && Math.abs(countNumber * 100 - Math.round(countNumber * 100)) < 0.00001;
  const subtotal = validQuantity ? Math.round(countNumber * listing.price_per_unit * 100) / 100 : 0;
  const costs = method === 'delivery' ? listing.delivery_fee : 0;

  const reserve = async (event) => {
    event.preventDefault();
    if (!user) { navigate('/login', { state: { from: location.pathname } }); return; }
    if (submitting.current || receipt) return;
    if (!validQuantity) { setError(`Choose up to ${quantity(listing.available_quantity)} ${listing.unit}, with at most two decimal places.`); return; }
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const saved = await createReservation({ listing_id: listing.id, buyer_id: user.id, quantity: countNumber, fulfillment_method: method, fulfillment_notes: notes, request_id: requestId.current });
      setReceipt(saved);
      setShowReceipt(true);
    } catch (err) { setError(err.message); } finally { submitting.current = false; setBusy(false); }
  };

  return <div>
    <Link to="/marketplace" className="mb-6 inline-flex min-h-10 items-center gap-2 text-sm text-black/65"><ArrowLeft size={16} />Back to Marketplace</Link>
    <div className="grid gap-7 lg:grid-cols-2 xl:gap-10">
      <div className="contents lg:block"><div className="order-1"><div className="relative overflow-hidden rounded-xl"><ProduceImage src={listing.image_url} alt={listing.produce_name} eager className="aspect-[5/4] w-full" /><div className="absolute left-4 top-4 rounded bg-white"><StatusBadge status={listing.urgency} /></div></div><p className="mt-2 text-xs text-black/55">Demo listing. Photography is illustrative; inspect actual produce at handover.</p></div><div className="order-3">
        <section className="panel surface-sage mt-7 p-4 sm:p-5"><h2 className="mb-3 text-lg">From this grower</h2><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-green/8 text-green-700"><Sprout size={22} /></span><div><p className="font-semibold">{listing.farmer?.seller_name || listing.farmer?.full_name}</p><p className="text-sm text-black/60">{listing.farmer?.full_name} / Demo farmer</p>{listing.farmer?.verification_status === 'verified' && <div className="mt-2"><StatusBadge status="verified" /></div>}</div></div></section>
        <section className="panel surface-ivory mt-6 p-4 sm:p-5" aria-labelledby="product-location"><h2 id="product-location" className="mb-3 text-lg">Pickup & location</h2><p className="flex items-start gap-2 text-sm"><MapPin size={18} className="mt-0.5 shrink-0" />{listing.pickup_location}</p><div className="mt-4"><ProduceMap pickupLocation={listing.pickup_location} latitude={listing.pickup_latitude} longitude={listing.pickup_longitude} /></div></section>
      </div></div>
      <div className="panel order-2 min-w-0 self-start p-4 sm:p-6 lg:order-none"><p className="eyebrow mb-2">{listing.category}</p><h1 className="text-3xl sm:text-4xl">{listing.produce_name}</h1><div className="my-4 flex flex-wrap items-baseline gap-2"><strong className="text-3xl font-bold tracking-tight">{money(listing.price_per_unit)}</strong><span className="text-black/60">per {listing.unit}</span></div>
        <div className="mb-5 flex flex-wrap items-center gap-3"><span className="text-sm font-semibold">{quantity(Math.max(0, listing.available_quantity))} {listing.unit} available</span><StatusBadge status={listing.status} /></div>
        <p className="mb-5 text-sm leading-relaxed text-black/65">{listing.condition_details || 'No additional condition details were provided. Please inspect the produce at handover.'}</p>
        <dl className="surface-ivory mb-6 grid gap-3 rounded-lg border p-4 text-sm"><div className="flex items-center justify-between gap-3"><dt className="flex items-center gap-2 text-black/60"><CalendarDays size={16} />Harvested</dt><dd>{shortDate(listing.harvest_date)}</dd></div><div className="flex items-start justify-between gap-3"><dt className="flex items-center gap-2 text-black/60"><Clock3 size={16} />Selling deadline</dt><dd className="text-right">{dateTime(listing.selling_deadline)}</dd></div><div className="flex items-start justify-between gap-3"><dt className="flex items-center gap-2 text-black/60"><Truck size={16} />Fulfillment</dt><dd className="text-right">{[listing.pickup_available && 'Pickup', listing.delivery_available && `Delivery (+${money(listing.delivery_fee)})`].filter(Boolean).join(' or ')}</dd></div></dl>
        {!available && <div className="mb-5"><Notice>This listing cannot accept new reservations. Existing order receipts remain in your workspace.</Notice></div>}
        {receipt ? <div className="space-y-4"><Notice tone="success">Reservation {receipt.reservation_reference} saved. The farmer can now review your request.</Notice><Link to={`/buyer/reservations?reservation=${receipt.id}`} className="btn btn-primary w-full">View My Reservation <ArrowRight /></Link><button type="button" className="btn btn-secondary w-full" onClick={() => setShowReceipt(true)}>View receipt</button></div> : <form onSubmit={reserve} className="space-y-4">
          <div><label className="label" htmlFor="reservation-quantity">Quantity ({listing.unit})</label><div className="flex flex-wrap items-center gap-2"><button type="button" className="btn btn-secondary !px-3" aria-label="Decrease quantity" disabled={!available || countNumber <= 0.01} onClick={() => setCount(String(Math.max(0.01, Math.round((countNumber - 1) * 100) / 100)))}><Minus /></button><input id="reservation-quantity" className="input !w-28 text-center" type="number" min="0.01" max={listing.available_quantity} step="0.01" inputMode="decimal" required value={count} disabled={!available} onChange={(event) => { setCount(event.target.value); setError(''); }} /><button type="button" className="btn btn-secondary !px-3" aria-label="Increase quantity" disabled={!available || countNumber >= listing.available_quantity} onClick={() => setCount(String(Math.min(listing.available_quantity, Math.round((countNumber + 1) * 100) / 100)))}><Plus /></button><span className="basis-full text-xs text-black/55 sm:basis-auto">Reserve a little or a lot.</span></div></div>
          <fieldset><legend className="label">How will you receive it?</legend><div className="flex flex-wrap gap-3">{listing.pickup_available && <label className="flex min-h-11 items-center gap-2 rounded border border-black/20 px-3 text-sm"><input type="radio" name="fulfillment" value="pickup" checked={method === 'pickup'} onChange={() => setMethod('pickup')} />Pickup</label>}{listing.delivery_available && <label className="flex min-h-11 items-center gap-2 rounded border border-black/20 px-3 text-sm"><input type="radio" name="fulfillment" value="delivery" checked={method === 'delivery'} onChange={() => setMethod('delivery')} />Delivery (+{money(listing.delivery_fee)})</label>}</div></fieldset>
          <div><label htmlFor="fulfillment-notes" className="label">Arrangement notes <span className="font-normal text-black/60">(optional)</span></label><textarea id="fulfillment-notes" className="input" rows={2} maxLength={500} placeholder="Preferred pickup time or general delivery area. Do not share sensitive information." value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
          <dl className="surface-sage rounded-lg border p-4 text-sm"><div className="flex justify-between gap-3"><dt>Produce subtotal</dt><dd>{money(subtotal)}</dd></div><div className="mt-2 flex justify-between gap-3"><dt>{method === 'delivery' ? 'Delivery cost' : 'Pickup cost'}</dt><dd>{money(costs)}</dd></div><div className="mt-3 flex justify-between gap-3 border-t border-black/10 pt-3 font-semibold"><dt>Reservation total</dt><dd className="text-lg">{money(subtotal + costs)}</dd></div></dl>
          {error && <Notice tone="error">{error}</Notice>}
          {user && user.role !== 'buyer' ? <Notice>{isOwner ? 'This is your listing. Manage its quantities and availability in My Harvest.' : 'To reserve this produce, switch to a buyer demo account.'}<Link className="mt-2 block font-semibold underline" to={isOwner ? '/farmer/harvest' : '/login'}>{isOwner ? 'Open My Harvest' : 'Switch demo account'}</Link></Notice> : <button type="submit" className="btn btn-primary w-full" disabled={busy || !available || !validQuantity}>{busy ? 'Saving reservation...' : user ? 'Reserve Produce' : 'Log In to Reserve Produce'}<ArrowRight /></button>}
          <p className="text-xs leading-relaxed text-black/55">Frontend demo only. No payment is collected. Pending reservations expire within 24 hours or at the selling deadline, whichever comes first. Personal travel costs are not included.</p>
        </form>}
      </div>
    </div>
    {showReceipt && receipt && <Modal title="Reservation receipt" onClose={() => setShowReceipt(false)}><Notice tone="success">Your demo reservation is saved. Inventory has been updated for both buyer and farmer.</Notice><p className="eyebrow mt-5">{receipt.reservation_reference}</p><h2 className="mb-4 mt-2 text-xl">{receipt.produce_name}</h2><dl className="space-y-3 text-sm"><div className="flex justify-between gap-3"><dt>Quantity</dt><dd>{quantity(receipt.quantity)} {receipt.unit}</dd></div><div className="flex justify-between gap-3"><dt>Agreed price / {receipt.unit}</dt><dd>{money(receipt.price_per_unit)}</dd></div><div className="flex justify-between gap-3"><dt>Additional costs</dt><dd>{money(receipt.additional_costs)}</dd></div><div className="flex justify-between gap-3 font-semibold"><dt>Total</dt><dd>{money(receipt.total_amount)}</dd></div><div className="flex justify-between gap-3"><dt>Expires</dt><dd>{dateTime(receipt.expires_at)}</dd></div></dl><p className="my-4 text-sm text-black/60">Awaiting farmer confirmation. A Digital Harvest Pass is issued once confirmed. Payment is not recorded.</p><Link to={`/buyer/reservations?reservation=${receipt.id}`} className="btn btn-primary w-full">Go to My Reservations <ArrowRight /></Link></Modal>}
  </div>;
}
