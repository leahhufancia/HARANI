import { Suspense, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, BarChart3, Bell, ChevronRight, ClipboardList, FileText, Home, LayoutDashboard, LogOut, Menu, Package, Receipt, ShieldCheck, ShoppingBasket, Sprout, UserRound, Users, X } from 'lucide-react';
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
  const currentPage = items.find(([, path]) => location.pathname === path)?.[0] || (location.pathname.includes('add-produce') ? 'Add Produce' : location.pathname.endsWith('/edit') ? 'Edit Produce' : 'Produce Details');
  const initials = user?.full_name?.split(' ').filter(Boolean).slice(0, 2).map((name) => name[0]).join('');

  if (!publicBrowse && !user) return <Navigate to={signingOut ? '/' : '/login'} replace state={signingOut ? undefined : { from: location.pathname + location.search }} />;
  if (!publicBrowse && userRole !== role) return <Navigate to={roleHome(userRole)} replace />;

  const logout = async () => {
    setSigningOut(true);
    try { await signOut(); navigate('/', { replace: true }); } catch (err) { setError(err.message); setSigningOut(false); }
  };
  const links = <nav aria-label={`${currentRole} navigation`} className="space-y-1">
    {items.map(([name, path, Icon]) => <NavLink key={path} to={path} className="workspace-link" onClick={() => setMobileOpen(false)}><Icon size={18} strokeWidth={1.7} className="shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1">{name}</span>{name === 'Notifications' && unread > 0 && <span className="flex min-w-5 items-center justify-center rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-bold text-yellow-800">{unread}</span>}</NavLink>)}
  </nav>;

  return <div className="workspace-shell min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="workspace-sidebar sticky top-0 z-20 hidden min-h-dvh flex-col self-start border-r lg:flex">
      <Link to="/" aria-label="Harani home" className="flex items-center justify-center px-5 py-1"><HaraniLogo className="w-52" /></Link>
      <div className="px-7 pb-4 pt-3"><p className="eyebrow">{label}</p></div>
      <div className="flex-1 px-3.5 pb-8">{links}{currentRole !== 'buyer' && <Link to="/marketplace" className="workspace-link mt-6 border-t border-t-sage-200 pt-4"><ShoppingBasket size={18} aria-hidden="true" /><span className="flex-1">Browse marketplace</span><ArrowUpRight size={15} aria-hidden="true" /></Link>}</div>
      <div className="shrink-0 border-t border-sage-200 p-3.5">
        <Link to="/" className="workspace-link w-full"><Home size={18} />Back to Home</Link>
        {user ? <button type="button" onClick={logout} disabled={signingOut} className="workspace-link w-full mt-1"><LogOut size={18} />{signingOut ? 'Signing out...' : 'Sign Out'}</button> : <Link className="btn btn-primary w-full mt-3" to="/login">Log In to Demo</Link>}
      </div>
    </aside>
    <div className="flex min-h-screen min-w-0 flex-col">
      <header className="workspace-topbar border-b px-4 sm:px-7">
        <div className="mx-auto flex min-h-[76px] max-w-[1440px] items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2"><button type="button" aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileOpen} aria-controls="mobile-navigation" onClick={() => setMobileOpen(!mobileOpen)} className="btn btn-quiet !p-2 lg:hidden">{mobileOpen ? <X /> : <Menu />}</button><Link to="/" className="lg:hidden" aria-label="Harani home"><HaraniLogo className="w-32 sm:w-36" /></Link><div className="hidden items-center gap-3 text-xs lg:flex"><span className="text-[#65745b]">{label}</span><ChevronRight size={13} className="text-sage-700" aria-hidden="true" /><span className="font-semibold text-green-900">{currentPage}</span></div></div>
          <div className="flex items-center gap-3 sm:gap-5">
            {user && currentRole !== 'admin' && <Link to={`/${currentRole}/notifications`} className="relative flex h-10 w-10 items-center justify-center rounded-full border border-sage-200 bg-ivory-50 text-green-900" aria-label={`Notifications, ${unread} unread`}><Bell size={18} />{unread > 0 && <span className="absolute -right-0.5 -top-1 min-w-4 rounded bg-yellow px-1 text-center text-[10px] font-bold text-black">{unread}</span>}</Link>}
            {user ? <Link to="/login" className="flex min-w-0 items-center gap-3 rounded-lg sm:border-l sm:border-sage-200 sm:pl-5" aria-label={`Switch demo account, currently ${user.full_name}`}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-sage-300 bg-sage-200 text-xs font-bold text-green-900">{initials}</span><span className="hidden sm:block"><span className="block max-w-40 truncate text-xs font-bold text-green-900">{user.full_name}</span><span className="mt-0.5 block text-[10px] text-[#596650]">Switch demo account</span></span></Link> : <Link to="/login" className="btn btn-secondary">Log In</Link>}
          </div>
        </div>
        {mobileOpen && <div id="mobile-navigation" className="border-t border-sage-200 py-4 lg:hidden" onKeyDown={(event) => { if (event.key === 'Escape') setMobileOpen(false); }}>{links}<Link to="/marketplace" className="workspace-link" onClick={() => setMobileOpen(false)}><ShoppingBasket size={18} />Browse marketplace</Link><Link to="/" className="workspace-link" onClick={() => setMobileOpen(false)}><Home size={18} />Return to Home</Link>{user && <button type="button" className="workspace-link w-full" disabled={signingOut} onClick={logout}><LogOut size={18} />Sign Out</button>}</div>}
      </header>
      <main id="main-content" className="mx-auto w-full min-w-0 max-w-[1500px] flex-1 px-4 py-6 sm:px-7 lg:px-8 lg:py-7">
        {(error || storageWarning) && <div className="mb-5"><Notice tone="error">{error || storageWarning}</Notice></div>}
        <Suspense fallback={<div className="panel p-8 text-sm text-black/60" role="status">Loading your workspace...</div>}><Outlet /></Suspense>
      </main>
      <footer className="mx-4 flex flex-wrap justify-between gap-2 border-t border-sage-200 py-5 text-[10px] leading-relaxed text-[#637057] sm:mx-7"><span>Harani &copy; {copyrightYear}</span><span>Frontend demo. No real authentication, money transfers, or identity verification.</span></footer>
    </div>
  </div>;
}
