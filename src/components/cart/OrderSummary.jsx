import { money } from '../../utils/format';
import { round } from '../../services/dataRules';

export default function OrderSummary({ productCount, subtotal, deliveryFee = null, method = 'Choose pickup or delivery at checkout', totalLabel = 'Estimated total', arranged = false, children }) {
  const total = subtotal === null ? null : round(subtotal + (deliveryFee ?? 0));
  return <aside aria-label="Order summary" className="cart-order-summary panel min-w-0 self-start p-5 lg:sticky lg:top-6">
    <h2 className="text-lg">Order Summary</h2>
    <dl className="mt-5 space-y-4 text-sm">
      <div className="flex justify-between gap-4"><dt className="text-black/65">Selected products</dt><dd className="font-semibold">{productCount}</dd></div>
      <div className="flex justify-between gap-4"><dt className="text-black/65">Item subtotal</dt><dd className="font-semibold" data-testid="selected-subtotal">{subtotal === null ? 'Unavailable' : money(subtotal)}</dd></div>
      <div><dt className="text-black/65">Pickup / delivery</dt><dd className="mt-1 text-sm">{method}</dd></div>
      {deliveryFee !== null && <div className="flex justify-between gap-4"><dt className="text-black/65">Listed delivery fees</dt><dd>{money(deliveryFee)}</dd></div>}
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-black/10 pt-4"><dt className="font-semibold">{totalLabel}</dt><dd className="text-xl font-bold tabular-nums" aria-live="polite" aria-atomic="true" data-testid="estimated-total">{total === null ? 'Unavailable' : money(total)}</dd></div>
    </dl>
    <p className="mb-5 mt-3 text-xs leading-relaxed text-black/65">{deliveryFee !== null ? 'Delivery fees are set by each listing and apply once per reservation. No other charges are added.' : arranged ? 'No delivery fee is included. Confirm the exact arrangements with each farmer; personal travel costs are not included.' : 'Pickup and delivery arrangements are confirmed during checkout. Any listed delivery fee is shown before you place reservations.'}</p>
    {children}
  </aside>;
}
