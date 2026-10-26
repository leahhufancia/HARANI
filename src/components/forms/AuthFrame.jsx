import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import HaraniLogo from '../common/HaraniLogo';

export default function AuthFrame({ variant, title, description, children }) {
  return (
    <section aria-labelledby="auth-heading" className={`auth-shell auth-shell--${variant}`}>
      <Link to="/" className="auth-home-link">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to homepage
      </Link>
      <div className="auth-card">
        <header className="auth-intro">
          <HaraniLogo className="auth-logo" />
          <h1 id="auth-heading" className="auth-heading">{title}</h1>
          <p className="auth-description">{description}</p>

          {variant === 'register' && (
            <svg className="auth-field-illustration" viewBox="0 0 280 144" fill="none" aria-hidden="true" focusable="false">
              <circle cx="218" cy="32" r="13" fill="#D0BE00" />
              <g stroke="#159600" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 91c44-24 80-26 126-10s86 14 130-4M12 112c54-28 94-22 141-8s79 9 115-7M12 133c60-28 103-21 149-8s76 7 107-6" />
                <path d="M133 80c-24 12-41 29-51 56M174 91c-20 13-29 28-34 48M218 91c-16 17-21 32-22 45" />
                <path d="M63 74V39m0 20C47 59 40 51 40 39c15-1 23 8 23 20Zm0-10c0-15 9-24 23-24 0 14-9 24-23 24Z" />
              </g>
            </svg>
          )}
        </header>

        <div className="auth-form-panel">{children}</div>
      </div>
    </section>
  );
}
