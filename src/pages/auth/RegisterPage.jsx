import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, Eye, EyeOff, ShoppingBasket, Sprout } from 'lucide-react';
import AuthFrame from '../../components/forms/AuthFrame';
import { useAuth } from '../../context/AuthContext';

export default function RegisterPage() {
  const { signUp } = useAuth();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const role = params.get('role') === 'farmer' ? 'farmer' : 'buyer';
  const { register, handleSubmit, control, getValues, resetField, setFocus, setError: setFieldError, formState: { errors } } = useForm({
    defaultValues: {
      full_name: '', email: '', password: '', confirm_password: '',
      seller_name: '', location: '', buyer_type: 'household', business_name: '', business_type: '',
    },
  });
  const buyerType = useWatch({ control, name: 'buyer_type' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdProfile, setCreatedProfile] = useState(null);
  const submitting = useRef(false);

  useEffect(() => {
    // A rejected email can only receive focus after the fieldset is enabled again.
    if (!loading && errors.email?.type === 'server') setFocus('email');
  }, [errors.email, loading, setFocus]);

  const onSubmit = async (values) => {
    if (submitting.current || createdProfile) return;
    submitting.current = true;
    setLoading(true);
    setError('');
    const isFarmer = role === 'farmer';
    const isBusiness = role === 'buyer' && values.buyer_type === 'business';
    const profileData = {
      full_name: values.full_name,
      location: isFarmer ? values.location.trim() : '',
      seller_name: isFarmer ? values.seller_name.trim() : '',
      buyer_type: role === 'buyer' ? values.buyer_type : '',
      business_name: isBusiness ? values.business_name.trim() : '',
      business_type: isBusiness ? values.business_type.trim() : '',
      preferences: {},
    };

    try {
      const profile = await signUp(values.email, values.password, role, profileData);
      resetField('password');
      resetField('confirm_password');
      setCreatedProfile(profile);
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (registrationError) {
      const message = registrationError.message || 'Unable to create your account. Please try again.';
      if (/email/i.test(message)) {
        setFieldError('email', { type: 'server', message });
      } else {
        setError(message);
      }
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <AuthFrame variant="register" title="Join Harani" description="Sell your harvest or discover fresh produce from local farmers.">
      {createdProfile ? (
        <div className="auth-success">
          <div role="status">
            <Check className="mb-3 h-6 w-6 text-[var(--action-green)]" aria-hidden="true" />
            <h2 className="text-xl font-bold">Your account is ready.</h2>
            <p className="mt-3 break-words text-sm leading-relaxed text-[var(--ink-muted)]">Continue to set up your {createdProfile.role} profile for <strong className="font-semibold text-[var(--ink)]">{createdProfile.email}</strong>.</p>
          </div>
          <Link to="/onboarding" state={location.state} className="btn btn-primary mt-4 w-full text-sm">Continue to onboarding <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
      ) : (
        <>
          {error && <div role="alert" className="notice notice-error mb-4 text-sm">{error}</div>}

          <form onSubmit={handleSubmit(onSubmit)} noValidate aria-busy={loading}>
            <fieldset disabled={loading} className="space-y-4">
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">Account type</legend>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'farmer', label: 'Farmer', icon: Sprout },
                    { value: 'buyer', label: 'Buyer', icon: ShoppingBasket },
                  ].map(({ value, label, icon: Icon }) => (
                    <label key={value} className="auth-choice">
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {label}
                      <input
                        type="radio"
                        name="role"
                        value={value}
                        checked={role === value}
                        onChange={() => {
                          setParams({ role: value }, { replace: true, state: location.state });
                          setError('');
                        }}
                        className="ml-auto h-4 w-4 shrink-0"
                      />
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="register-full_name" className="label text-sm">Full name</label>
                  <input
                    id="register-full_name"
                    type="text"
                    autoComplete="name"
                    maxLength={100}
                    required
                    {...register('full_name', {
                      setValueAs: (value) => value.trim(),
                      required: 'Enter your full name.',
                      minLength: { value: 2, message: 'Use at least 2 characters for your name.' },
                      maxLength: { value: 100, message: 'Use no more than 100 characters for your name.' },
                      onChange: () => setError(''),
                    })}
                    aria-invalid={Boolean(errors.full_name)}
                    aria-describedby={errors.full_name ? 'register-full_name-error' : undefined}
                    className="input text-base sm:text-sm"
                    placeholder="Your full name"
                  />
                  {errors.full_name && <p id="register-full_name-error" role="alert" className="field-error text-sm">{errors.full_name.message}</p>}
                </div>
                <div>
                  <label htmlFor="register-email" className="label text-sm">Email</label>
                  <input
                    id="register-email"
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
                    aria-describedby={errors.email ? 'register-email-error' : undefined}
                    className="input text-base sm:text-sm"
                    placeholder="you@example.com"
                  />
                  {errors.email && <p id="register-email-error" role="alert" className="field-error text-sm">{errors.email.message}</p>}
                </div>
                {[
                  { name: 'password', label: 'Password', visible: showPassword, toggle: setShowPassword },
                  { name: 'confirm_password', label: 'Confirm password', visible: showConfirmation, toggle: setShowConfirmation },
                ].map(({ name, label, visible, toggle }) => (
                  <div key={name}>
                    <label htmlFor={`register-${name}`} className="label text-sm">{label}</label>
                    <div className="relative">
                      <input
                        id={`register-${name}`}
                        type={visible ? 'text' : 'password'}
                        autoComplete="new-password"
                        minLength={6}
                        required
                        {...register(name, name === 'password' ? {
                          required: 'Enter a password.',
                          minLength: { value: 6, message: 'Use at least 6 characters for your password.' },
                          deps: ['confirm_password'],
                          onChange: () => setError(''),
                        } : {
                          required: 'Confirm your password.',
                          validate: (value) => value === getValues('password') || 'The passwords do not match.',
                          onChange: () => setError(''),
                        })}
                        aria-invalid={Boolean(errors[name])}
                        aria-describedby={errors[name] ? `register-${name}-error` : undefined}
                        className="input pr-12 text-base sm:text-sm"
                        placeholder={name === 'password' ? 'At least 6 characters' : 'Repeat password'}
                      />
                      <button
                        type="button"
                        aria-label={`${visible ? 'Hide' : 'Show'} ${name === 'password' ? 'password' : 'password confirmation'}`}
                        aria-controls={`register-${name}`}
                        aria-pressed={visible}
                        onClick={() => toggle((previous) => !previous)}
                        className="auth-password-toggle"
                      >
                        {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                      </button>
                    </div>
                    {errors[name] && <p id={`register-${name}-error`} role="alert" className="field-error text-sm">{errors[name].message}</p>}
                  </div>
                ))}
              </div>

              {role === 'farmer' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="register-seller_name" className="label text-sm">Seller name <span className="font-normal text-[var(--ink-muted)]">(optional)</span></label>
                    <input id="register-seller_name" type="text" autoComplete="organization" maxLength={100} {...register('seller_name')} className="input text-base sm:text-sm" placeholder="Your farm or seller name" />
                  </div>
                  <div>
                    <label htmlFor="register-location" className="label text-sm">Pickup area <span className="font-normal text-[var(--ink-muted)]">(optional)</span></label>
                    <input id="register-location" type="text" maxLength={200} {...register('location')} aria-describedby="register-location-help" className="input text-base sm:text-sm" placeholder="Barangay, city or town" />
                    <p id="register-location-help" className="mt-1 text-sm text-[var(--ink-muted)]">General area, not an exact address.</p>
                  </div>
                </div>
              ) : (
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold">Shopping for</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'household', label: 'Household' },
                      { value: 'business', label: 'Business' },
                    ].map(({ value, label }) => (
                      <label key={value} className="auth-choice">
                        {label}<input type="radio" value={value} {...register('buyer_type')} className="ml-auto h-4 w-4 shrink-0" />
                      </label>
                    ))}
                  </div>
                  {buyerType === 'business' && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {[
                        { name: 'business_name', label: 'Business name', placeholder: 'Your food business' },
                        { name: 'business_type', label: 'Business type', placeholder: 'Restaurant, carenderia...' },
                      ].map(({ name, label, placeholder }) => (
                        <div key={name}>
                          <label htmlFor={`register-${name}`} className="label text-sm">{label} <span className="font-normal text-[var(--ink-muted)]">(optional)</span></label>
                          <input id={`register-${name}`} type="text" autoComplete={name === 'business_name' ? 'organization' : undefined} maxLength={100} {...register(name)} className="input text-base sm:text-sm" placeholder={placeholder} />
                        </div>
                      ))}
                    </div>
                  )}
                </fieldset>
              )}

              <button type="submit" disabled={loading} className="btn btn-primary w-full text-sm disabled:cursor-wait">
                {loading ? 'Creating your account...' : 'Create Account'}
                {!loading && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
              </button>
            </fieldset>
          </form>
          <p className="auth-footer">Already have an account? <Link to="/login" state={location.state} className="auth-text-link">Log In</Link></p>
        </>
      )}
    </AuthFrame>
  );
}
