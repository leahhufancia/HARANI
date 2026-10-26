import { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useParams } from 'react-router-dom';
import { AuthProvider } from './context/AuthProvider';
import PublicLayout from './layouts/PublicLayout';
import FarmerLayout from './layouts/FarmerLayout';
import BuyerLayout from './layouts/BuyerLayout';
import AdminLayout from './layouts/AdminLayout';

// Public pages
import LandingPage from './pages/public/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import OnboardingPage from './pages/auth/OnboardingPage';
import ErrorBoundary from './components/common/ErrorBoundary';
import RouteEffects from './components/common/RouteEffects';

// Farmer pages
const FarmerDashboard = lazy(() => import('./pages/farmer/FarmerDashboard'));
const MyHarvest = lazy(() => import('./pages/farmer/MyHarvest'));
const AddProduce = lazy(() => import('./pages/farmer/AddProduce'));
const FarmerReservations = lazy(() => import('./pages/farmer/FarmerReservations'));
const SalesHandover = lazy(() => import('./pages/farmer/SalesHandover'));
const FarmerNotifications = lazy(() => import('./pages/farmer/FarmerNotifications'));
const FarmerProfile = lazy(() => import('./pages/farmer/FarmerProfile'));

// Buyer pages
import Marketplace from './pages/buyer/Marketplace';
const ProduceDetails = lazy(() => import('./pages/buyer/ProduceDetails'));
const BuyerReservations = lazy(() => import('./pages/buyer/BuyerReservations'));
const BuyerPurchases = lazy(() => import('./pages/buyer/BuyerPurchases'));
const BuyerNotifications = lazy(() => import('./pages/buyer/BuyerNotifications'));
const BuyerProfile = lazy(() => import('./pages/buyer/BuyerProfile'));

// Admin pages
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const UserManagement = lazy(() => import('./pages/admin/UserManagement'));
const AccountVerification = lazy(() => import('./pages/admin/AccountVerification'));
const ListingOversight = lazy(() => import('./pages/admin/ListingOversight'));
const ReservationOversight = lazy(() => import('./pages/admin/ReservationOversight'));
const ActivityReports = lazy(() => import('./pages/admin/ActivityReports'));
const AuditHistory = lazy(() => import('./pages/admin/AuditHistory'));

function App() {
  return (
    <ErrorBoundary><BrowserRouter>
      <AuthProvider>
        <RouteEffects />
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<PublicLayout />}>
            <Route index element={<LandingPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="onboarding" element={<OnboardingPage />} />
          </Route>

          <Route element={<BuyerLayout publicBrowse />}>
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/marketplace/:productId" element={<ProduceDetails />} />
          </Route>

          {/* Farmer routes */}
          <Route path="/farmer" element={<FarmerLayout />}>
            <Route index element={<Navigate to="/farmer/dashboard" replace />} />
            <Route path="dashboard" element={<FarmerDashboard />} />
            <Route path="harvest" element={<MyHarvest />} />
            <Route path="add-produce" element={<AddProduce />} />
            <Route path="harvest/:id/edit" element={<AddProduce />} />
            <Route path="reservations" element={<FarmerReservations />} />
            <Route path="sales" element={<SalesHandover />} />
            <Route path="sales-handover" element={<Navigate to="/farmer/sales" replace />} />
            <Route path="notifications" element={<FarmerNotifications />} />
            <Route path="profile" element={<FarmerProfile />} />
          </Route>

          {/* Buyer routes */}
          <Route path="/buyer" element={<BuyerLayout />}>
            <Route index element={<Navigate to="/marketplace" replace />} />
            <Route path="reservations" element={<BuyerReservations />} />
            <Route path="purchases" element={<BuyerPurchases />} />
            <Route path="notifications" element={<BuyerNotifications />} />
            <Route path="profile" element={<BuyerProfile />} />
          </Route>
          <Route path="/buyer/marketplace" element={<Navigate to="/marketplace" replace />} />
          <Route path="/buyer/produce/:id" element={<LegacyProduceRedirect />} />

          {/* Admin routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="verifications" element={<AccountVerification />} />
            <Route path="verification" element={<Navigate to="/admin/verifications" replace />} />
            <Route path="listings" element={<ListingOversight />} />
            <Route path="transactions" element={<ReservationOversight />} />
            <Route path="reservations" element={<Navigate to="/admin/transactions" replace />} />
            <Route path="reports" element={<ActivityReports />} />
            <Route path="audit" element={<AuditHistory />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter></ErrorBoundary>
  );
}

function LegacyProduceRedirect() {
  const { id } = useParams();
  return <Navigate to={`/marketplace/${id}`} replace />;
}

function NotFound() {
  return <main className="mx-auto max-w-xl px-6 py-24"><p className="eyebrow mb-3">404 / Page not found</p><h1 className="text-3xl">This path is not in the harvest.</h1><p className="my-5 text-black/60">The page may have moved, but there is still produce to explore.</p><div className="flex flex-wrap gap-3"><Link to="/" className="btn btn-secondary">Return to Home</Link><Link to="/marketplace" className="btn btn-primary">Find Produce</Link></div></main>;
}

export default App;
