import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Sprout } from 'lucide-react';
import { EmptyState, Notice, PageHeader, StatusBadge } from '../../components/common/UI';
import ProduceImage from '../../components/marketplace/ProduceImage';
import OrderSummary from '../../components/cart/OrderSummary';
import useCart from '../../hooks/useCart';
import useDemoData from '../../hooks/useDemoData';
import { checkoutCart, checkoutIssue, groupCartItems, validCartPrice } from '../../services/cartService';
import { getReservations } from '../../services/reservationService';
import { processTimeEvents } from '../../services/storageService';
import { round } from '../../services/dataRules';
import { dateTime, money, quantity } from '../../utils/format';

export default function Checkout() {
  const cart = useCart();
  return <CheckoutContent key={`${cart.buyerId}:${cart.checkout?.id || 'none'}`} cart={cart} />;
}

function CheckoutContent({ cart }) {
  const data = useDemoData();
  const [arrangements, setArrangements] = useState(() => Object.fromEntries(cart.selectedItems.map((item) => [item.listing_id, { fulfillment_method: item.listing?.pickup_available ? 'pickup' : 'delivery', fulfillment_notes: '' }])));
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const issue = checkoutIssue(cart);
  const orders = cart.buyerId && cart.checkout?.status === 'completed' ? getReservations(data, { buyerId: cart.buyerId }).filter((order) => order.checkout_id === cart.checkout.id) : [];

  useEffect(() => {
    let mounted = true;
    processTimeEvents().catch((err) => { if (mounted) setError(err.message); });
    return () => { mounted = false; };
  }, []);

  if (orders.length) return <OrderConfirmation orders={orders} remaining={cart.itemCount} />;
  if (!cart.checkout) return <><PageHeader title="Checkout" /><EmptyState title="Review your cart first" description="Select the products you want to reserve, then proceed to checkout from your cart." action={<Link to="/cart" className="btn btn-primary">Back to Shopping Cart <ArrowRight aria-hidden="true" /></Link>} /></>;

  const deliveryItems = cart.selectedItems.filter((item) => arrangements[item.listing_id]?.fulfillment_method === 'delivery');
  const invalidDelivery = deliveryItems.some((item) => !item.listing?.delivery_available || !validCartPrice(item.listing?.delivery_fee));
  const deliveryFee = deliveryItems.length && !invalidDelivery ? round(deliveryItems.reduce((sum, item) => sum + item.listing.delivery_fee, 0)) : null;
  const methodLabel = deliveryItems.length === 0 ? 'Pickup for each reservation' : deliveryItems.length === cart.selectedItems.length ? 'Delivery for each reservation' : 'Pickup and delivery, as selected below';
  const change = (id, field, value) => { setArrangements((current) => ({ ...current, [id]: { ...current[id], [field]: value } })); setReviewed(false); setError(''); };

  const submit = async (event) => {
    event.preventDefault();
    if (submitting.current || issue || invalidDelivery) return;
    if (!reviewed) { setReviewed(true); return; }
    submitting.current = true;
    setBusy(true);
    setError('');
    try { await checkoutCart(cart.buyerId, cart.checkout.id, arrangements); }
    catch (err) { setError(err.message); }
    finally { submitting.current = false; setBusy(false); }
  };

  return <div>
    <PageHeader title={reviewed ? 'Review Your Reservations' : 'Checkout'} description={reviewed ? 'Confirm your produce, arrangements, and listed costs before saving the demo reservations.' : 'Choose the arrangements offered by each listing. Every product becomes a reservation with its farmer.'} actions={<Link to="/cart" className="btn btn-secondary"><ArrowLeft aria-hidden="true" />Back to Cart</Link>} />
    <div className="mb-5"><Notice>This is a local simulation. No payment is processed and no real farmer is contacted. Reservations need farmer confirmation before pickup or delivery.</Notice></div>
    {(issue || error || invalidDelivery) && <div className="mb-5"><Notice tone="error">{error || issue || 'A selected delivery option is unavailable. Review your cart.'}<Link to="/cart" className="mt-2 block font-semibold underline">Review Shopping Cart</Link></Notice></div>}
    <form onSubmit={submit} aria-busy={busy} className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">
        <p className="text-xs font-semibold text-black/65" role="status">{reviewed ? 'Step 2 of 2 / Final review' : 'Step 1 of 2 / Pickup and delivery'}</p>
        {groupCartItems(cart.selectedItems).map((group) => <section className="panel min-w-0" key={group.farmer_id} aria-label={`Review ${group.farmer_name}`}>
          <div className="flex items-center gap-3 border-b border-black/10 p-4"><Sprout size={19} className="shrink-0 text-green" aria-hidden="true" /><h2 className="min-w-0 break-words text-base">{group.farmer_name}</h2></div>
          <div className="divide-y divide-black/10">{group.items.map((item) => {
            const arrangement = arrangements[item.listing_id];
            const delivery = arrangement?.fulfillment_method === 'delivery';
            const publicLocation = item.listing?.pickup_location_public === true ? item.listing.pickup_location || item.listing.pickup_barangay || 'Pickup location not provided' : 'Pickup location not provided';
            return <article key={item.listing_id} className="min-w-0 p-4" aria-label={`Review ${item.produce_name}`}>
              <div className="flex min-w-0 items-start gap-3"><ProduceImage src={item.image_url} alt={item.produce_name} className="h-16 w-16 shrink-0 overflow-hidden rounded-md" /><div className="min-w-0 flex-1"><h3 className="break-words text-sm">{item.produce_name}</h3><p className="mt-1 text-xs text-black/65">{quantity(item.quantity)} {item.unit} at {item.price_per_unit === null ? 'unavailable price' : money(item.price_per_unit)} / {item.unit}</p><p className="mt-1 text-sm font-semibold">{item.subtotal === null ? 'Subtotal unavailable' : money(item.subtotal)}</p></div></div>
              {reviewed ? <div className="mt-4 space-y-2 text-sm"><p><strong>{delivery ? 'Delivery' : 'Pickup'}</strong>{delivery && validCartPrice(item.listing?.delivery_fee) && ` / ${money(item.listing.delivery_fee)} listed fee`}</p><p className="text-black/65">Public pickup location: {publicLocation}</p>{arrangement?.fulfillment_notes.trim() && <p className="whitespace-pre-wrap break-words text-black/65">Notes: {arrangement.fulfillment_notes}</p>}</div> : <fieldset className="mt-4 min-w-0 space-y-4" disabled={busy || Boolean(issue)}>
                <legend className="label">How will you receive {item.produce_name}?</legend>
                <div className="flex flex-wrap gap-2">
                  {item.listing?.pickup_available && <label className="cart-method"><input type="radio" name={`method-${item.listing_id}`} value="pickup" checked={!delivery} onChange={() => change(item.listing_id, 'fulfillment_method', 'pickup')} />Pickup</label>}
                  {item.listing?.delivery_available && <label className="cart-method"><input type="radio" name={`method-${item.listing_id}`} value="delivery" checked={delivery} disabled={!validCartPrice(item.listing.delivery_fee)} onChange={() => change(item.listing_id, 'fulfillment_method', 'delivery')} />{validCartPrice(item.listing.delivery_fee) ? `Delivery (+${money(item.listing.delivery_fee)})` : 'Delivery fee unavailable'}</label>}
                </div>
                <p className="text-xs text-black/65">Public pickup location: {publicLocation}</p>
                <div><label htmlFor={`notes-${item.listing_id}`} className="label">Arrangement notes <span className="font-normal text-black/65">(optional)</span></label><textarea id={`notes-${item.listing_id}`} rows={2} maxLength={500} className="input" value={arrangement?.fulfillment_notes || ''} onChange={(event) => change(item.listing_id, 'fulfillment_notes', event.target.value)} placeholder="Preferred pickup time or general delivery area. Do not share sensitive information." /></div>
              </fieldset>}
            </article>;
          })}</div>
        </section>)}
      </div>
      <OrderSummary productCount={cart.selectedItems.length} subtotal={cart.subtotal} deliveryFee={deliveryFee} method={methodLabel} totalLabel="Reservation total" arranged>
        {reviewed && <div className="mb-4"><Notice tone="warning">Pending reservations hold stock for up to 24 hours, or until the selling deadline if sooner. Payment stays unrecorded.</Notice></div>}
        <button type="submit" className="btn btn-primary w-full" disabled={busy || Boolean(issue) || invalidDelivery}>{busy ? 'Saving reservations...' : reviewed ? 'Place Demo Reservations' : 'Review Reservations'}<ArrowRight aria-hidden="true" /></button>
        {reviewed && <button type="button" className="btn btn-secondary mt-3 w-full" onClick={() => setReviewed(false)} disabled={busy}>Edit Arrangements</button>}
        <p className="mt-3 text-xs text-black/65">Only selected products are included. No card or payment details are required.</p>
      </OrderSummary>
    </form>
  </div>;
}

