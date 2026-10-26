import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ShoppingBasket, Sprout } from 'lucide-react';
import HaraniLogo from '../../components/common/HaraniLogo';
import { useAuth } from '../../context/AuthContext';
import { roleHome } from '../../services/authService';

export default function OnboardingPage() {
  const { user, userRole, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [location, setLocation] = useState(user?.location || '');
  const [buyerType, setBuyerType] = useState(user?.buyer_type === 'business' ? 'business' : 'household');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);
  const isFarmer = userRole === 'farmer';
  const isBuyer = userRole === 'buyer';

  const finishSetup = async (destination, skipOptional = false) => {
    if (submitting.current || !user) return;
    submitting.current = true;
    setLoading(true);
    setError('');
    try {
      const updates = { onboarding_complete: true };
      if (!skipOptional) {
        updates.location = location.trim();
        if (isBuyer) updates.buyer_type = buyerType;
      }
      await updateProfile(updates);
      navigate(destination, { replace: true });
    } catch (profileError) {
      setError(profileError.message || 'Unable to save your demo preferences. Please try again.');
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="rounded-md border border-black/10 bg-white px-5 pb-7 sm:px-8 sm:pb-8">
        <Link to="/" aria-label="Harani home" className="inline-block rounded-lg focus-visible:outline-2 focus-visible:outline-green">
          <HaraniLogo className="w-60" />
        </Link>

        {!user ? (
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Start with a demo account.</h1>
            <p className="mt-3 text-sm leading-relaxed text-black/60">Create a farmer or buyer profile, or sign in with an existing demo email, before setting up your workspace.</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link to="/register" className="btn btn-primary">Join Harani <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              <Link to="/login" className="btn btn-secondary">Log In</Link>
            </div>
          </div>
        ) : (
          <>
            <p className="eyebrow mb-3">A few optional details</p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Make Harani work for you.</h1>
            <p className="mt-3 text-sm leading-relaxed text-black/60">Your demo account is ready. Review your profile, add a general location if you like, and take your next step.</p>

            <div className="mt-6 rounded-xl border border-green/20 bg-green/5 p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-bold">
                <Check className="h-4 w-4" aria-hidden="true" />Demo profile ready
              </div>
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div className="min-w-0"><dt className="text-xs text-black/55">Full name</dt><dd className="mt-1 break-words font-semibold">{user.full_name}</dd></div>
                <div className="min-w-0"><dt className="text-xs text-black/55">Email</dt><dd className="mt-1 break-words font-semibold">{user.email}</dd></div>
                {isFarmer && (
                  <>
                    <div className="min-w-0"><dt className="text-xs text-black/55">Seller or farm</dt><dd className="mt-1 break-words font-semibold">{user.seller_name || user.full_name}</dd></div>
                    <div className="min-w-0"><dt className="text-xs text-black/55">Produce categories</dt><dd className="mt-1 break-words font-semibold">{user.categories?.length ? user.categories.join(', ') : 'You can add these later'}</dd></div>
                  </>
                )}
                {isBuyer && user.buyer_type === 'business' && user.business_name && (
                  <div className="min-w-0 sm:col-span-2"><dt className="text-xs text-black/55">Food business</dt><dd className="mt-1 break-words font-semibold">{user.business_name}</dd></div>
                )}
              </dl>
            </div>

            {error && <div role="alert" className="notice mt-5 border border-[#D0BE00]/40 bg-[#D0BE00]/10 text-sm">{error}</div>}

            <form
              onSubmit={(event) => { event.preventDefault(); finishSetup(isFarmer ? '/farmer/add-produce' : roleHome(userRole)); }}
              aria-busy={loading}
              className="mt-6"
            >
              <fieldset disabled={loading} className="space-y-6">
                <div>
                  <label htmlFor="onboarding-location" className="label">{isFarmer ? 'General farm location' : 'Preferred area'} <span className="font-normal text-black/60">(optional)</span></label>
                  <input id="onboarding-location" name="location" type="text" maxLength={200} value={location} onChange={(event) => { setLocation(event.target.value); setError(''); }} aria-describedby="onboarding-location-help" className="input" placeholder="Barangay, city or municipality" />
                  <p id="onboarding-location-help" className="mt-2 text-xs leading-relaxed text-black/60">Keep it general. No exact address, coordinates, or identity documents are needed for this demo.</p>
                </div>

                {isBuyer && (
                  <fieldset>
                    <legend className="label">Shopping for <span className="font-normal text-black/60">(optional)</span></legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        { value: 'household', label: 'My household' },
                        { value: 'business', label: 'My food business' },
                      ].map(({ value, label }) => (
                        <label key={value} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-green ${buyerType === value ? 'border-green bg-green/5 text-black' : 'border-black/15 text-black/70'}`}>
                          <input type="radio" name="buyer_type" value={value} checked={buyerType === value} onChange={() => { setBuyerType(value); setError(''); }} className="h-4 w-4 accent-green" />{label}
                        </label>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-black/60">Business details can be added or updated from your profile.</p>
                  </fieldset>
                )}

                <div className="flex items-start gap-3 border-y border-black/10 py-5">
                  {isFarmer ? <Sprout className="mt-0.5 h-5 w-5 shrink-0 text-green" aria-hidden="true" /> : <ShoppingBasket className="mt-0.5 h-5 w-5 shrink-0 text-green" aria-hidden="true" />}
                  <div>
                    <h2 className="text-sm font-bold">{isFarmer ? 'Ready to share your first harvest?' : isBuyer ? 'Your next local find is waiting.' : 'Your demo workspace is ready.'}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-black/60">{isFarmer ? 'Add a produce listing with your price, quantity, and pickup details, or explore your dashboard first.' : isBuyer ? 'Browse the marketplace before reserving exactly the quantity you need.' : 'Continue to your workspace to explore the demo.'}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button type="submit" disabled={loading} className="btn btn-primary flex-1 disabled:cursor-wait disabled:opacity-60">
                    {loading ? 'Saving your preferences...' : isFarmer ? 'Add Produce' : isBuyer ? 'Continue to marketplace' : 'Open workspace'}
                    {!loading && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                  </button>
                  {isFarmer && <button type="button" disabled={loading} onClick={() => finishSetup('/farmer/dashboard')} className="btn btn-secondary disabled:cursor-wait disabled:opacity-60">Go to dashboard</button>}
                </div>
                <button type="button" disabled={loading} onClick={() => finishSetup(roleHome(userRole), true)} className="btn btn-quiet w-full disabled:cursor-wait disabled:opacity-60">Skip optional setup</button>
              </fieldset>
            </form>
            <p className="mt-5 text-center text-xs leading-relaxed text-black/60">Your preferences stay in this browser. You can change them from your profile anytime.</p>
          </>
        )}
      </div>
    </section>
  );
}
