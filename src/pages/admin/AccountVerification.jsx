import { useState } from 'react';
import { ClipboardCheck, Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState, Modal, Notice, PageHeader, StatStrip, StatusBadge } from '../../components/common/UI';
import { useAuth } from '../../context/AuthContext';
import useDemoData from '../../hooks/useDemoData';
import { reviewVerification } from '../../services/adminService';
import { dateTime } from '../../utils/format';

export default function AccountVerification() {
  const data = useDemoData();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [status, setStatus] = useState('pending');
  const [selectedId, setSelectedId] = useState(null);
  const [decision, setDecision] = useState('');
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const profiles = new Map(data.profiles.map((profile) => [profile.id, profile]));
  const query = search.trim().toLowerCase();
  const reviews = data.verifications.filter((review) => {
    const profile = profiles.get(review.user_id);
    return (status === 'all' || review.status === status)
      && [review.id, review.user_id, profile?.full_name, profile?.email, profile?.seller_name, review.document_label].some((value) => String(value || '').toLowerCase().includes(query));
  }).sort((a, b) => status === 'pending'
    ? new Date(a.submitted_at) - new Date(b.submitted_at)
    : new Date(b.submitted_at) - new Date(a.submitted_at));
  const selected = data.verifications.find((review) => review.id === selectedId);
  const applicant = profiles.get(selected?.user_id);

  function openReview(id) {
    setSelectedId(id);
    setDecision('');
    setReason('');
    setReasonError('');
    setError('');
    setSuccess('');
  }

  async function submitReview(event) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (reason.trim().length < 3 || reason.trim().length > 500) {
      setReasonError('Add a review reason of 3 to 500 characters.');
      return;
    }
    if (!['verified', 'rejected'].includes(decision)) {
      setError('Choose a review decision before confirming.');
      return;
    }
    if (!user || !applicant || selected?.status !== 'pending') {
      setError('This submission is no longer available for review. Close the dialog and check its current status.');
      return;
    }
    setReasonError('');
    setBusy(true);
    try {
      await reviewVerification(selected.id, user.id, decision, reason.trim());
      setSuccess(`Demo profile review for ${applicant.full_name} was ${decision === 'verified' ? 'approved' : 'rejected'}. The decision and reason were recorded locally.`);
      setSelectedId(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The review could not be saved. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administration" title="Review the people, not paperwork." description="Review demo seller profiles and keep a clear record of each decision." />
      <StatStrip items={[
        { label: 'All submissions', value: data.verifications.length, detail: 'Local demo profile reviews' },
        { label: 'Pending', value: data.verifications.filter((review) => review.status === 'pending').length, detail: 'Awaiting a demo review' },
        { label: 'Approved', value: data.verifications.filter((review) => review.status === 'verified').length, detail: 'Demo profile approvals only' },
        { label: 'Rejected', value: data.verifications.filter((review) => review.status === 'rejected').length, detail: 'Reasons kept with each review' },
      ]} />
      <Notice>These are demo seller profiles, not identity documents. A "verified" label only records a local demo review; no real identity, business or security checks are performed.</Notice>
      {success && <Notice tone="success">{success}</Notice>}

      <section className="panel" aria-label="Profile review submissions">
        <div className="grid gap-3 border-b border-black/10 p-4 sm:grid-cols-[minmax(0,2fr)_1fr]">
          <div><label className="label" htmlFor="verification-search">Search submissions</label><div className="relative"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/40" aria-hidden="true" /><input id="verification-search" type="search" className="input pl-9" placeholder="Applicant, email, seller or submission ID" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
          <div><label className="label" htmlFor="verification-status">Review status</label><select id="verification-status" className="input" value={status} onChange={(event) => setStatus(event.target.value)}><option value="pending">Pending</option><option value="verified">Approved in demo</option><option value="rejected">Rejected</option><option value="all">All submissions</option></select></div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-black/60"><p aria-live="polite">{reviews.length} of {data.verifications.length} submissions{status === 'pending' ? ' / oldest first' : ' / newest first'}</p>{(search || status !== 'all') && <button type="button" className="btn btn-quiet" onClick={() => { setSearch(''); setStatus('all'); }}>Clear filters</button>}</div>
        {reviews.length ? <div className="table-wrap" role="region" aria-label="Demo profile submissions, scroll horizontally for all columns" tabIndex={0}>
          <table className="data-table min-w-[720px]">
            <caption className="sr-only">Demo seller profile submissions matching the current filters</caption>
            <thead><tr><th scope="col">Applicant</th><th scope="col">Submission</th><th scope="col">Submitted</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead>
            <tbody>{reviews.map((review) => {
              const profile = profiles.get(review.user_id);
              return <tr key={review.id}>
                <td><p className="font-semibold">{profile?.full_name || 'Profile unavailable'}</p><p className="mt-1 text-xs text-black/60">{profile?.seller_name || profile?.email || review.user_id}</p></td>
                <td className="max-w-56 text-xs">{review.document_label}<p className="mt-1 break-all text-black/60">{review.id}</p></td>
                <td className="whitespace-nowrap">{dateTime(review.submitted_at)}</td>
                <td><StatusBadge status={review.status} /></td>
                <td><button type="button" className="btn btn-quiet" onClick={() => openReview(review.id)} aria-label={`${review.status === 'pending' ? 'Review' : 'Inspect review for'} ${profile?.full_name || review.user_id}`}>{review.status === 'pending' ? 'Review profile' : 'Inspect decision'}</button></td>
              </tr>;
            })}</tbody>
          </table>
        </div> : <EmptyState icon={ClipboardCheck} title={status === 'pending' && !query ? 'No profiles awaiting review' : 'No matching submissions'} description="Change the status filter or search to inspect other local demo submissions." />}
      </section>

      {selectedId && <Modal title={selected?.status === 'pending' ? 'Review demo seller profile' : 'Demo review details'} onClose={() => { if (!busy) setSelectedId(null); }} wide>
        {selected ? <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">{applicant?.full_name || 'Profile unavailable'}</h3><p className="mt-1 break-all text-xs text-black/60">{selected.id}</p></div><StatusBadge status={selected.status} /></div>
          <Notice>{selected.document_label}. No document file is collected or available to download. Review the demo details below only.</Notice>
          <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            {[
              ['Seller name', applicant?.seller_name], ['Email', applicant?.email], ['Phone', applicant?.phone],
              ['Location', applicant?.location], ['Account role', applicant?.role], ['Submitted', dateTime(selected.submitted_at)],
              ['Business name', applicant?.business_name], ['Business location', applicant?.business_location],
            ].map(([label, value]) => <div key={label}><dt className="text-xs text-black/55">{label}</dt><dd className="mt-1 break-words">{value || 'Not provided'}</dd></div>)}
            <div className="sm:col-span-2"><dt className="text-xs text-black/55">Applicant notes</dt><dd className="mt-1 whitespace-pre-wrap break-words">{selected.notes || 'No notes submitted.'}</dd></div>
          </dl>
          {error && <Notice tone="error">{error}</Notice>}
          {selected.status === 'pending' ? <form onSubmit={submitReview} className="space-y-4 border-t border-black/10 pt-5" aria-busy={busy}>
            {!applicant && <Notice tone="error">The associated profile is no longer available. This submission cannot be reviewed.</Notice>}
            <div><label className="label" htmlFor="verification-decision">Decision <span className="text-black/60">(required)</span></label><select id="verification-decision" className="input" value={decision} onChange={(event) => setDecision(event.target.value)} required disabled={busy}><option value="">Choose a decision</option><option value="verified">Approve demo profile</option><option value="rejected">Reject submission</option></select></div>
            <div><label className="label" htmlFor="verification-reason">Review reason <span className="text-black/60">(required)</span></label><textarea id="verification-reason" className="input min-h-24" rows={3} required minLength={3} maxLength={500} disabled={busy} value={reason} onChange={(event) => { setReason(event.target.value); setReasonError(''); }} aria-invalid={Boolean(reasonError)} aria-describedby={reasonError ? 'verification-reason-error' : 'verification-reason-help'} /><p id="verification-reason-help" className="mt-1 text-xs text-black/55">Use 3 to 500 characters without sensitive personal information.</p>{reasonError && <p className="field-error" id="verification-reason-error" role="alert">{reasonError}</p>}</div>
            <p className="text-sm text-black/65">Confirming {decision === 'rejected' ? 'rejects this submission' : decision === 'verified' ? 'approves this demo profile' : 'records your decision'} and saves the reason in local audit history. A completed decision cannot be applied again. This does not verify a real identity.</p>
            <div className="flex flex-wrap justify-end gap-2"><button type="button" className="btn btn-secondary" onClick={() => setSelectedId(null)} disabled={busy}>Cancel</button><button type="submit" className="btn btn-primary" disabled={busy || !applicant || !decision}>{busy ? 'Saving review...' : decision === 'rejected' ? 'Confirm rejection' : 'Confirm demo approval'}</button></div>
          </form> : <div className="space-y-4 border-t border-black/10 pt-5">
            <dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs text-black/55">Reviewed at</dt><dd className="mt-1">{selected.reviewed_at ? dateTime(selected.reviewed_at) : 'Not recorded'}</dd></div><div><dt className="text-xs text-black/55">Reviewed by</dt><dd className="mt-1 break-words">{profiles.get(selected.reviewed_by)?.full_name || selected.reviewed_by || 'Not recorded'}</dd></div><div className="sm:col-span-2"><dt className="text-xs text-black/55">Recorded reason</dt><dd className="mt-1 whitespace-pre-wrap break-words">{selected.reason || 'No reason recorded.'}</dd></div></dl>
            <div className="flex justify-end"><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setSelectedId(null)}>Close details</button></div>
          </div>}
        </div> : <Notice>This submission is no longer present in the local demo. Close the dialog to return to the queue.</Notice>}
      </Modal>}
    </div>
  );
}
