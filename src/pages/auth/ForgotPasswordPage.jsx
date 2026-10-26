import { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import HaraniLogo from '../../components/common/HaraniLogo';
import { useAuth } from '../../context/AuthContext';

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    setError('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError(normalizedEmail ? 'Enter a valid email address.' : 'Enter an email address to preview recovery.');
      event.currentTarget.elements.namedItem('email')?.focus();
      return;
    }
    submitting.current = true;
    setLoading(true);
    try {
      await resetPassword(normalizedEmail);
      setEmail(normalizedEmail);
      setSuccess(true);
    } catch (resetError) {
      setError(resetError.message || 'Unable to preview account recovery. Please try again.');
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-lg px-4 py-8 sm:px-6 sm:py-12">
      <Link to="/login" state={location.state} className="mb-5 inline-flex min-h-11 items-center gap-2 rounded text-sm font-semibold text-black/60 hover:text-black focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-green">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to login
      </Link>
      <div className="rounded-md border border-black/10 px-5 pb-7 sm:px-7">
        <Link to="/" aria-label="Harani home" className="inline-block rounded-lg focus-visible:outline-2 focus-visible:outline-green">
          <HaraniLogo className="w-60" />
        </Link>
        <p className="eyebrow mb-3">Account recovery demo</p>
        <h1 className="text-3xl font-bold tracking-tight">Reset your password</h1>
        <p className="mt-3 text-sm leading-relaxed text-black/60">Explore the recovery flow without sending a real email or changing a real account.</p>

        {success ? (
          <div className="mt-6">
            <div role="status" className="rounded-xl border border-green/20 bg-green/5 p-5">
              <Check className="mb-3 h-6 w-6 text-green" aria-hidden="true" />
              <h2 className="font-bold">Recovery preview complete.</h2>
              <p className="mt-2 break-words text-sm leading-relaxed text-black/65">No email was sent to <strong className="font-semibold text-black">{email}</strong>, and no password was changed. This demo does not store passwords.</p>
              <p className="mt-3 text-sm leading-relaxed text-black/65">Return to login and select a demo role, or use the email of a profile you registered in this browser.</p>
            </div>
            <Link to="/login" state={location.state} className="btn btn-primary mt-5 w-full">Back to login <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
            <button type="button" onClick={() => { setSuccess(false); setError(''); }} className="btn btn-quiet mt-3 w-full">Try another email</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate aria-busy={loading} className="mt-6">
            <fieldset disabled={loading} className="space-y-5">
              <div>
                <label htmlFor="recovery-email" className="label">Email</label>
                <input
                  id="recovery-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={254}
                  required
                  value={email}
                  onChange={(event) => { setEmail(event.target.value); setError(''); }}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'recovery-email-error' : 'recovery-demo-note'}
                  className="input"
                  placeholder="you@example.com"
                />
                {error && <p id="recovery-email-error" role="alert" className="field-error">{error}</p>}
              </div>
              <p id="recovery-demo-note" className="notice border border-[#D0BE00]/40 bg-[#D0BE00]/10 text-xs leading-relaxed text-black/70">Simulated only. Submitting this form does not send a reset link. You can log in to a known demo profile without a password.</p>
              <button type="submit" disabled={loading} className="btn btn-primary w-full disabled:cursor-wait disabled:opacity-60">{loading ? 'Previewing recovery...' : 'Simulate reset request'}</button>
            </fieldset>
          </form>
        )}
      </div>
    </section>
  );
}