function OrderConfirmation({ orders, remaining }) {
  const subtotal = round(orders.reduce((sum, order) => sum + order.subtotal, 0));
  const deliveryFee = orders.some((order) => order.fulfillment_method === 'delivery') ? round(orders.reduce((sum, order) => sum + order.additional_costs, 0)) : null;
  return <div>
    <PageHeader title="Order Confirmation" description="Your demo reservations are saved. Track confirmation, pickup, and handover in My Reservations." />
    <div className="mb-6"><Notice tone="success">Saved in this browser only. No payment was processed and no real farmer received an order.</Notice></div>
    <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">{groupCartItems(orders).map((group) => <section key={group.farmer_id} className="panel min-w-0 p-4"><h2 className="mb-4 break-words text-base">{group.farmer_name}</h2><div className="space-y-5">{group.items.map((order) => <article key={order.id} className="min-w-0 border-t border-black/10 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><Link to={`/buyer/reservations?reservation=${order.id}`} className="break-all text-sm font-bold underline underline-offset-4">{order.reservation_reference}</Link><StatusBadge status={order.status} /></div>
        <h3 className="mt-3 break-words text-sm">{order.produce_name}</h3><p className="mt-1 text-sm text-black/65">{quantity(order.quantity)} {order.unit} / {money(order.price_per_unit)} per {order.unit}</p>
        <p className="mt-2 text-sm">{order.fulfillment_method === 'delivery' ? 'Delivery' : 'Pickup'} / {money(order.total_amount)} total</p><p className="mt-1 text-xs text-black/65">Reservation window: {dateTime(order.expires_at)}. Payment is separate.</p>
      </article>)}</div></section>)}<Link to="/buyer/reservations" className="btn btn-primary"><CheckCircle2 aria-hidden="true" />View My Reservations</Link></div>
      <OrderSummary productCount={orders.length} subtotal={subtotal} deliveryFee={deliveryFee} method="See the arrangements on each reservation" totalLabel="Reserved total" arranged>
        {remaining > 0 && <p className="mb-4 text-sm">{quantity(remaining)} other {remaining === 1 ? 'item remains' : 'items remain'} in your cart.</p>}
        <Link to="/cart" className="btn btn-secondary w-full">Return to Cart</Link><Link to="/marketplace" className="btn btn-quiet mt-2 w-full">Continue Shopping <ArrowRight aria-hidden="true" /></Link>
      </OrderSummary>
    </div>
  </div>;
}
