import { useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, ShieldCheck, ShoppingBasket, Sprout } from 'lucide-react';
import AuthFrame from '../../components/forms/AuthFrame';
import { useAuth } from '../../context/AuthContext';
import { roleHome } from '../../services/authService';

const demoAccounts = [
  { role: 'farmer', label: 'Farmer', email: 'farmer@harani.demo', icon: Sprout },
  { role: 'buyer', label: 'Buyer', email: 'buyer@harani.demo', icon: ShoppingBasket },
  { role: 'admin', label: 'Admin', email: 'admin@harani.demo', icon: ShieldCheck },
];

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { register, handleSubmit, control, setValue, clearErrors, formState: { errors } } = useForm({
    defaultValues: { email: '', password: '', remember: true },
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);
  const email = useWatch({ control, name: 'email' });
  const selectedRole = demoAccounts.find((account) => account.email === email.trim().toLowerCase())?.role;

  const onSubmit = async (values) => {
    if (submitting.current) return;
    setError('');
    submitting.current = true;
    setLoading(true);

    try {
      const profile = await signIn(values.email, values.password, values.remember);
      const from = location.state?.from;
      const intendedPath = typeof from === 'string'
        ? from
        : typeof from?.pathname === 'string' ? `${from.pathname}${from.search || ''}${from.hash || ''}` : '';
      // Shopping links are only resumed by a buyer, never another role.
      const destination = profile.role === 'buyer' && /^\/(?:marketplace|cart|checkout)(?:\/|\?|#|$)/.test(intendedPath)
        ? intendedPath
        : roleHome(profile.role);
      navigate(destination, { replace: true });
    } catch (signInError) {
      setError(signInError.message || 'Unable to log in. Please try again.');
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <AuthFrame variant="login" title="Welcome back to Harani" description="Sign in to manage your harvest or find fresh local produce.">
      <fieldset disabled={loading}>
        <legend className="mb-2 text-sm font-semibold">Sample accounts</legend>
        <div className="grid grid-cols-3 gap-2">
          {demoAccounts.map(({ role, label, email: sampleEmail, icon: Icon }) => (
            <button
              key={role}
              type="button"
              aria-label={`${label} sample account`}
              aria-pressed={selectedRole === role}
              onClick={() => {
                setValue('email', sampleEmail, { shouldDirty: true });
                setValue('password', '');
                clearErrors('email');
                setError('');
              }}
              className="auth-choice justify-center gap-1.5 px-2 text-xs sm:text-sm disabled:cursor-wait"
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {label}
              <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${selectedRole === role ? 'bg-green' : 'bg-transparent'}`} />
            </button>
          ))}
        </div>
      </fieldset>

      {error && <div role="alert" className="notice notice-error mt-4 text-sm">{error}</div>}

      <form onSubmit={handleSubmit(onSubmit)} noValidate aria-busy={loading} className="mt-5">
        <fieldset disabled={loading} className="space-y-3">
          <div>
            <label htmlFor="login-email" className="label text-sm">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={254}
              required
              {...register('email', {
                setValueAs: (value) => value.trim().toLowerCase(),
                required: 'Enter your email address.',
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address.' },
                maxLength: { value: 254, message: 'Use an email with no more than 254 characters.' },
                onChange: () => setError(''),
              })}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'login-email-error' : undefined}
              className="input text-base sm:text-sm"
              placeholder="you@example.com"
            />
            {errors.email && <p id="login-email-error" role="alert" className="field-error text-sm">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="login-password" className="label text-sm">Password <span className="font-normal text-[var(--ink-muted)]">(optional)</span></label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                {...register('password', { onChange: () => setError('') })}
                className="input pr-12 text-base sm:text-sm"
                placeholder="Enter your password"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-controls="login-password"
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
                className="auth-password-toggle"
              >
                {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-3 text-sm">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[var(--ink-muted)]">
              <input type="checkbox" {...register('remember')} className="h-4 w-4" />Remember me
            </label>
            <Link to="/forgot-password" state={location.state} className="auth-text-link">Forgot password?</Link>
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary w-full text-sm disabled:cursor-wait">
            {loading ? 'Opening your workspace...' : 'Log In'}
            {!loading && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          </button>
        </fieldset>
      </form>

      <p className="auth-footer">Don't have an account? <Link to="/register" state={location.state} className="auth-text-link">Create one.</Link></p>
    </AuthFrame>
  );
}
