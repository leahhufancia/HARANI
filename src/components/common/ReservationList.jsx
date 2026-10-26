import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, PackageCheck, Search, Ticket } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useDemoData from '../../hooks/useDemoData';
import { completeHandover, getReservations, recordPayment, transitionReservation } from '../../services/reservationService';
import { dateTime, money, quantity } from '../../utils/format';
import { ConfirmDialog, EmptyState, Modal, Notice, PageHeader, StatStrip, StatusBadge } from './UI';
import DigitalHarvestPass from './DigitalHarvestPass';
import ProduceImage from '../marketplace/ProduceImage';

const STATUSES = ['pending', 'confirmed', 'ready', 'completed', 'rejected', 'cancelled', 'expired'];
const ACTIVE = ['pending', 'confirmed', 'ready'];
const PASS_STATUSES = ['confirmed', 'ready', 'completed'];
const ACTION_COPY = {
  confirm: { title: 'Confirm this reservation?', label: 'Confirm reservation', description: 'This accepts the agreed quantity and total, holds the produce until the reservation deadline, and creates a demo Harvest Pass. It does not record payment.' },
  reject: { title: 'Reject this request?', label: 'Reject request', description: 'This closes the request and releases its held stock. The buyer will see the reason in their reservation details.' },
  cancel: { title: 'Cancel this reservation?', label: 'Cancel reservation', description: 'This closes the reservation, invalidates its Harvest Pass, and releases held stock. The other party will be notified in the local demo.' },
  ready: { title: 'Is this harvest ready?', label: 'Mark ready', description: 'Mark this reservation ready only when the produce is prepared for the agreed pickup or delivery. The buyer will receive a demo notification.' },
  complete: { title: 'Complete this handover?', label: 'Verify code & complete', description: 'Confirm the produce has been handed over to this buyer. The entered code will be checked and the reserved quantity moved to sold. Payment is separate and will not be automatically recorded.' },
  payment: { title: 'Add a manual demo payment record?', label: 'Record manually', description: 'This records only that the seller marked payment as received in this local demo. Harani does not transfer money, contact a payment processor, or verify that payment happened.' },
};

