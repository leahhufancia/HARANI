import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ShoppingCart as CartIcon, Sprout, Trash2 } from 'lucide-react';
import { ConfirmDialog, EmptyState, Notice, PageHeader } from '../../components/common/UI';
import ProduceImage from '../../components/marketplace/ProduceImage';
import QuantityStepper from '../../components/cart/QuantityStepper';
import OrderSummary from '../../components/cart/OrderSummary';
import useCart from '../../hooks/useCart';
import { checkoutIssue, clearCart, groupCartItems, prepareCartCheckout, removeCartItems, selectCartItems, setCartQuantity, validCartQuantity } from '../../services/cartService';
import { processTimeEvents } from '../../services/storageService';
import { money, quantity } from '../../utils/format';

export default function ShoppingCart() {
  const cart = useCart();
  return <CartContent key={cart.buyerId} cart={cart} />;
}

function CartContent({ cart }) {
  const { buyerId, items, selectedItems, itemCount, subtotal, warning } = cart;
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [drafts, setDrafts] = useState({});
  const working = useRef(false);
  const draftValue = (item) => drafts[item.listing_id]?.base === item.quantity ? drafts[item.listing_id].value : String(item.quantity);
  const invalidDraft = (item) => !validCartQuantity(draftValue(item)) || Number(draftValue(item)) > item.max_quantity;
  const issue = checkoutIssue(cart, false);
  const invalidSelected = selectedItems.some(invalidDraft);
  const allSelected = items.length > 0 && items.length === selectedItems.length;

  useEffect(() => {
    let mounted = true;
    processTimeEvents().catch((err) => { if (mounted) setError(err.message); });
    return () => { mounted = false; };
  }, []);

  const run = async (action, after) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError('');
    try { await action(); after?.(); }
    catch (err) { setError(err.message); }
    finally { working.current = false; setBusy(false); }
  };

  const changeQuantity = (item, value) => {
    setDrafts((current) => ({ ...current, [item.listing_id]: { base: item.quantity, value } }));
    setError('');
    if (validCartQuantity(value) && Number(value) <= item.max_quantity) {
      run(() => setCartQuantity(buyerId, item.listing_id, value), () => setDrafts((current) => { const next = { ...current }; delete next[item.listing_id]; return next; }));
    }
  };

  return <div>
    <PageHeader title="Shopping Cart" description={`${quantity(itemCount)} ${itemCount === 1 ? 'item' : 'items'} in your cart / ${items.length} ${items.length === 1 ? 'product' : 'products'}`} actions={<><Link to="/marketplace" className="btn btn-secondary"><ArrowLeft aria-hidden="true" />Continue Shopping</Link>{items.length > 0 && <button type="button" className="btn btn-quiet" onClick={() => { setError(''); setConfirmClear(true); }} disabled={busy}><Trash2 aria-hidden="true" />Clear Cart</button>}</>} />
    {warning && <div className="mb-5"><Notice tone="warning">{warning}</Notice></div>}
    {error && !confirmClear && <div className="mb-5"><Notice tone="error">{error}</Notice></div>}
    {!items.length ? <EmptyState icon={CartIcon} title="Your cart is empty." description="Browse fresh local produce and add the harvests you would like to bring home." action={<Link to="/marketplace" className="btn btn-primary">Browse Marketplace <ArrowRight aria-hidden="true" /></Link>} /> : <form noValidate onSubmit={(event) => { event.preventDefault(); if (!issue && !invalidSelected) run(() => prepareCartCheckout(buyerId), () => navigate('/checkout')); }} aria-busy={busy} className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 pb-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold"><input type="checkbox" className="h-4 w-4" checked={allSelected} ref={(input) => { if (input) input.indeterminate = selectedItems.length > 0 && !allSelected; }} onChange={(event) => run(() => selectCartItems(buyerId, items.map((item) => item.listing_id), event.target.checked))} disabled={busy} />Select all products</label>
          <span className="text-xs text-black/65">{selectedItems.length} of {items.length} selected</span>
        </div>
        {groupCartItems(items).map((group) => <section className="panel min-w-0" key={group.farmer_id} aria-label={`Products from ${group.farmer_name}`}>
          <div className="flex min-w-0 items-center gap-3 border-b border-black/10 px-4 py-4"><Sprout size={19} className="shrink-0 text-green" aria-hidden="true" /><h2 className="min-w-0 break-words text-base">{group.farmer_name}</h2></div>
          <div className="divide-y divide-black/10">{group.items.map((item) => <article className="min-w-0 p-4" key={item.listing_id} aria-label={item.produce_name}>
            <div className="grid min-w-0 grid-cols-[24px_64px_minmax(0,1fr)] items-start gap-3">
              <label className="flex min-h-11 cursor-pointer items-center justify-center"><input type="checkbox" className="h-4 w-4" checked={item.selected} onChange={(event) => run(() => selectCartItems(buyerId, [item.listing_id], event.target.checked))} disabled={busy} aria-label={`Select ${item.produce_name} from ${item.farmer_name}`} /></label>
              <ProduceImage src={item.image_url} alt={item.produce_name} className="h-16 w-16 overflow-hidden rounded-md" />
              <div className="min-w-0"><h3 className="break-words text-sm"><Link to={`/marketplace/${item.listing_id}`} className="hover:underline">{item.produce_name}</Link></h3><p className="mt-1 text-sm">{item.price_per_unit === null ? 'Price unavailable' : money(item.price_per_unit)} <span className="text-xs text-black/65">/ {item.unit}</span></p><p className="mt-1 text-xs text-black/65">{quantity(item.available_quantity)} {item.unit} available</p></div>
            </div>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
              <div><p className="mb-1 text-xs text-black/65">Quantity ({item.unit})</p><QuantityStepper label={`Quantity for ${item.produce_name}`} value={draftValue(item)} onChange={(value) => changeQuantity(item, value)} max={item.max_quantity} disabled={busy || Boolean(item.productError)} invalid={invalidDraft(item)} describedBy={item.error || invalidDraft(item) ? `cart-error-${item.listing_id}` : undefined} /></div>
              <div className="ml-auto text-right"><p className="text-xs text-black/65">Subtotal</p><p className="text-sm font-bold tabular-nums">{item.subtotal === null ? 'Unavailable' : money(item.subtotal)}</p></div>
              <button type="button" className="btn btn-quiet !px-3" disabled={busy} aria-label={`Remove ${item.produce_name} from cart`} onClick={() => run(() => removeCartItems(buyerId, [item.listing_id]))}><Trash2 aria-hidden="true" /><span className="sr-only">Remove</span></button>
            </div>
            {(item.error || invalidDraft(item)) && <p id={`cart-error-${item.listing_id}`} role="alert" className="mt-3 border-l-2 border-yellow pl-3 text-xs">{item.error || `Choose a whole number from 1 to ${quantity(item.max_quantity)}. Your quantity has not been changed.`}</p>}
            {item.priceChanged && <p className="mt-3 text-xs text-black/65">The farmer updated this price. Your subtotal uses the latest listed price.</p>}
          </article>)}</div>
        </section>)}
        <p className="text-xs text-black/65">Adding to your cart does not reserve stock. Quantities are held only after you place a reservation at checkout.</p>
      </div>
      <OrderSummary productCount={selectedItems.length} subtotal={subtotal}>
        {(issue || invalidSelected) && <p className="mb-4 border-l-2 border-yellow pl-3 text-xs" role="status">{!selectedItems.length ? 'Select at least one product to continue.' : 'Adjust or deselect the highlighted products before checkout.'}</p>}
        <button type="submit" className="btn btn-primary w-full" disabled={busy || Boolean(issue) || invalidSelected}>{busy ? 'Updating cart...' : 'Proceed to Checkout'}<ArrowRight aria-hidden="true" /></button>
        <p className="mt-3 text-xs text-black/65">No payment is collected.</p>
      </OrderSummary>
    </form>}
    {confirmClear && <ConfirmDialog title="Clear your cart?" description={<><p>Remove every product from this buyer account's cart? Existing reservations will not change.</p>{error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}</>} confirmLabel="Clear Cart" onClose={() => setConfirmClear(false)} busy={busy} onConfirm={() => run(() => clearCart(buyerId), () => { setConfirmClear(false); setDrafts({}); })} />}
  </div>;
}
