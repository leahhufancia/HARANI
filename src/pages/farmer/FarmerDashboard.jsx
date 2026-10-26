import { useEffect, useState } from 'react';
import { ArrowUpRight, CalendarClock, Plus, Sprout } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useDemoData from '../../hooks/useDemoData';
import { getListings } from '../../services/produceService';
import { getReservations } from '../../services/reservationService';
import { getUserNotifications } from '../../services/notificationService';
import { dateTime, money, quantity, urgencyLabel } from '../../utils/format';
import { EmptyState, PageHeader, StatStrip, StatusBadge } from '../../components/common/UI';
import ProduceImage from '../../components/marketplace/ProduceImage';

export default function FarmerDashboard() {
  const { user } = useAuth();
  const data = useDemoData();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const listings = getListings(data).filter((listing) => listing.farmer_id === user?.id);
  const reservations = user ? getReservations(data, { farmerId: user.id }) : [];
  const active = listings.filter((listing) => ['active', 'reserved'].includes(listing.status));
  const pending = reservations.filter((reservation) => reservation.status === 'pending');
  const completed = reservations.filter((reservation) => reservation.status === 'completed');
  const quantities = active.reduce((totals, listing) => {
    if (listing.available_quantity > 0) totals[listing.unit] = (totals[listing.unit] || 0) + listing.available_quantity;
    return totals;
  }, {});
  const available = Object.entries(quantities).map(([unit, total]) => `${quantity(total)} ${unit}`).join(' / ');
  const deadlines = active.filter((listing) => Date.parse(listing.selling_deadline) - now <= 24 * 3600000)
    .sort((a, b) => Date.parse(a.selling_deadline) - Date.parse(b.selling_deadline)).slice(0, 4);
  const actionable = reservations.filter((reservation) => ['pending', 'confirmed', 'ready'].includes(reservation.status))
    .sort((a, b) => Date.parse(a.expires_at) - Date.parse(b.expires_at)).slice(0, 5);
  const activity = user ? getUserNotifications(data, user.id).slice(0, 5) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Farmer workspace"
        title={`Your harvest, ${user?.full_name?.split(' ')[0] || 'your way'}.`}
        description="A little less surplus. A little more opportunity. Here is your farm at a glance."
        colored
        actions={<Link className="btn btn-primary" to="/farmer/add-produce"><Plus size={18} aria-hidden="true" /> Add Produce</Link>}
      />
      <StatStrip colored items={[
        { label: 'Active listings', value: active.length, detail: `${active.filter((listing) => listing.status === 'reserved').length} fully reserved` },
        { label: 'Available harvest', value: available || 'None available', detail: 'Quantities kept separate by unit' },
        { label: 'Pending requests', value: pending.length, detail: 'Waiting for your confirmation' },
        { label: 'Completed sales', value: completed.length, detail: `${money(completed.reduce((sum, item) => sum + (Number(item.total_amount) || 0), 0))} agreed value, not payment confirmation` },
      ]} />

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="panel p-5 sm:p-6 bg-section-soft" aria-labelledby="deadline-heading">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 id="deadline-heading" className="flex items-center gap-2 text-lg font-semibold"><CalendarClock size={20} aria-hidden="true" /> Selling soon</h2>
            <Link className="btn btn-quiet" to="/farmer/harvest">My Harvest <ArrowUpRight size={16} aria-hidden="true" /></Link>
          </div>
          {deadlines.length ? (
            <ul className="divide-y divide-black/10">
              {deadlines.map((listing) => (
                <li key={listing.id} className="flex items-center gap-3 py-4 first:pt-0 last:pb-0">
                  <ProduceImage src={listing.image_url} alt={listing.produce_name} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <Link className="font-semibold hover:underline" to={`/marketplace/${listing.id}`}>{listing.produce_name}</Link>
                    <p className="text-sm text-black/60">{quantity(listing.available_quantity)} {listing.unit} available / {urgencyLabel(listing.urgency)}</p>
                    <p className="text-xs text-black/60">Closes {dateTime(listing.selling_deadline)}</p>
                  </div>
                  <Link className="btn btn-secondary" to={`/farmer/harvest/${listing.id}/edit`} aria-label={`Edit ${listing.produce_name}`}>Review</Link>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={Sprout} title="Room to grow" description="No active listings reach their deadline in the next 24 hours." action={<Link className="btn btn-secondary" to="/farmer/add-produce">List your harvest</Link>} />}
        </section>

        <section className="panel p-5 sm:p-6 bg-section-yellow" aria-labelledby="requests-heading">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 id="requests-heading" className="text-lg font-semibold">Your next handovers</h2>
            <Link className="btn btn-quiet" to="/farmer/reservations">All reservations <ArrowUpRight size={16} aria-hidden="true" /></Link>
          </div>
          {actionable.length ? (
            <ul className="divide-y divide-black/10">
              {actionable.map((reservation) => (
                <li key={reservation.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="font-semibold">{reservation.produce_name}</p>
                    <p className="text-sm text-black/60">{reservation.buyer?.full_name || 'Buyer'} / {quantity(reservation.quantity)} {reservation.unit}</p>
                    <p className="text-xs text-black/60">Expires {dateTime(reservation.expires_at)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={reservation.status} />
                    <Link className="btn btn-secondary" to={`/farmer/${reservation.status === 'ready' ? 'sales' : 'reservations'}?reservation=${encodeURIComponent(reservation.id)}`} aria-label={`Review reservation ${reservation.reservation_reference}`}>Review</Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="All caught up" description="New requests and upcoming handovers will appear here." />}
        </section>
      </div>

      <section className="panel p-5 sm:p-6 bg-section-mint" aria-labelledby="activity-heading">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="activity-heading" className="text-lg font-semibold">From your farm</h2>
          <Link className="btn btn-quiet" to="/farmer/notifications">All activity <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>
        {activity.length ? (
          <ul className="divide-y divide-black/10">
            {activity.map((notification) => (
              <li key={notification.id} className="py-4 first:pt-0 last:pb-0">
                <Link className="block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4" to={notification.link || '/farmer/notifications'}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{notification.title}</p>
                    <time className="text-xs text-black/60" dateTime={notification.created_at}>{dateTime(notification.created_at)}</time>
                  </div>
                  <p className="mt-1 text-sm text-black/60">{notification.message}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-black/60">Your account notifications will appear here as your harvest moves.</p>}
      </section>
    </div>
  );
}
