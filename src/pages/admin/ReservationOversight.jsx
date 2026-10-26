import { useState } from 'react';
import { ArrowUpRight, ReceiptText, Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, Modal, Notice, PageHeader, StatStrip, StatusBadge } from '../../components/common/UI';
import useDemoData from '../../hooks/useDemoData';
import { getReservations } from '../../services/reservationService';
import { dateTime, money, quantity } from '../../utils/format';

export default function ReservationOversight() {
  const data = useDemoData();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [status, setStatus] = useState('all');
  const [payment, setPayment] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const reservations = getReservations(data);
  const completed = reservations.filter((reservation) => reservation.status === 'completed');
  const query = search.trim().toLowerCase();
  const filtered = reservations.filter((reservation) => (
    (status === 'all' || reservation.status === status)
    && (payment === 'all' || reservation.payment_status === payment)
    && [reservation.id, reservation.reservation_reference, reservation.produce_name, reservation.buyer?.full_name, reservation.buyer?.email, reservation.farmer?.full_name, reservation.farmer?.seller_name].some((value) => String(value || '').toLowerCase().includes(query))
  )).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const selected = reservations.find((reservation) => reservation.id === selectedId);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administration" title="Every reservation, in view." description="Read-only oversight of reservations, handovers and separate seller payment records." />
      <StatStrip items={[
        { label: 'All reservations', value: reservations.length, detail: 'Across all demo accounts' },
        { label: 'Open reservations', value: reservations.filter((reservation) => ['pending', 'confirmed', 'ready'].includes(reservation.status)).length, detail: 'Pending, confirmed or ready' },
        { label: 'Completed handovers', value: completed.length, detail: 'Not a payment confirmation' },
        { label: 'Completed value', value: money(completed.reduce((total, reservation) => total + reservation.total_amount, 0)), detail: 'Includes recorded additional costs' },
      ]} />
      <Notice>Administrators inspect records only; farmers manage the handover workflow. A seller's payment record is a manual demo entry, not a processor receipt or verified money transfer.</Notice>

      <section className="panel" aria-label="Reservation and transaction records">
        <div className="grid gap-3 border-b border-black/10 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_1fr_1fr]">
          <div><label className="label" htmlFor="admin-reservation-search">Search reservations</label><div className="relative"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/40" aria-hidden="true" /><input id="admin-reservation-search" type="search" className="input pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Reference, produce, buyer or seller" /></div></div>
          <div><label className="label" htmlFor="admin-reservation-status">Reservation status</label><select id="admin-reservation-status" className="input" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{['pending', 'confirmed', 'ready', 'completed', 'rejected', 'cancelled', 'expired'].map((value) => <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>)}</select></div>
          <div><label className="label" htmlFor="admin-payment-status">Payment record</label><select id="admin-payment-status" className="input" value={payment} onChange={(event) => setPayment(event.target.value)}><option value="all">All payment records</option><option value="not_recorded">Not recorded</option><option value="recorded_by_seller">Recorded by seller</option></select></div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-black/60"><p aria-live="polite">{filtered.length} of {reservations.length} reservations</p>{(search || status !== 'all' || payment !== 'all') && <button type="button" className="btn btn-quiet" onClick={() => { setSearch(''); setStatus('all'); setPayment('all'); }}>Clear filters</button>}</div>
        {filtered.length ? <div className="table-wrap" role="region" aria-label="Reservations, scroll horizontally for all columns" tabIndex={0}>
          <table className="data-table min-w-[1000px]">
            <caption className="sr-only">Read-only demo reservations matching the search and status filters</caption>
            <thead><tr><th scope="col">Reservation</th><th scope="col">Produce</th><th scope="col">Buyer / seller</th><th scope="col">Status</th><th scope="col">Payment record</th><th scope="col">Total</th><th scope="col">Action</th></tr></thead>
            <tbody>{filtered.map((reservation) => <tr key={reservation.id}>
              <td><p className="font-semibold">{reservation.reservation_reference}</p><p className="mt-1 whitespace-nowrap text-xs text-black/60">{dateTime(reservation.created_at)}</p></td>
              <td><p>{reservation.produce_name}</p><p className="mt-1 text-xs text-black/60">{quantity(reservation.quantity)} {reservation.unit} / {reservation.fulfillment_method}</p></td>
              <td><p>{reservation.buyer?.full_name || 'Buyer unavailable'}</p><p className="mt-1 text-xs text-black/60">Seller: {reservation.farmer?.seller_name || reservation.farmer?.full_name || 'Unavailable'}</p></td>
              <td><StatusBadge status={reservation.status} /></td>
              <td><p className="text-xs">{reservation.payment_status === 'recorded_by_seller' ? 'Recorded by seller' : 'Not recorded'}</p><p className="mt-1 text-xs text-black/60">Not payment verification</p></td>
              <td className="whitespace-nowrap font-semibold">{money(reservation.total_amount)}</td>
              <td><button type="button" className="btn btn-quiet" onClick={() => setSelectedId(reservation.id)} aria-label={`Inspect reservation ${reservation.reservation_reference}`}>Inspect receipt</button></td>
            </tr>)}</tbody>
          </table>
        </div> : <EmptyState icon={ReceiptText} title="No reservations found" description="Try another search or clear the filters to inspect the shared demo records." />}
      </section>

      {selectedId && <Modal title="Reservation receipt / demo record" onClose={() => setSelectedId(null)} wide>
        {selected ? <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="break-all text-lg font-semibold">{selected.reservation_reference}</h3><p className="mt-1 break-all text-xs text-black/60">Record ID: {selected.id}</p></div><StatusBadge status={selected.status} /></div>
          <Notice>This receipt describes a local demo reservation. It is not a tax invoice, proof of payment or real-world verification.</Notice>

          <div className="grid gap-5 border-b border-black/10 pb-5 sm:grid-cols-2">
            <section aria-labelledby="receipt-buyer-heading"><h4 id="receipt-buyer-heading" className="text-xs font-semibold uppercase tracking-wider text-black/60">Buyer</h4><p className="mt-2 text-sm font-semibold">{selected.buyer?.full_name || 'Buyer unavailable'}</p><p className="mt-1 break-words text-sm text-black/65">{selected.buyer?.business_name || selected.buyer?.buyer_type || 'No business details'}</p><p className="mt-1 break-all text-xs text-black/60">{selected.buyer?.email || 'Email not provided'}</p><p className="mt-1 text-xs text-black/60">{selected.buyer?.phone || 'Phone not provided'}</p><p className="mt-2 break-all text-xs text-black/60">{selected.buyer_id}</p></section>
            <section aria-labelledby="receipt-seller-heading"><h4 id="receipt-seller-heading" className="text-xs font-semibold uppercase tracking-wider text-black/60">Seller</h4><p className="mt-2 text-sm font-semibold">{selected.farmer?.seller_name || selected.farmer?.full_name || 'Seller unavailable'}</p><p className="mt-1 text-sm text-black/65">{selected.farmer?.full_name}</p><p className="mt-1 break-all text-xs text-black/60">{selected.farmer?.email || 'Email not provided'}</p><p className="mt-1 text-xs text-black/60">{selected.farmer?.phone || 'Phone not provided'}</p><p className="mt-2 break-all text-xs text-black/60">{selected.farmer_id}</p></section>
          </div>

          <section aria-labelledby="receipt-items-heading">
            <div className="flex flex-wrap items-center justify-between gap-2"><h4 id="receipt-items-heading" className="text-sm font-semibold">{selected.produce_name}</h4><Link className="btn btn-quiet" to={`/marketplace/${selected.listing_id}`}>Inspect listing <ArrowUpRight size={14} aria-hidden="true" /></Link></div>
            <p className="mt-1 text-xs text-black/60">{quantity(selected.quantity)} {selected.unit} at {money(selected.price_per_unit)} / {selected.unit}. Values are the reservation snapshot.</p>
            <dl className="mt-3 divide-y divide-black/10 text-sm"><div className="flex justify-between gap-4 py-2"><dt>Produce subtotal</dt><dd>{money(selected.subtotal)}</dd></div><div className="flex justify-between gap-4 py-2"><dt>Additional costs</dt><dd>{money(selected.additional_costs)}</dd></div><div className="flex justify-between gap-4 py-3 font-semibold"><dt>Total reservation value</dt><dd>{money(selected.total_amount)}</dd></div></dl>
          </section>

          <section className="border-t border-black/10 pt-5" aria-labelledby="receipt-fulfillment-heading">
            <h4 id="receipt-fulfillment-heading" className="text-sm font-semibold">Fulfillment and handover</h4>
            <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs text-black/55">Method</dt><dd className="mt-1 capitalize">{selected.fulfillment_method}</dd></div><div><dt className="text-xs text-black/55">Fulfillment status</dt><dd className="mt-1 capitalize">{selected.fulfillment_status?.replaceAll('_', ' ') || 'Not recorded'}</dd></div><div className="sm:col-span-2"><dt className="text-xs text-black/55">Listing pickup location</dt><dd className="mt-1 break-words">{selected.pickup_location || 'Not provided'}</dd></div><div className="sm:col-span-2"><dt className="text-xs text-black/55">Fulfillment notes</dt><dd className="mt-1 whitespace-pre-wrap break-words">{selected.fulfillment_notes || 'No additional instructions.'}</dd></div></dl>
            {selected.reason && <div className="mt-4 border-l-2 border-[#D0BE00] pl-3 text-sm"><p className="text-xs text-black/55">Recorded status reason</p><p className="mt-1 whitespace-pre-wrap break-words">{selected.reason}</p></div>}
            <dl className="mt-4 grid gap-4 border-t border-black/10 pt-4 text-sm sm:grid-cols-2">{[
              ['Created', selected.created_at], ['Hold expires / expired', selected.expires_at], ['Confirmed', selected.confirmed_at],
              ['Ready', selected.ready_at], ['Completed handover', selected.completed_at],
            ].map(([label, value]) => <div key={label}><dt className="text-xs text-black/55">{label}</dt><dd className="mt-1">{value ? dateTime(value) : 'Not recorded'}</dd></div>)}</dl>
            {selected.harvest_pass ? <div className="mt-4 bg-black/[0.03] p-3 text-sm"><p className="text-xs text-black/55">Local Digital Harvest Pass code</p><p className="mt-1 break-all font-semibold">{selected.harvest_pass.verification_code}</p><p className="mt-2 text-xs text-black/60">{selected.harvest_pass.verified_at ? `Demo handover code used: ${dateTime(selected.harvest_pass.verified_at)}` : ['cancelled', 'rejected', 'expired'].includes(selected.status) ? `Code inactive: this reservation is ${selected.status}.` : 'Demo handover code not yet used.'} This does not verify identity or payment.</p></div> : <p className="mt-4 text-xs text-black/60">No Digital Harvest Pass has been issued for this record.</p>}
          </section>

          <section className="border-t border-black/10 pt-5" aria-labelledby="receipt-payment-heading">
            <h4 id="receipt-payment-heading" className="text-sm font-semibold">Payment record / separate from handover</h4>
            <div className="mt-3"><StatusBadge status={selected.payment_status} /></div>
            <p className="mt-2 text-sm text-black/65">{selected.payment_status === 'recorded_by_seller' ? 'The seller manually marked payment as recorded in this demo. Harani did not process or verify a money transfer.' : 'No payment has been recorded. A completed handover does not automatically confirm payment.'}</p>
            {selected.payment_recorded_at && <p className="mt-2 text-xs text-black/60">Seller record time: {dateTime(selected.payment_recorded_at)}</p>}
          </section>
          <div className="flex justify-end border-t border-black/10 pt-4"><button type="button" className="btn btn-secondary" onClick={() => setSelectedId(null)}>Close receipt</button></div>
        </div> : <Notice>This reservation is no longer present in the local demo. Close the dialog to return to the records.</Notice>}
      </Modal>}
    </div>
  );
}