export default function ReservationList({ role, view = 'reservations' }) {
  const { user, userRole } = useAuth();
  const data = useDemoData();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [action, setAction] = useState(null);
  const [reason, setReason] = useState('');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const isFarmer = role === 'farmer';
  const permitted = user && (userRole || user.role) === role;
  const reservations = permitted ? getReservations(data, isFarmer ? { farmerId: user.id } : { buyerId: user.id }) : [];
  const viewStatuses = view === 'sales' ? PASS_STATUSES : view === 'purchases' ? ['completed'] : STATUSES;
  const scoped = reservations.filter((reservation) => viewStatuses.includes(reservation.status));
  const visible = scoped.filter((reservation) => (filter === 'all' || filter === reservation.status)
    && `${reservation.reservation_reference} ${reservation.produce_name} ${reservation.buyer?.full_name || ''} ${reservation.farmer?.full_name || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  const selectedId = params.get('reservation');
  // A notification link opens its owned receipt even when the record has left the current tab or view.
  const selected = reservations.find((reservation) => reservation.id === selectedId);
  const actionRecord = action ? reservations.find((reservation) => reservation.id === action.id) : null;
  const completed = scoped.filter((reservation) => reservation.status === 'completed');
  const title = view === 'sales' ? 'Orders & Pickups' : view === 'purchases' ? 'My Purchases' : isFarmer ? 'Reservations' : 'My Reservations';
  const description = view === 'sales' ? 'Prepare your harvest, check the buyer\'s code, and keep handover records in one place.' : view === 'purchases' ? 'Your completed local harvests, agreed amounts, and handover receipts.' : isFarmer ? 'A nearby buyer is one step closer to your harvest. Review each request and keep them in the loop.' : 'Follow every request, from a first reservation to your next local harvest.';

  function openReservation(id) {
    const next = new URLSearchParams(params);
    next.set('reservation', id);
    setParams(next);
    setCode('');
    setCodeError('');
    setError('');
  }

  function closeReservation() {
    if (busy) return;
    const next = new URLSearchParams(params);
    next.delete('reservation');
    setParams(next, { replace: true });
    setCode('');
    setCodeError('');
    setError('');
  }

  function askAction(reservation, name) {
    setError('');
    setReason('');
    setSuccess('');
    setAction({ id: reservation.id, name, code: name === 'complete' ? code.trim() : '' });
  }

  async function performAction() {
    if (!action || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      if (action.name === 'complete') await completeHandover(action.id, user.id, action.code);
      else if (action.name === 'payment') await recordPayment(action.id, user.id);
      else await transitionReservation(action.id, user.id, action.name, reason.trim());
      setSuccess(({ confirm: 'Reservation confirmed. A demo Harvest Pass is now available.', reject: 'Request rejected. Held stock was released.', cancel: 'Reservation cancelled. Held stock was released.', ready: 'Reservation marked ready. The buyer has been notified.', complete: 'Handover completed. Payment has not been automatically recorded.', payment: 'Manual demo payment record added. No payment was processed or verified.' })[action.name]);
      setAction(null);
      setCode('');
      setCodeError('');
    } catch (error) {
      setError(error.message || 'This action could not be completed. The reservation may have changed.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function actionsFor(reservation, details = false) {
    const owns = isFarmer && reservation.farmer_id === user?.id;
    return <div className="flex flex-wrap gap-2">
      {!details && <button type="button" className="btn btn-secondary" onClick={() => openReservation(reservation.id)} aria-label={`View ${reservation.reservation_reference} receipt${PASS_STATUSES.includes(reservation.status) ? ' and pass' : ''}`}>{PASS_STATUSES.includes(reservation.status) ? 'Details / pass' : 'Details'}</button>}
      {owns && reservation.status === 'pending' && <><button type="button" className="btn btn-primary" disabled={busy} onClick={() => askAction(reservation, 'confirm')}>Confirm</button><button type="button" className="btn btn-quiet" disabled={busy} onClick={() => askAction(reservation, 'reject')}>Reject</button></>}
      {owns && reservation.status === 'confirmed' && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => askAction(reservation, 'ready')}>Mark ready</button>}
      {owns && reservation.status === 'ready' && !details && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => openReservation(reservation.id)}>Handover</button>}
      {ACTIVE.includes(reservation.status) && <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => askAction(reservation, 'cancel')}>Cancel</button>}
      {owns && details && reservation.status === 'completed' && reservation.payment_status === 'not_recorded' && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => askAction(reservation, 'payment')}>Record payment manually (demo)</button>}
    </div>;
  }

  if (!permitted) return <Notice tone="error">Use your {role} demo account to see these reservations.</Notice>;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={isFarmer ? 'Farmer workspace' : 'Buyer marketplace'} title={title} description={description} actions={<Link className="btn btn-secondary" to={isFarmer ? '/farmer/harvest' : '/marketplace'}>{isFarmer ? 'My Produce' : 'Find a harvest'}<ArrowUpRight size={16} aria-hidden="true" /></Link>} />
      <StatStrip items={view === 'purchases' ? [
        { label: 'Completed purchases', value: completed.length, detail: 'Handover recorded by the farmer' },
        { label: 'Agreed order value', value: money(completed.reduce((total, item) => total + (Number(item.total_amount) || 0), 0)), detail: 'Not a payment confirmation' },
        { label: 'Seller payment records', value: completed.filter((item) => item.payment_status === 'recorded_by_seller').length, detail: 'Manual demo records only' },
      ] : [
        { label: view === 'sales' ? 'Preparing' : 'Pending requests', value: scoped.filter((item) => item.status === (view === 'sales' ? 'confirmed' : 'pending')).length, detail: view === 'sales' ? 'Confirmed and awaiting preparation' : 'Awaiting farmer confirmation' },
        { label: 'Ready for handover', value: scoped.filter((item) => item.status === 'ready').length, detail: 'A Harvest Pass code is required' },
        { label: 'Completed', value: completed.length, detail: 'Handover recorded, payment separate' },
      ]} />
      {success && !selected && <Notice tone="success">{success}</Notice>}
      {error && !action && !selected && <Notice tone="error">{error}</Notice>}
      {selectedId && !selected && !action && <Notice tone="error">This reservation is not available to your account. <button type="button" className="underline" onClick={closeReservation}>Dismiss link</button></Notice>}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="tabs max-w-full overflow-x-auto" aria-label="Filter reservations by status">
          {['all', ...viewStatuses].map((status) => <button key={status} type="button" className={`tab ${filter === status ? 'tab-active' : ''}`} aria-pressed={filter === status} onClick={() => setFilter(status)}><span className="capitalize">{status}</span> <span className="ml-1 text-xs">{status === 'all' ? scoped.length : scoped.filter((item) => item.status === status).length}</span></button>)}
        </div>
        <div className="relative w-full sm:w-64"><label className="sr-only" htmlFor="reservation-search">Search reservations</label><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/40" aria-hidden="true" /><input id="reservation-search" type="search" className="input w-full pl-10" placeholder="Produce, person, reference" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      </div>

      {visible.length ? <div className="panel table-wrap"><table className="data-table">
        <caption className="sr-only">{title}: agreed order details, separate fulfillment and payment statuses, and available actions</caption>
        <thead><tr><th scope="col">Harvest / reference</th><th scope="col">{isFarmer ? 'Buyer' : 'Farmer'}</th><th scope="col">Agreed amount</th><th scope="col">Progress</th><th scope="col">Timing</th><th scope="col">Actions</th></tr></thead>
        <tbody>{visible.map((reservation) => <tr key={reservation.id}>
          <th scope="row"><div className="flex items-center gap-3"><ProduceImage src={reservation.image_url} alt={reservation.produce_name} className="h-12 w-12 shrink-0 rounded-lg object-cover" /><div><button type="button" className="text-left font-semibold hover:underline" onClick={() => openReservation(reservation.id)}>{reservation.produce_name}</button><p className="mt-1 text-xs font-normal text-black/60">{reservation.reservation_reference}</p></div></div></th>
          <td>{isFarmer ? reservation.buyer?.full_name || 'Buyer' : reservation.farmer?.seller_name || reservation.farmer?.full_name || 'Farmer'}<p className="mt-1 text-xs capitalize text-black/60">{reservation.fulfillment_method}</p></td>
          <td><p className="font-semibold">{money(reservation.total_amount)}</p><p className="mt-1 whitespace-nowrap text-xs text-black/60">{quantity(reservation.quantity)} {reservation.unit} at {money(reservation.price_per_unit)} / {reservation.unit}</p></td>
          <td><StatusBadge status={reservation.status} /><p className="mt-2 text-xs text-black/60">Fulfillment: {String(reservation.fulfillment_status || 'Not provided').replaceAll('_', ' ')}</p><p className="mt-1 text-xs text-black/60">Payment: {reservation.payment_status === 'recorded_by_seller' ? 'manually recorded' : 'not recorded'}</p></td>
          <td className="text-xs"><p className="text-black/60">{reservation.status === 'completed' ? 'Completed' : 'Reservation expiry'}</p><p className="mt-1">{dateTime(reservation.status === 'completed' ? reservation.completed_at : reservation.expires_at)}</p></td>
          <td>{actionsFor(reservation)}</td>
        </tr>)}</tbody>
      </table></div> : <div className="panel"><EmptyState icon={view === 'purchases' ? PackageCheck : Ticket} title={scoped.length ? 'No matching reservations' : view === 'purchases' ? 'Your harvest story is just beginning' : view === 'sales' ? 'No handovers to prepare yet' : 'A fresh connection is on its way'} description={scoped.length ? 'Choose another status or clear your search.' : view === 'purchases' ? 'Completed purchases appear here after the farmer checks your Harvest Pass.' : view === 'sales' ? 'Confirmed, ready, and completed reservations appear here.' : isFarmer ? 'Buyer requests for your produce will appear here.' : 'Reserve part of a nearby harvest to get started.'} action={scoped.length ? <button type="button" className="btn btn-secondary" onClick={() => { setFilter('all'); setQuery(''); }}>Clear filters</button> : <Link className="btn btn-secondary" to={isFarmer ? view === 'sales' ? '/farmer/reservations' : '/farmer/add-produce' : '/marketplace'}>{isFarmer ? view === 'sales' ? 'Review requests' : 'Add Produce' : 'Browse produce'}</Link>} /></div>}

      <p className="text-xs leading-relaxed text-black/60">Local demo only. Reservations hold stock until their expiry. Handover, fulfillment, and manual payment records are separate; Harani does not process or verify payments.</p>

      {selected && !action && <Modal title={`${selected.reservation_reference} / ${PASS_STATUSES.includes(selected.status) ? 'Harvest Pass' : 'Reservation receipt'}`} onClose={closeReservation} wide>
        <div className="space-y-5">
          {!viewStatuses.includes(selected.status) && <Notice>This linked reservation is now {selected.status}. It is shown here even though it is outside this page's current view.</Notice>}
          {success && <Notice tone="success">{success}</Notice>}
          {error && <Notice tone="error">{error}</Notice>}
          <DigitalHarvestPass key={selected.id} reservation={selected} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4"><Link className="btn btn-quiet" to={`/marketplace/${selected.listing_id}`}>View produce<ArrowUpRight size={16} aria-hidden="true" /></Link>{actionsFor(selected, true)}</div>
          {isFarmer && selected.farmer_id === user.id && selected.status === 'ready' && <form className="space-y-3 rounded-xl border border-black/15 p-4" onSubmit={(event) => { event.preventDefault(); if (!code.trim()) { setCodeError('Enter the code the buyer presents before continuing.'); return; } setCodeError(''); askAction(selected, 'complete'); }}>
            <h3 className="font-semibold">Complete the local demo handover</h3>
            <p className="text-sm text-black/60">Ask the buyer for their Harvest Pass code. Enter it yourself after handing over this produce. Only this farmer account can complete it.</p>
            <label htmlFor="handover-code" className="label">Code presented by the buyer</label>
            <input id="handover-code" className="input w-full uppercase tracking-wide" type="text" value={code} onChange={(event) => { setCode(event.target.value); setCodeError(''); }} placeholder="HP-..." autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={100} aria-invalid={Boolean(codeError)} aria-describedby={codeError ? 'handover-code-error' : undefined} />
            {codeError && <p id="handover-code-error" className="field-error">{codeError}</p>}
            <button type="submit" className="btn btn-primary" disabled={busy}>Review handover</button>
          </form>}
        </div>
      </Modal>}

      {action && <ConfirmDialog title={ACTION_COPY[action.name].title} confirmLabel={ACTION_COPY[action.name].label} busy={busy} onConfirm={performAction} onClose={() => { if (!busy) { setAction(null); setError(''); } }} description={<div className="space-y-4">
        <p>{ACTION_COPY[action.name].description}</p>
        {actionRecord && <div className="rounded-lg border border-black/10 bg-black/[0.02] p-3 text-sm"><p className="font-semibold">{actionRecord.reservation_reference} / {actionRecord.produce_name}</p><p className="mt-1">{quantity(actionRecord.quantity)} {actionRecord.unit} / {money(actionRecord.total_amount)} agreed total</p><p className="mt-1 text-black/60">Current status: {actionRecord.status}</p></div>}
        {['reject', 'cancel'].includes(action.name) && <div><label className="label" htmlFor="reservation-reason">Reason (optional)</label><textarea className="input w-full" id="reservation-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={3} disabled={busy} placeholder="Let the other person know what changed." /></div>}
        {action.name === 'complete' && <p className="text-sm">Code entered: <span className="break-all tracking-wide">{action.code}</span></p>}
        {error && <Notice tone="error">{error}</Notice>}
      </div>} />}
    </div>
  );
}
