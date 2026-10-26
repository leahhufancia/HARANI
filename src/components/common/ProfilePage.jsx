import { useRef, useState } from 'react';
import { Check, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { CATEGORIES } from '../../services/produceService';
import { requestVerification } from '../../services/authService';
import { Notice, PageHeader, StatusBadge } from './UI';

export default function ProfilePage() {
  const { user } = useAuth();
  return user ? <ProfileForm key={user.id} user={user} /> : null;
}

function ProfileForm({ user }) {
  const { updateProfile } = useAuth();
  const [values, setValues] = useState({ ...user });
  const [busy, setBusy] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const farmer = user.role === 'farmer';
  const field = (key, value) => { setValues((current) => ({ ...current, [key]: value })); setMessage(''); setError(''); };
  const save = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true); setError(''); setMessage('');
    try { const profile = await updateProfile(values); setValues({ ...profile }); setMessage('Your demo profile has been saved in this browser.'); } catch (err) { setError(err.message); } finally { submitting.current = false; setBusy(false); }
  };
  const requestReview = async () => {
    setReviewBusy(true); setMessage(''); setError('');
    try { await requestVerification(user.id); setMessage('Your demo profile is waiting in the administrator review list. No identity documents were submitted.'); } catch (err) { setError(err.message); } finally { setReviewBusy(false); }
  };
  const inputs = [['full_name', 'Full name', 'text', true], ['email', 'Email address', 'email', true], ['phone', 'Contact number (optional)', 'tel', false], ['location', farmer ? 'General farm / pickup location' : 'Preferred general location', 'text', false]];

  return <div className="max-w-4xl"><PageHeader eyebrow={`${farmer ? 'Farmer' : 'Buyer'} account`} title="My Profile" description="Keep the details that make each local handover easier. Only use sample, non-sensitive information in this demo." />
    {error && <div className="mb-5"><Notice tone="error">{error}</Notice></div>}{message && <div className="mb-5"><Notice tone="success">{message}</Notice></div>}
    <form onSubmit={save} className="space-y-5">
      <section className="panel p-5 sm:p-6"><h2 className="mb-5 text-lg">Personal details</h2><div className="grid gap-5 sm:grid-cols-2">{inputs.map(([name, label, type, required]) => <div key={name}><label className="label" htmlFor={`profile-${name}`}>{label}</label><input id={`profile-${name}`} className="input" type={type} required={required} minLength={name === 'full_name' ? 2 : undefined} maxLength={name === 'email' ? 254 : name === 'phone' ? 30 : 200} autoComplete={name === 'full_name' ? 'name' : name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'address-level2'} value={values[name] || ''} onChange={(event) => field(name, event.target.value)} /></div>)}</div></section>
      <section className="panel p-5 sm:p-6"><h2 className="mb-5 text-lg">{farmer ? 'Seller profile' : 'How you shop'}</h2>{farmer ? <div className="space-y-5"><div><label htmlFor="seller-name" className="label">Farm or seller name (optional)</label><input id="seller-name" className="input" maxLength={100} value={values.seller_name || ''} onChange={(event) => field('seller_name', event.target.value)} /></div><fieldset><legend className="label">Produce categories of interest (optional)</legend><div className="grid gap-2 sm:grid-cols-2">{CATEGORIES.map((category) => <label key={category} className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={(values.categories || []).includes(category)} onChange={(event) => field('categories', event.target.checked ? [...(values.categories || []), category] : values.categories.filter((item) => item !== category))} />{category}</label>)}</div></fieldset><p className="text-xs text-black/55">Profile location changes do not change existing listings or agreed pickup locations.</p></div> : <div><fieldset><legend className="label">Buyer account type</legend><div className="mb-5 flex flex-wrap gap-3">{['household', 'business'].map((type) => <label key={type} className="flex min-h-11 items-center gap-2 rounded border border-black/20 px-4 text-sm capitalize"><input type="radio" name="buyer-type" checked={values.buyer_type === type} onChange={() => field('buyer_type', type)} />{type === 'business' ? 'Business buyer' : 'Household'}</label>)}</div></fieldset>{values.buyer_type === 'business' && <div className="grid gap-4 sm:grid-cols-2">{[['business_name', 'Business name'], ['business_type', 'Business type'], ['business_location', 'General business location']].map(([name, label]) => <div key={name}><label htmlFor={name} className="label">{label} (optional)</label><input id={name} className="input" value={values[name] || ''} maxLength={200} onChange={(event) => field(name, event.target.value)} /></div>)}</div>}</div>}</section>
      <section className="panel p-5 sm:p-6"><h2 className="mb-4 text-lg">Preferences</h2><label className="flex min-h-11 items-start gap-3 text-sm"><input className="mt-1.5" type="checkbox" checked={values.preferences?.[farmer ? 'deadline_reminders' : 'listing_updates'] !== false} onChange={(event) => field('preferences', { ...values.preferences, [farmer ? 'deadline_reminders' : 'listing_updates']: event.target.checked })} /><span>{farmer ? 'Receive approaching selling-deadline reminders' : 'Receive updates when a reserved listing changes'}<span className="mt-1 block text-xs text-black/55">Important reservation and handover notifications are always kept in your workspace.</span></span></label></section>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-black/55">No passwords are stored or checked in this frontend demo.</p><div className="flex gap-2"><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => { setValues({ ...user }); setMessage(''); setError(''); }}>Reset edits</button><button type="submit" className="btn btn-primary" disabled={busy}><Check />{busy ? 'Saving...' : 'Save Changes'}</button></div></div>
    </form>
    {farmer && <section className="panel mt-6 p-5 sm:p-6"><div className="flex flex-wrap items-center gap-3"><ShieldCheck size={20} /><h2 className="text-lg">Demo profile review</h2><StatusBadge status={user.verification_status} /></div><p className="my-4 text-sm text-black/60">Try the administrator review workflow using only your sample seller profile. No documents, identity checks, or real verification are involved.</p>{!['verified', 'pending'].includes(user.verification_status) && <button type="button" className="btn btn-secondary" disabled={reviewBusy} onClick={requestReview}>{reviewBusy ? 'Submitting...' : 'Request demo review'}</button>}</section>}
  </div>;
}
