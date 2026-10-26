import { useEffect, useRef, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import HaraniLogo from '../components/common/HaraniLogo';
import { useAuth } from '../context/AuthContext';
import { roleHome } from '../services/authService';
import { Notice } from '../components/common/UI';
import CartLink from '../components/cart/CartLink';

const copyrightYear = new Date().getFullYear();

const navigation = [
  { to: '/', label: 'Home' },
  { to: '/marketplace', label: 'Marketplace' },
  { to: '/#how-it-works', label: 'How It Works' },
  { to: '/#about', label: 'About Harani' },
];

export default function PublicLayout() {
  const { user, userRole, storageWarning } = useAuth();
  const { pathname, hash, key } = useLocation();
  const [openMenuKey, setOpenMenuKey] = useState(null);
  const menuButton = useRef(null);
  const menuOpen = openMenuKey === key;
  const home = roleHome(userRole);

  useEffect(() => {
    // Router links retain the home-page anchors without reloading a demo session.
    const frame = window.requestAnimationFrame(() => {
      if (hash) {
        document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, hash, key]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpenMenuKey(null);
        menuButton.current?.focus();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [menuOpen]);

  const isActive = (to) => (
    to.includes('#')
      ? `${pathname}${hash}` === to
      : to === '/' ? pathname === '/' && !hash : pathname.startsWith(to)
  );

  if (/^\/(?:login|register)\/?$/i.test(pathname)) {
    return (
      <div className="auth-page flex min-h-dvh flex-col">
        <a href="#main-content" className="skip-link">Skip to content</a>
        <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col focus:outline-none">
          {storageWarning && <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 lg:px-8"><Notice tone="error">{storageWarning}</Notice></div>}
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-black">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-black px-4 py-3 text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="Harani home" className="shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green">
            <HaraniLogo className="w-40 sm:w-60" />
          </Link>

          <nav aria-label="Main navigation" className="hidden items-center gap-6 lg:flex">
            {navigation.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                aria-current={isActive(to) ? (to.includes('#') ? 'location' : 'page') : undefined}
                className={`rounded py-2 text-sm font-semibold transition-colors hover:text-black focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-green ${isActive(to) ? 'text-black underline decoration-green decoration-2 underline-offset-8' : 'text-black/65'}`}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:ml-0 lg:gap-3">
            {userRole === 'buyer' && <CartLink />}
            <div className="hidden items-center gap-3 lg:flex">
              <Link to="/login" className="btn btn-quiet">
                {user ? 'Switch account' : 'Log In'}
              </Link>
              <Link to={user ? home : '/register'} className="btn btn-primary">
                {user ? 'My workspace' : 'Get Started'}
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <button
            ref={menuButton}
            type="button"
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
            aria-controls="public-mobile-navigation"
            onClick={() => setOpenMenuKey(menuOpen ? null : key)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-black/15 hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green lg:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>

        <nav
          id="public-mobile-navigation"
          aria-label="Mobile navigation"
          hidden={!menuOpen}
          className="border-t border-black/10 px-4 pb-5 pt-2 sm:px-6 lg:hidden"
        >
          {navigation.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpenMenuKey(null)}
              aria-current={isActive(to) ? (to.includes('#') ? 'location' : 'page') : undefined}
              className={`block rounded-lg px-3 py-3 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-green ${isActive(to) ? 'bg-green/5 text-black' : 'text-black/70'}`}
            >
              {label}
            </Link>
          ))}
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-black/10 pt-4">
            <Link to="/login" onClick={() => setOpenMenuKey(null)} className="btn btn-secondary">
              {user ? 'Switch account' : 'Log In'}
            </Link>
            <Link to={user ? home : '/register'} onClick={() => setOpenMenuKey(null)} className="btn btn-primary">
              {user ? 'My workspace' : 'Get Started'}
            </Link>
          </div>
        </nav>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {storageWarning && <div className="mx-auto max-w-7xl px-4 pt-4"><Notice tone="error">{storageWarning}</Notice></div>}
        <Outlet />
      </main>

      <footer className="border-t border-black/10 bg-white">
        <div className="mx-auto max-w-7xl px-4 pb-7 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-1 sm:flex-row sm:items-center sm:gap-6">
            <Link to="/" aria-label="Harani home" className="shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-green">
              <HaraniLogo className="w-52 sm:w-60" />
            </Link>
            <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-3 pb-6 text-sm font-semibold sm:pb-0">
              <Link to="/marketplace" className="hover:underline">Find Produce</Link>
              <Link to="/register?role=farmer" className="hover:underline">Sell Your Harvest</Link>
              <Link to="/#about" className="hover:underline">About Harani</Link>
              <Link to="/login" className="hover:underline">Log In</Link>
              <Link to="/register" className="hover:underline">Get Started</Link>
            </nav>
          </div>
          <div className="flex flex-col justify-between gap-3 border-t border-black/10 pt-5 text-xs leading-relaxed text-black/55 sm:flex-row sm:gap-8">
            <p>&copy; {copyrightYear} Harani. Connecting farmers with buyers.</p>
            <p className="max-w-md sm:text-right">Frontend demo. Sample listings, browser-local accounts, and simulated transactions.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
