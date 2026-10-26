import { useState } from 'react';
import { ArrowUpRight, EyeOff, RotateCcw, Search, Sprout } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, Modal, Notice, PageHeader, StatStrip, StatusBadge } from '../../components/common/UI';
import { useAuth } from '../../context/AuthContext';
import useDemoData from '../../hooks/useDemoData';
import { moderateListing } from '../../services/adminService';
import { getListings } from '../../services/produceService';
import { dateTime, money, quantity, urgencyLabel } from '../../utils/format';

export default function ListingOversight() {
  const data = useDemoData();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [status, setStatus] = useState('all');
  const [urgency, setUrgency] = useState('all');
  const [change, setChange] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const listings = getListings(data);
  const rawListings = new Map(data.listings.map((listing) => [listing.id, listing]));
  const query = search.trim().toLowerCase();
  const filtered = listings.filter((listing) => (
    (status === 'all' || listing.status === status)
    && (urgency === 'all' || listing.urgency === urgency)
    && [listing.id, listing.produce_name, listing.category, listing.pickup_location, listing.farmer?.full_name, listing.farmer?.seller_name].some((value) => String(value || '').toLowerCase().includes(query))
  )).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const selected = listings.find((listing) => listing.id === change?.id);
  const selectedBase = rawListings.get(change?.id);
  const eligible = selected && selectedBase?.status === (change?.hidden ? 'active' : 'moderated');
  const affectedReservations = data.reservations.filter((reservation) => reservation.listing_id === change?.id && ['pending', 'confirmed', 'ready'].includes(reservation.status)).length;

  function beginModeration(listing, hidden) {
    setChange({ id: listing.id, hidden });
    setReason('');
    setReasonError('');
    setError('');
    setSuccess('');
  }

  async function confirmModeration(event) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (reason.trim().length < 3 || reason.trim().length > 500) {
      setReasonError('Enter a moderation reason of 3 to 500 characters.');
      return;
    }
    if (!user || !eligible) {
      setError('This listing is no longer eligible for this action. Close the dialog and check its current status.');
      return;
    }
    setReasonError('');
    setBusy(true);
    try {
      await moderateListing(selected.id, user.id, change.hidden, reason.trim());
      setSuccess(change.hidden
        ? `${selected.produce_name} is hidden from the demo marketplace. Open reservations were cancelled, affected accounts notified and reserved stock released.`
        : `Moderation was removed from ${selected.produce_name}. Stock, deadline and seller status still determine its availability. Cancelled reservations were not restored.`);
      setChange(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The moderation action could not be saved. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administration" title="Keep an eye on every harvest." description="Inspect produce, track availability and moderate local demo listings." />
      <StatStrip items={[
        { label: 'All listings', value: listings.length, detail: 'Including historical and hidden listings' },
        { label: 'Available', value: listings.filter((listing) => listing.status === 'active' && listing.farmer?.status === 'active').length, detail: 'Active stock from active sellers' },
        { label: 'Moderated', value: data.listings.filter((listing) => listing.status === 'moderated').length, detail: 'Hidden by an administrator' },
        { label: 'Expired', value: listings.filter((listing) => listing.status === 'expired').length, detail: 'Past their selling deadline' },
      ]} />
      <Notice>Moderation changes the client-local demo only. Hiding a listing also cancels its open reservations, sends demo notifications and releases reserved stock.</Notice>
      {success && <Notice tone="success">{success}</Notice>}

      <section className="panel" aria-label="Listing oversight">
        <div className="grid gap-3 border-b border-black/10 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_1fr_1fr]">
          <div><label className="label" htmlFor="admin-listing-search">Search listings</label><div className="relative"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/40" aria-hidden="true" /><input id="admin-listing-search" className="input pl-9" type="search" placeholder="Produce, seller, location or listing ID" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
          <div><label className="label" htmlFor="admin-listing-status">Listing status</label><select id="admin-listing-status" className="input" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{['active', 'reserved', 'sold', 'expired', 'withdrawn', 'moderated'].map((value) => <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>)}</select></div>
          <div><label className="label" htmlFor="admin-listing-urgency">Selling urgency</label><select id="admin-listing-urgency" className="input" value={urgency} onChange={(event) => setUrgency(event.target.value)}><option value="all">All urgency levels</option>{['sell-now', 'sell-today', 'planned'].map((value) => <option key={value} value={value}>{urgencyLabel(value)}</option>)}</select></div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-black/60"><p aria-live="polite">{filtered.length} of {listings.length} listings</p>{(search || status !== 'all' || urgency !== 'all') && <button type="button" className="btn btn-quiet" onClick={() => { setSearch(''); setStatus('all'); setUrgency('all'); }}>Clear filters</button>}</div>
        {filtered.length ? <div className="table-wrap" role="region" aria-label="Produce listings, scroll horizontally for all columns" tabIndex={0}>
          <table className="data-table min-w-[980px]">
            <caption className="sr-only">Demo listings matching the search, status and urgency filters</caption>
            <thead><tr><th scope="col">Produce</th><th scope="col">Seller</th><th scope="col">Available / listed</th><th scope="col">Unit price</th><th scope="col">Deadline</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
            <tbody>{filtered.map((listing) => {
              const baseStatus = rawListings.get(listing.id)?.status;
              return <tr key={listing.id}>
                <td><p className="font-semibold">{listing.produce_name}</p><p className="mt-1 text-xs text-black/60">{listing.category} / {urgencyLabel(listing.urgency)}</p></td>
                <td><p>{listing.farmer?.seller_name || listing.farmer?.full_name || 'Seller unavailable'}</p>{listing.farmer?.status === 'suspended' && <p className="mt-1 text-xs font-medium text-black/60">Suspended / hidden from public</p>}</td>
                <td className="whitespace-nowrap">{quantity(listing.available_quantity)} / {quantity(listing.listed_quantity)} {listing.unit}<p className="mt-1 text-xs text-black/55">{quantity(listing.reserved_quantity)} reserved / {quantity(listing.sold_quantity)} sold</p></td>
                <td className="whitespace-nowrap">{money(listing.price_per_unit)} / {listing.unit}</td>
                <td className="whitespace-nowrap">{dateTime(listing.selling_deadline)}</td>
                <td><StatusBadge status={listing.status} /></td>
                <td><div className="flex items-center gap-1"><Link className="btn btn-quiet" to={`/marketplace/${listing.id}`} aria-label={`Inspect ${listing.produce_name}`}>Inspect <ArrowUpRight size={14} aria-hidden="true" /></Link>{baseStatus === 'moderated' ? <button type="button" className="btn btn-quiet" onClick={() => beginModeration(listing, false)} aria-label={`Restore ${listing.produce_name}`}><RotateCcw size={14} aria-hidden="true" /> Restore</button> : baseStatus === 'active' ? <button type="button" className="btn btn-quiet" onClick={() => beginModeration(listing, true)} aria-label={`Hide ${listing.produce_name}`}><EyeOff size={14} aria-hidden="true" /> Hide</button> : <span className="px-2 text-xs text-black/60">Farmer withdrawn</span>}</div></td>
              </tr>;
            })}</tbody>
          </table>
        </div> : <EmptyState icon={Sprout} title="No listings found" description="Try another search or clear the filters to inspect the shared demo listings." />}
      </section>

      {change && <Modal title={change.hidden ? 'Confirm listing removal from public view' : 'Confirm listing restoration'} onClose={() => { if (!busy) setChange(null); }}>
        <form onSubmit={confirmModeration} className="space-y-4" aria-busy={busy}>
          <div><h3 className="font-semibold">{selected?.produce_name || 'Listing unavailable'}</h3><p className="mt-1 text-sm text-black/60">{selected?.farmer?.seller_name || selected?.farmer?.full_name}</p></div>
          <Notice>{change.hidden
            ? `Hide this listing from the public demo marketplace? Its ${affectedReservations} open reservations will be cancelled, affected accounts notified and reserved stock released. Restoring the listing later will not restore those reservations.`
            : 'Restoring removes the moderation flag and sets the listing back to active. Its deadline and stock can still make it expired or sold; a suspended seller remains hidden. Previously cancelled reservations are not restored.'}</Notice>
          {selected && <p className="text-xs text-black/60">Currently {quantity(selected.available_quantity)} {selected.unit} available. Selling deadline: {dateTime(selected.selling_deadline)}.</p>}
          {!eligible && <Notice tone="error">This listing has changed and is no longer eligible for this action. Close the dialog and inspect its current status.</Notice>}
          {error && <Notice tone="error">{error}</Notice>}
          <div><label className="label" htmlFor="listing-moderation-reason">{change.hidden ? 'Moderation reason' : 'Restoration reason'} <span className="text-black/60">(required)</span></label><textarea id="listing-moderation-reason" className="input min-h-24" rows={3} value={reason} onChange={(event) => { setReason(event.target.value); setReasonError(''); }} required minLength={3} maxLength={500} disabled={busy} aria-invalid={Boolean(reasonError)} aria-describedby={reasonError ? 'listing-reason-error' : 'listing-reason-help'} /><p id="listing-reason-help" className="mt-1 text-xs text-black/55">Use 3 to 500 characters. The reason is saved in the local demo audit record.</p>{reasonError && <p id="listing-reason-error" className="field-error" role="alert">{reasonError}</p>}</div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-black/10 pt-4"><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setChange(null)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={busy || !eligible}>{busy ? 'Saving moderation...' : change.hidden ? 'Confirm hide & cancel' : 'Confirm restoration'}</button></div>
        </form>
      </Modal>}
    </div>
  );
}
