import { Suspense, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, BarChart3, Bell, ClipboardList, FileText, Home, LayoutDashboard, LogOut, Menu, Package, Receipt, ShieldCheck, ShoppingBasket, Sprout, UserRound, Users, X } from 'lucide-react';
import HaraniLogo from '../components/common/HaraniLogo';
import { Notice } from '../components/common/UI';
import { useAuth } from '../context/AuthContext';
import useDemoData from '../hooks/useDemoData';
import { roleHome } from '../services/authService';

const copyrightYear = new Date().getFullYear();

const navigation = {
  farmer: [
    ['Dashboard', '/farmer/dashboard', LayoutDashboard], ['My Produce', '/farmer/harvest', Sprout], ['Reservations', '/farmer/reservations', ClipboardList],
    ['Orders & Pickups', '/farmer/sales', Receipt], ['Notifications', '/farmer/notifications', Bell], ['My Profile', '/farmer/profile', UserRound],
  ],
  buyer: [
    ['Marketplace', '/marketplace', ShoppingBasket], ['My Reservations', '/buyer/reservations', ClipboardList], ['My Purchases', '/buyer/purchases', Receipt], ['Notifications', '/buyer/notifications', Bell], ['My Profile', '/buyer/profile', UserRound],
  ],
  admin: [
    ['Dashboard', '/admin/dashboard', LayoutDashboard], ['User Management', '/admin/users', Users], ['Account Verification', '/admin/verifications', ShieldCheck], ['Listings', '/admin/listings', Package], ['Reservations & Transactions', '/admin/transactions', ClipboardList], ['Activity Reports', '/admin/reports', BarChart3], ['Audit History', '/admin/audit', FileText],
  ],
};

export default function WorkspaceLayout({ role, publicBrowse = false }) {
  const { user, userRole, signOut, storageWarning } = useAuth();
  const data = useDemoData();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const currentRole = publicBrowse ? (userRole || 'buyer') : role;
  const items = navigation[currentRole];
  const unread = data.notifications.filter((notification) => notification.user_id === user?.id && !notification.is_read).length;
  const label = { farmer: 'Farmer workspace', buyer: 'Buyer marketplace', admin: 'Administrator workspace' }[currentRole];

  if (!publicBrowse && !user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (!publicBrowse && userRole !== role) return <Navigate to={roleHome(userRole)} replace />;

  const logout = async () => {
    setSigningOut(true);
    try { await signOut(); navigate('/'); } catch (err) { setError(err.message); } finally { setSigningOut(false); }
  };
  const links = <nav aria-label={`${currentRole} navigation`} className="space-y-1">
    {items.map(([name, path, Icon]) => <NavLink key={path} to={path} className="workspace-link" onClick={() => setMobileOpen(false)}><Icon size={18} strokeWidth={1.7} className="shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1">{name}</span>{name === 'Notifications' && unread > 0 && <span className="rounded-sm bg-yellow/25 px-1.5 text-xs font-bold">{unread}</span>}</NavLink>)}
  </nav>;

  return <div className="min-h-screen bg-white">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-black/10 bg-white lg:flex">
      <Link to="/" aria-label="Harani home" className="mx-auto flex h-24 items-center"><HaraniLogo className="!w-44" /></Link>
      <div className="px-5 pb-3"><p className="eyebrow">{label}</p></div>
      <div className="flex-1 px-3 overflow-y-auto">{links}{currentRole !== 'buyer' && <Link to="/marketplace" className="workspace-link mt-5"><ShoppingBasket size={18} />Browse marketplace<ArrowUpRight size={15} /></Link>}</div>
      <div className="border-t border-black/10 p-3 shrink-0">
        <Link to="/" className="workspace-link w-full"><Home size={18} />Back to Home</Link>
        {user ? <button type="button" onClick={logout} disabled={signingOut} className="workspace-link w-full mt-1"><LogOut size={18} />{signingOut ? 'Signing out...' : 'Sign Out'}</button> : <Link className="btn btn-primary w-full mt-3" to="/login">Log In to Demo</Link>}
      </div>
    </aside>
    <div className="min-w-0 lg:pl-60 bg-page-warm min-h-screen">
      <header className="border-b border-black/10 bg-white px-4 sm:px-7">
        <div className="mx-auto flex min-h-20 max-w-[1440px] items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3"><button type="button" aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileOpen} aria-controls="mobile-navigation" onClick={() => setMobileOpen(!mobileOpen)} className="btn btn-quiet !p-2 lg:hidden">{mobileOpen ? <X /> : <Menu />}</button><Link to="/" className="lg:hidden" aria-label="Harani home"><HaraniLogo className="!w-36" /></Link><p className="hidden text-sm text-black/55 lg:block">{publicBrowse && currentRole !== 'buyer' ? 'Explore local produce' : label}</p></div>
          <div className="flex items-center gap-3 sm:gap-5">
            {user && currentRole !== 'admin' && <Link to={`/${currentRole}/notifications`} className="relative rounded p-2" aria-label={`Notifications, ${unread} unread`}><Bell size={19} />{unread > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-sm bg-yellow px-1 text-center text-[10px] font-bold">{unread}</span>}</Link>}
            <div className="border-l border-black/10 pl-3 sm:pl-5">{user ? <><p className="max-w-40 truncate text-sm font-semibold">{user.full_name}</p><Link className="text-xs text-black/60 underline underline-offset-2" to="/login">Switch demo account</Link></> : <Link to="/login" className="btn btn-secondary">Log In</Link>}</div>
          </div>
        </div>
        {mobileOpen && <div id="mobile-navigation" className="border-t border-black/10 py-4 lg:hidden" onKeyDown={(event) => { if (event.key === 'Escape') setMobileOpen(false); }}>{links}<Link to="/" className="workspace-link" onClick={() => setMobileOpen(false)}><Home size={18} />Return to Home</Link>{user && <button type="button" className="workspace-link w-full" disabled={signingOut} onClick={logout}><LogOut size={18} />Sign Out</button>}</div>}
      </header>
      <main id="main-content" className="mx-auto min-w-0 max-w-[1500px] px-4 py-7 sm:px-7 lg:px-8 lg:py-8">
        {(error || storageWarning) && <div className="mb-5"><Notice tone="error">{error || storageWarning}</Notice></div>}
        <Suspense fallback={<div className="panel p-8 text-sm text-black/60" role="status">Loading your workspace...</div>}><Outlet /></Suspense>
      </main>
      <footer className="mx-4 flex flex-wrap justify-between gap-2 border-t border-black/10 py-5 text-xs text-black/55 sm:mx-7"><span>Harani &copy; {copyrightYear}</span><span>Frontend demo. No real authentication, money transfers, or identity verification.</span></footer>
    </div>
  </div>;
}
