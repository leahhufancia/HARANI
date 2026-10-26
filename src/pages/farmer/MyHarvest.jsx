import { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Plus, Search, Sprout } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useDemoData from '../../hooks/useDemoData';
import { getListings, withdrawListing } from '../../services/produceService';
import { dateTime, money, quantity, urgencyLabel } from '../../utils/format';
import { ConfirmDialog, EmptyState, Notice, PageHeader, StatusBadge } from '../../components/common/UI';
import ProduceImage from '../../components/marketplace/ProduceImage';

const FILTERS = ['all', 'active', 'reserved', 'sold', 'expired', 'withdrawn', 'moderated'];

export default function MyHarvest() {
  const { user } = useAuth();
  const data = useDemoData();
  const location = useLocation();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [withdrawing, setWithdrawing] = useState(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(location.state?.notice || '');
  const listings = getListings(data).filter((listing) => listing.farmer_id === user?.id);
  const visible = listings.filter((listing) => (filter === 'all' || listing.status === filter)
    && `${listing.produce_name} ${listing.category} ${listing.pickup_location}`.toLowerCase().includes(query.trim().toLowerCase()));
  const selected = listings.find((listing) => listing.id === withdrawing);

  async function handleWithdraw() {
    if (!selected || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await withdrawListing(selected.id, user.id);
      setSuccess(`${selected.produce_name} was withdrawn from the local marketplace. You can relist its unsold quantity later.`);
      setWithdrawing(null);
    } catch (error) {
      setError(error.message || 'The listing could not be withdrawn. Try again.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Farmer workspace" title="My Produce" description="Make every harvest count. Keep your stock, selling windows, and reservations in view."
        actions={<Link className="btn btn-primary" to="/farmer/add-produce"><Plus size={18} aria-hidden="true" /> Post Produce</Link>} />
      {success && <Notice tone="success">{success}</Notice>}
      {error && !selected && <Notice tone="error">{error}</Notice>}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="tabs max-w-full overflow-x-auto" aria-label="Filter harvest by status">
          {FILTERS.map((status) => (
            <button type="button" className={`tab ${filter === status ? 'tab-active' : ''}`} aria-pressed={filter === status} onClick={() => setFilter(status)} key={status}>
              <span className="capitalize">{status}</span> <span className="ml-1 text-xs">{status === 'all' ? listings.length : listings.filter((listing) => listing.status === status).length}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <label className="sr-only" htmlFor="harvest-search">Search your harvest</label>
          <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/40" aria-hidden="true" />
          <input id="harvest-search" className="input w-full pl-10" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your harvest" />
        </div>
      </div>
      <p className="text-xs text-black/60">Reserved means fully held. Partially reserved listings stay Active; held and sold quantities are shown separately.</p>
      {visible.length ? (
        <div className="panel table-wrap">
          <table className="data-table">
            <caption className="sr-only">Your produce listings with availability, prices, deadlines, and actions</caption>
            <thead><tr><th scope="col">Produce</th><th scope="col">Inventory</th><th scope="col">Price</th><th scope="col">Selling window</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
            <tbody>
              {visible.map((listing) => {
                const editable = ['active', 'reserved'].includes(listing.status);
                const canWithdraw = editable && listing.reserved_quantity === 0;
                const canRelist = ['expired', 'withdrawn'].includes(listing.status) && listing.available_quantity > 0 && listing.reserved_quantity === 0;
                return (
                  <tr key={listing.id}>
                    <th scope="row">
                      <div className="flex items-center gap-3">
                        <ProduceImage src={listing.image_url} alt={listing.produce_name} className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                        <div><Link className="font-semibold hover:underline" to={`/marketplace/${listing.id}`}>{listing.produce_name}</Link><p className="mt-1 text-xs font-normal text-black/60">{listing.category}</p></div>
                      </div>
                    </th>
                    <td><p className="font-medium">{quantity(listing.available_quantity)} {listing.unit} {editable ? 'available' : 'unsold'}</p><p className="mt-1 text-xs text-black/60">{quantity(listing.reserved_quantity)} held / {quantity(listing.sold_quantity)} sold</p></td>
                    <td className="whitespace-nowrap">{money(listing.price_per_unit)}<span className="text-xs text-black/60"> / {listing.unit}</span></td>
                    <td><p>{urgencyLabel(listing.urgency)}</p><p className="mt-1 text-xs text-black/60">{dateTime(listing.selling_deadline)}</p></td>
                    <td><StatusBadge status={listing.status} /></td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        <Link className="btn btn-quiet" to={`/marketplace/${listing.id}`} aria-label={`View ${listing.produce_name}`}>View Produce</Link>
                        {editable && <Link className="btn btn-quiet" to={`/farmer/harvest/${listing.id}/edit`} aria-label={`Edit ${listing.produce_name}`}>Edit</Link>}
                        {editable && <button className="btn btn-quiet" type="button" disabled={!canWithdraw || busy} title={!canWithdraw ? 'Resolve open reservations before withdrawing.' : undefined} onClick={() => { setError(''); setWithdrawing(listing.id); }} aria-label={`Withdraw ${listing.produce_name}`}>Remove from Sale</button>}
                        {canRelist && <Link className="btn btn-secondary" to={`/farmer/harvest/${listing.id}/edit?relist=1`} aria-label={`Relist ${listing.produce_name}`}>Post Again</Link>}
                      </div>
                      {listing.status === 'moderated' && <p className="mt-1 text-xs text-black/60">Hidden by demo moderation. Relisting is unavailable.</p>}
                      {editable && !canWithdraw && <p className="mt-1 text-xs text-black/60">Open reservations must be resolved to withdraw.</p>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <div className="panel"><EmptyState icon={Sprout} title={listings.length ? 'No matching harvests' : 'Your next harvest starts here'} description={listings.length ? 'Try a different status or search term.' : 'Add produce, set a fair price, and choose when it is available.'} action={listings.length ? <button type="button" className="btn btn-secondary" onClick={() => { setFilter('all'); setQuery(''); }}>Clear filters</button> : <Link className="btn btn-primary" to="/farmer/add-produce">Post Produce</Link>} /></div>}
      {selected && <ConfirmDialog title={`Remove ${selected.produce_name} from sale?`} description={<div className="space-y-3"><p>This removes the listing from the local demo marketplace. Unsold produce can be relisted with a new deadline. No completed sales will be changed.</p>{error && <Notice tone="error">{error}</Notice>}</div>} confirmLabel="Remove from sale" onConfirm={handleWithdraw} onClose={() => { if (!busy) { setWithdrawing(null); setError(''); } }} busy={busy} />}
    </div>
  );
}
