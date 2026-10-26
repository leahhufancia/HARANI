import { useId, useState } from 'react';
import { CheckCircle, Copy, Ticket } from 'lucide-react';
import { dateTime, money, quantity } from '../../utils/format';
import { Notice, StatusBadge } from './UI';

export default function DigitalHarvestPass({ reservation }) {
  const codeId = useId();
  const [copying, setCopying] = useState(false);
  const [copyResult, setCopyResult] = useState(null);
  if (!reservation) return null;
  const code = reservation.harvest_pass?.verification_code;
  const eligible = ['confirmed', 'ready', 'completed'].includes(reservation.status) && Boolean(code);
  const verified = reservation.harvest_pass?.verified_at;

  async function copyCode() {
    setCopying(true);
    setCopyResult(null);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard is unavailable in this browser. Select the code below and copy it manually.');
      await navigator.clipboard.writeText(code);
      setCopyResult({ tone: 'success', text: 'Harvest Pass code copied.' });
    } catch (error) {
      setCopyResult({ tone: 'error', text: error?.name === 'NotAllowedError' ? 'Clipboard permission was denied. Select the code below and copy it manually.' : error.message || 'The code could not be copied. Select it and copy manually.' });
    } finally {
      setCopying(false);
    }
  }

  return (
    <section className="space-y-5" aria-label={eligible ? 'Digital Harvest Pass and reservation receipt' : 'Reservation receipt'}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 pb-4">
        <div><p className="mb-1 text-xs font-semibold uppercase tracking-widest text-black/60">Local demo receipt</p><h3 className="flex items-center gap-2 text-lg font-semibold"><Ticket size={20} aria-hidden="true" />{eligible ? 'Digital Harvest Pass' : 'Reservation details'}</h3></div>
        {verified && reservation.status === 'completed' && <span className="flex items-center gap-2 text-sm font-medium"><CheckCircle className="text-[#159600]" size={18} aria-hidden="true" />Handover recorded</span>}
      </div>

      <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-black/60">Reservation reference</dt><dd className="mt-1 break-all font-semibold">{reservation.reservation_reference || reservation.id}</dd></div>
        <div><dt className="text-xs text-black/60">Requested</dt><dd className="mt-1">{dateTime(reservation.created_at)}</dd></div>
        <div><dt className="text-xs text-black/60">Produce</dt><dd className="mt-1 font-medium">{reservation.produce_name || 'Produce'}</dd></div>
        <div><dt className="text-xs text-black/60">Reserved quantity</dt><dd className="mt-1 font-medium">{quantity(reservation.quantity)} {reservation.unit}</dd></div>
        <div><dt className="text-xs text-black/60">Buyer</dt><dd className="mt-1">{reservation.buyer?.full_name || 'Buyer account'}{reservation.buyer?.business_name ? ` / ${reservation.buyer.business_name}` : ''}</dd></div>
        <div><dt className="text-xs text-black/60">Farmer</dt><dd className="mt-1">{reservation.farmer?.full_name || 'Farmer account'}{reservation.farmer?.seller_name ? ` / ${reservation.farmer.seller_name}` : ''}</dd></div>
        <div><dt className="text-xs text-black/60">Reservation status</dt><dd className="mt-1"><StatusBadge status={reservation.status} /></dd></div>
        <div><dt className="text-xs text-black/60">Fulfillment status</dt><dd className="mt-1"><StatusBadge status={reservation.fulfillment_status} /></dd></div>
        <div><dt className="text-xs text-black/60">Reservation expiry</dt><dd className="mt-1">{dateTime(reservation.expires_at)}</dd></div>
        <div><dt className="text-xs text-black/60">Arrangement</dt><dd className="mt-1">{reservation.fulfillment_method === 'delivery' ? 'Delivery' : 'Pickup'}</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs text-black/60">Agreed pickup location / collection point</dt><dd className="mt-1 whitespace-pre-wrap break-words">{reservation.pickup_location || 'Not provided'}</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs text-black/60">Arrangement notes</dt><dd className="mt-1 whitespace-pre-wrap break-words">{reservation.fulfillment_notes || 'No additional notes provided.'}</dd></div>
      </dl>

      <div className="rounded-xl border border-black/10 bg-black/[0.02] p-4">
        <dl className="space-y-2 text-sm">
          <div className="flex flex-wrap justify-between gap-2"><dt>Agreed unit price</dt><dd>{money(reservation.price_per_unit)} / {reservation.unit}</dd></div>
          <div className="flex flex-wrap justify-between gap-2"><dt>Produce subtotal</dt><dd>{money(reservation.subtotal)}</dd></div>
          <div className="flex flex-wrap justify-between gap-2"><dt>Additional costs{reservation.fulfillment_method === 'delivery' ? ' (delivery)' : ''}</dt><dd>{money(reservation.additional_costs)}</dd></div>
          <div className="flex flex-wrap justify-between gap-2 border-t border-black/10 pt-3 font-semibold"><dt>Agreed total</dt><dd>{money(reservation.total_amount)}</dd></div>
          <div className="flex flex-wrap justify-between gap-2 pt-2"><dt>Payment record</dt><dd className="font-medium">{reservation.payment_status === 'recorded_by_seller' ? 'Manually recorded by seller' : 'Not recorded'}</dd></div>
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-black/60">These are the agreed reservation amounts, not the current listing price. No money is transferred or independently verified by Harani in this demo. Completing a handover does not record payment.</p>
      </div>

      {eligible ? (
        <div className="rounded-xl border border-dashed border-[#159600]/40 bg-[#159600]/5 p-4">
          <label className="label" htmlFor={codeId}>Harvest Pass verification code</label>
          <div className="flex flex-wrap items-center gap-2">
            <input id={codeId} className="input min-w-0 flex-1 tracking-wide" value={code} readOnly onFocus={(event) => event.target.select()} aria-describedby={`${codeId}-help`} />
            <button type="button" className="btn btn-secondary" onClick={copyCode} disabled={copying}><Copy size={16} aria-hidden="true" />{copying ? 'Copying...' : 'Copy code'}</button>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-black/60" id={`${codeId}-help`}>{reservation.status === 'completed' ? 'This code has already been used. The same handover cannot be completed twice.' : reservation.status === 'confirmed' ? 'The pass is available. Wait for the farmer to mark the reservation ready before handover.' : 'The buyer presents this code during the agreed pickup or delivery. Only the owning farmer can enter it to complete the local demo handover.'}</p>
          {copyResult && <div className="mt-3"><Notice tone={copyResult.tone}>{copyResult.text}</Notice></div>}
        </div>
      ) : <Notice>{reservation.status === 'pending' ? 'This receipt is available while the request is pending. A Harvest Pass is created when the farmer confirms your reservation.' : 'This reservation is closed. It cannot be used for handover, and any previously issued code is no longer valid.'}</Notice>}

      {(reservation.confirmed_at || reservation.ready_at || reservation.completed_at) && <dl className="grid gap-3 border-t border-black/10 pt-4 text-xs sm:grid-cols-3">
        {reservation.confirmed_at && <div><dt className="text-black/60">Confirmed</dt><dd className="mt-1">{dateTime(reservation.confirmed_at)}</dd></div>}
        {reservation.ready_at && <div><dt className="text-black/60">Marked ready</dt><dd className="mt-1">{dateTime(reservation.ready_at)}</dd></div>}
        {reservation.completed_at && <div><dt className="text-black/60">Completed</dt><dd className="mt-1">{dateTime(reservation.completed_at)}</dd></div>}
      </dl>}
      {verified && reservation.status === 'completed' && <p className="text-xs text-black/60">Code checked {dateTime(verified)} by {reservation.harvest_pass.verified_by === reservation.farmer_id ? reservation.farmer?.full_name || 'the owning farmer' : 'the recorded seller'}.</p>}
      {reservation.payment_recorded_at && <p className="text-xs text-black/60">Manual seller payment record: {dateTime(reservation.payment_recorded_at)}. Not a processor confirmation.</p>}
      {reservation.reason && <Notice><span className="font-semibold">Reservation note: </span>{reservation.reason}</Notice>}
    </section>
  );
}
