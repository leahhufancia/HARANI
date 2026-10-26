import { useState } from 'react';
import { ArrowUpRight, BarChart3, PackageCheck, ReceiptText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState, Notice, PageHeader, StatStrip, StatusBadge } from '../../components/common/UI';
import useDemoData from '../../hooks/useDemoData';
import { getReservations } from '../../services/reservationService';
import { dateTime, money, quantity } from '../../utils/format';

export default function ActivityReports() {
  const data = useDemoData();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const reservations = getReservations(data);
  const invalidRange = Boolean(from && to && from > to);
  const rangeStart = from ? new Date(`${from}T00:00:00`).getTime() : -Infinity;
  const rangeEnd = to ? new Date(`${to}T23:59:59.999`).getTime() : Infinity;

  function inRange(value) {
    if (!value || invalidRange) return false;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) && timestamp >= rangeStart && timestamp <= rangeEnd;
  }

  const profiles = data.profiles.filter((profile) => inRange(profile.created_at));
  const listings = data.listings.filter((listing) => inRange(listing.created_at));
  const createdReservations = reservations.filter((reservation) => inRange(reservation.created_at));
  // Completion totals follow handover time, not the reservation's creation date.
  const completed = reservations.filter((reservation) => reservation.status === 'completed' && inRange(reservation.completed_at))
    .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));
  const statusCounts = ['pending', 'confirmed', 'ready', 'completed', 'rejected', 'cancelled', 'expired'].map((status) => ({
    status,
    count: createdReservations.filter((reservation) => reservation.status === status).length,
  }));
  const totalsByUnit = new Map();
  for (const reservation of completed) {
    const total = totalsByUnit.get(reservation.unit) || { unit: reservation.unit, count: 0, quantity: 0, value: 0 };
    total.count += 1;
    total.quantity += reservation.quantity;
    total.value += reservation.total_amount;
    totalsByUnit.set(reservation.unit, total);
  }
  const unitTotals = [...totalsByUnit.values()].sort((a, b) => a.unit.localeCompare(b.unit));
  const hasActivity = profiles.length || listings.length || createdReservations.length || completed.length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Activity, without the guesswork."
        description="Counts and totals calculated from the shared local demo records."
        actions={<Link to="/admin/transactions" className="btn btn-secondary">Inspect transactions <ArrowUpRight size={16} aria-hidden="true" /></Link>}
      />

      <section className="panel p-4 sm:p-5" aria-labelledby="report-period-heading">
        <h2 id="report-period-heading" className="text-sm font-semibold">Reporting period</h2>
        <div className="mt-3 grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div><label className="label" htmlFor="report-from">From date <span className="text-black/60">(inclusive)</span></label><input id="report-from" type="date" className="input" value={from} onChange={(event) => setFrom(event.target.value)} aria-invalid={invalidRange} aria-describedby={invalidRange ? 'report-date-error' : 'report-date-help'} /></div>
          <div><label className="label" htmlFor="report-to">To date <span className="text-black/60">(inclusive)</span></label><input id="report-to" type="date" className="input" value={to} onChange={(event) => setTo(event.target.value)} aria-invalid={invalidRange} aria-describedby={invalidRange ? 'report-date-error' : 'report-date-help'} /></div>
          <button type="button" className="btn btn-secondary" disabled={!from && !to} onClick={() => { setFrom(''); setTo(''); }}>All time</button>
        </div>
        <p id="report-date-help" className="mt-3 text-xs leading-relaxed text-black/60">Blank dates include all time. Dates use this browser's local time. New accounts, listings and reservations use creation time; completed value and quantities use the handover completion time, even if the reservation was created earlier.</p>
        {invalidRange && <p id="report-date-error" className="field-error mt-3" role="alert">The from date must be on or before the to date. Totals are hidden until the range is valid.</p>}
      </section>

      <Notice>Completed transaction value includes additional costs. It is not verified paid revenue. Payment is a separate, manually recorded demo status, and quantities are never added across different units.</Notice>

      {!invalidRange && <>
        <div aria-live="polite"><StatStrip items={[
          { label: 'Accounts created', value: profiles.length, detail: `${profiles.filter((profile) => profile.role === 'farmer').length} farmers / ${profiles.filter((profile) => profile.role === 'buyer').length} buyers` },
          { label: 'Listings created', value: listings.length, detail: 'All current listing statuses' },
          { label: 'Reservations created', value: createdReservations.length, detail: 'All current reservation statuses' },
          { label: 'Completed value', value: money(completed.reduce((total, reservation) => total + reservation.total_amount, 0)), detail: `${completed.length} handovers completed in this period` },
        ]} /></div>

        {hasActivity ? <>
          <div className="grid gap-5 xl:grid-cols-2">
            <section className="panel p-4 sm:p-5" aria-labelledby="report-status-heading">
              <h2 id="report-status-heading" className="text-base font-semibold">Reservation status breakdown</h2>
              <p className="mt-1 text-xs leading-relaxed text-black/60">Current status of reservations created in this period, not a historical status snapshot.</p>
              {createdReservations.length ? <ul className="mt-5 space-y-4">{statusCounts.map(({ status, count }) => {
                const percentage = Math.round((count / createdReservations.length) * 100);
                return <li key={status}><div className="mb-2 flex items-center justify-between gap-3 text-xs"><StatusBadge status={status} /><span className="tabular-nums text-black/65">{count} / {percentage}%</span></div><div className="h-1.5 overflow-hidden rounded-sm bg-black/[0.06]" aria-hidden="true"><div className={`h-full ${status === 'completed' ? 'bg-[#159600]' : ['pending', 'ready'].includes(status) ? 'bg-[#D0BE00]' : 'bg-black/35'}`} style={{ width: `${(count / createdReservations.length) * 100}%` }} /></div></li>;
              })}</ul> : <EmptyState icon={BarChart3} title="No reservations created in this period" description="Handovers from older reservations can still appear in the completed totals." />}
            </section>

            <section className="panel" aria-labelledby="report-quantity-heading">
              <div className="border-b border-black/10 p-4 sm:p-5"><h2 id="report-quantity-heading" className="text-base font-semibold">Completed quantities by unit</h2><p className="mt-1 text-xs leading-relaxed text-black/60">One row per unit. No combined quantity for unlike units.</p></div>
              {unitTotals.length ? <div className="table-wrap" role="region" aria-label="Completed quantities by unit" tabIndex={0}>
                <table className="data-table min-w-[420px]"><caption className="sr-only">Completed handover quantity, count and transaction value grouped by unit in the selected period</caption><thead><tr><th scope="col">Unit</th><th scope="col">Quantity</th><th scope="col">Handovers</th><th scope="col">Value</th></tr></thead><tbody>{unitTotals.map((total) => <tr key={total.unit}><th scope="row" className="font-semibold">{total.unit}</th><td>{quantity(total.quantity)} {total.unit}</td><td>{total.count}</td><td className="whitespace-nowrap">{money(total.value)}</td></tr>)}</tbody></table>
              </div> : <EmptyState icon={PackageCheck} title="No completed handovers" description="Quantities appear only after a handover is completed in the selected period." />}
            </section>
          </div>

          <section className="panel" aria-labelledby="report-completed-heading">
            <div className="border-b border-black/10 p-4 sm:p-5"><h2 id="report-completed-heading" className="text-base font-semibold">Completed in this period</h2><p className="mt-1 text-xs text-black/60">Inspect the records behind the totals. Completion and payment are separate.</p></div>
            {completed.length ? <div className="table-wrap" role="region" aria-label="Completed handovers in the reporting period" tabIndex={0}>
              <table className="data-table min-w-[800px]"><caption className="sr-only">Reservations completed in the selected period, newest completion first</caption><thead><tr><th scope="col">Reference</th><th scope="col">Completed</th><th scope="col">Produce / quantity</th><th scope="col">Value</th><th scope="col">Payment record</th><th scope="col">Action</th></tr></thead><tbody>{completed.map((reservation) => <tr key={reservation.id}><td className="font-semibold">{reservation.reservation_reference}</td><td className="whitespace-nowrap">{dateTime(reservation.completed_at)}</td><td>{reservation.produce_name}<p className="mt-1 text-xs text-black/60">{quantity(reservation.quantity)} {reservation.unit}</p></td><td className="whitespace-nowrap">{money(reservation.total_amount)}</td><td className="text-xs">{reservation.payment_status === 'recorded_by_seller' ? 'Recorded by seller / unverified' : 'Not recorded'}</td><td><Link className="btn btn-quiet" to={`/admin/transactions?search=${encodeURIComponent(reservation.id)}`} aria-label={`Inspect completed reservation ${reservation.reservation_reference}`}>Inspect <ArrowUpRight size={14} aria-hidden="true" /></Link></td></tr>)}</tbody></table>
            </div> : <EmptyState icon={ReceiptText} title="No completion records in this period" description="Open reservations are not included in completed transaction value." />}
          </section>
        </> : <div className="panel"><EmptyState icon={BarChart3} title="No activity in this date range" description="Change or clear the date filters to include local demo records." /></div>}
      </>}
    </div>
  );
}
