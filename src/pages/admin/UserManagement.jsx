import { useState } from 'react';
import { Eye, Search, UserCheck, UserRoundX, Users } from 'lucide-react';
import { EmptyState, Modal, Notice, PageHeader, StatStrip, StatusBadge } from '../../components/common/UI';
import { useAuth } from '../../context/AuthContext';
import useDemoData from '../../hooks/useDemoData';
import { setUserStatus } from '../../services/adminService';
import { dateTime, shortDate } from '../../utils/format';

export default function UserManagement() {
  const data = useDemoData();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [inspectId, setInspectId] = useState(null);
  const [change, setChange] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const query = search.trim().toLowerCase();
  const users = data.profiles.filter((profile) => (
    (role === 'all' || profile.role === role)
    && (status === 'all' || profile.status === status)
    && [profile.id, profile.full_name, profile.email, profile.location, profile.seller_name, profile.business_name].some((value) => String(value || '').toLowerCase().includes(query))
  )).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const inspected = data.profiles.find((profile) => profile.id === inspectId);
  const target = data.profiles.find((profile) => profile.id === change?.id);
  const eligible = target && target.role !== 'admin' && target.status !== change?.status;
  const affectedOrders = target ? data.reservations.filter((reservation) => (
    (reservation.buyer_id === target.id || reservation.farmer_id === target.id)
    && ['pending', 'confirmed', 'ready'].includes(reservation.status)
  )).length : 0;

  function beginChange(profile) {
    setChange({ id: profile.id, status: profile.status === 'active' ? 'suspended' : 'active' });
    setReason('');
    setReasonError('');
    setError('');
    setSuccess('');
  }

  async function confirmChange(event) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (reason.trim().length < 3 || reason.trim().length > 500) {
      setReasonError('Enter a reason of 3 to 500 characters before confirming.');
      return;
    }
    if (!user || !eligible) {
      setError('This account change is no longer available. Close this dialog and check the current account status.');
      return;
    }
    setReasonError('');
    setBusy(true);
    try {
      await setUserStatus(target.id, user.id, change.status, reason.trim());
      setSuccess(change.status === 'suspended'
        ? `${target.full_name} was suspended in the demo. Their open reservations were cancelled; their seller listings are hidden.`
        : `${target.full_name} was reactivated in the demo. Previously cancelled reservations were not restored.`);
      setChange(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The account could not be updated. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administration" title="People behind the market." description="Inspect local demo profiles and manage account availability." />
      <StatStrip items={[
        { label: 'Total accounts', value: data.profiles.length, detail: 'All demo roles' },
        { label: 'Active', value: data.profiles.filter((profile) => profile.status === 'active').length, detail: 'Available for demo sign-in' },
        { label: 'Suspended', value: data.profiles.filter((profile) => profile.status === 'suspended').length, detail: 'Demo sign-in blocked' },
        { label: 'Farmers / buyers', value: `${data.profiles.filter((profile) => profile.role === 'farmer').length} / ${data.profiles.filter((profile) => profile.role === 'buyer').length}`, detail: 'Administrator accounts are separate' },
      ]} />
      <Notice>Account controls affect this browser's demo only. They are not production access controls or real identity verification. Administrator accounts cannot be suspended.</Notice>
      {success && <Notice tone="success">{success}</Notice>}

      <section className="panel" aria-label="User directory">
        <div className="grid gap-3 border-b border-black/10 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_1fr_1fr]">
          <div>
            <label className="label" htmlFor="admin-user-search">Search accounts</label>
            <div className="relative"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/40" aria-hidden="true" /><input id="admin-user-search" type="search" className="input pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email, location or account ID" /></div>
          </div>
          <div><label className="label" htmlFor="admin-user-role">Role</label><select id="admin-user-role" className="input" value={role} onChange={(event) => setRole(event.target.value)}><option value="all">All roles</option><option value="farmer">Farmer</option><option value="buyer">Buyer</option><option value="admin">Administrator</option></select></div>
          <div><label className="label" htmlFor="admin-user-status">Account status</label><select id="admin-user-status" className="input" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></select></div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-black/60">
          <p aria-live="polite">{users.length} of {data.profiles.length} accounts</p>
          {(search || role !== 'all' || status !== 'all') && <button type="button" className="btn btn-quiet" onClick={() => { setSearch(''); setRole('all'); setStatus('all'); }}>Clear filters</button>}
        </div>
        {users.length ? (
          <div className="table-wrap" role="region" aria-label="User accounts, scroll horizontally for all columns" tabIndex={0}>
            <table className="data-table min-w-[900px]">
              <caption className="sr-only">Local demo accounts matching the search and role and status filters</caption>
              <thead><tr><th scope="col">Account</th><th scope="col">Role</th><th scope="col">Location</th><th scope="col">Demo review</th><th scope="col">Status</th><th scope="col">Joined</th><th scope="col">Actions</th></tr></thead>
              <tbody>{users.map((profile) => (
                <tr key={profile.id}>
                  <td><p className="font-semibold">{profile.full_name}</p><p className="mt-1 text-xs text-black/60">{profile.email}</p></td>
                  <td className="capitalize">{profile.role}</td>
                  <td className="max-w-48">{profile.location || 'Not provided'}</td>
                  <td><StatusBadge status={profile.verification_status} /></td>
                  <td><StatusBadge status={profile.status} /></td>
                  <td className="whitespace-nowrap">{shortDate(profile.created_at)}</td>
                  <td><div className="flex items-center gap-1">
                    <button type="button" className="btn btn-quiet" onClick={() => setInspectId(profile.id)} aria-label={`Inspect ${profile.full_name}`}><Eye size={14} aria-hidden="true" /> Inspect</button>
                    {profile.role !== 'admin' ? <button type="button" className="btn btn-quiet" onClick={() => beginChange(profile)} aria-label={`${profile.status === 'active' ? 'Suspend' : 'Reactivate'} ${profile.full_name}`}>{profile.status === 'active' ? <UserRoundX size={14} aria-hidden="true" /> : <UserCheck size={14} aria-hidden="true" />}{profile.status === 'active' ? 'Suspend' : 'Reactivate'}</button> : <span className="px-2 text-xs text-black/60">Admin account</span>}
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyState icon={Users} title="No accounts found" description="Try another search or clear the filters to see all demo accounts." />}
      </section>

      {inspectId && <Modal title="Demo account details" onClose={() => setInspectId(null)} wide>
        {inspected ? <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-semibold">{inspected.full_name}</h3><p className="mt-1 break-all text-xs text-black/60">{inspected.id}</p></div><StatusBadge status={inspected.status} /></div>
          <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            {[
              ['Role', inspected.role], ['Email', inspected.email], ['Phone', inspected.phone], ['Location', inspected.location],
              ['Seller name', inspected.seller_name], ['Buyer type', inspected.buyer_type], ['Business name', inspected.business_name],
              ['Business type', inspected.business_type], ['Business location', inspected.business_location],
              ['Joined', dateTime(inspected.created_at)], ['Onboarding', inspected.onboarding_complete ? 'Complete' : 'Incomplete'],
            ].map(([label, value]) => <div key={label}><dt className="text-xs text-black/55">{label}</dt><dd className="mt-1 break-words">{value || 'Not provided'}</dd></div>)}
            <div><dt className="text-xs text-black/55">Demo profile review</dt><dd className="mt-1"><StatusBadge status={inspected.verification_status} /></dd></div>
            <div><dt className="text-xs text-black/55">Listings</dt><dd className="mt-1">{data.listings.filter((listing) => listing.farmer_id === inspected.id).length}</dd></div>
            <div><dt className="text-xs text-black/55">Reservations as buyer or seller</dt><dd className="mt-1">{data.reservations.filter((reservation) => reservation.buyer_id === inspected.id || reservation.farmer_id === inspected.id).length}</dd></div>
          </dl>
        </div> : <Notice>This profile is no longer present in the demo.</Notice>}
        <div className="mt-5 flex justify-end"><button type="button" className="btn btn-secondary" onClick={() => setInspectId(null)}>Close details</button></div>
      </Modal>}

      {change && <Modal title={change.status === 'suspended' ? 'Confirm account suspension' : 'Confirm account reactivation'} onClose={() => { if (!busy) setChange(null); }}>
        <form className="space-y-4" onSubmit={confirmChange} aria-busy={busy}>
          <p className="text-sm">{change.status === 'suspended' ? 'Suspend' : 'Reactivate'} <strong>{target?.full_name || 'this account'}</strong> in the local demo?</p>
          <Notice>{change.status === 'suspended'
            ? `Suspension blocks demo sign-in, hides this seller's listings and cancels this user's ${affectedOrders} open reservations as buyer or seller. Reserved stock is released. Reactivation will not restore cancelled reservations.`
            : 'Reactivation allows demo sign-in again. Eligible seller listings can become visible, but expired, withdrawn or moderated listings stay unavailable. Cancelled reservations are not restored.'}</Notice>
          {!eligible && <Notice tone="error">This account is no longer eligible for this change. Close the dialog and inspect its current status.</Notice>}
          {error && <Notice tone="error">{error}</Notice>}
          <div><label className="label" htmlFor="account-change-reason">Reason for this change <span className="text-black/60">(required)</span></label><textarea id="account-change-reason" className="input min-h-24" rows={3} required minLength={3} maxLength={500} disabled={busy} value={reason} onChange={(event) => { setReason(event.target.value); setReasonError(''); }} aria-invalid={Boolean(reasonError)} aria-describedby={reasonError ? 'account-reason-error' : 'account-reason-help'} /><p id="account-reason-help" className="mt-1 text-xs text-black/55">Use 3 to 500 characters. The reason is recorded in client-local audit history.</p>{reasonError && <p id="account-reason-error" className="field-error" role="alert">{reasonError}</p>}</div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-black/10 pt-4"><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setChange(null)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={busy || !eligible}>{busy ? 'Saving change...' : change.status === 'suspended' ? 'Confirm suspension' : 'Confirm reactivation'}</button></div>
        </form>
      </Modal>}
    </div>
  );
}
