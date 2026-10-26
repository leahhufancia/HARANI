import { ArrowUpRight, ClipboardCheck, Sprout } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState, Notice, PageHeader, StatStrip, StatusBadge } from '../../components/common/UI';
import useDemoData from '../../hooks/useDemoData';
import { getListings } from '../../services/produceService';
import { getReservations } from '../../services/reservationService';
import { dateTime, money, quantity, shortDate, urgencyLabel } from '../../utils/format';

export default function AdminDashboard() {
  const data = useDemoData();
  const listings = getListings(data);
  const reservations = getReservations(data);
  const profiles = new Map(data.profiles.map((profile) => [profile.id, profile]));
  const pendingReviews = data.verifications
    .filter((review) => review.status === 'pending')
    .sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
  const recentListings = [...listings]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 6);
  const completed = reservations.filter((reservation) => reservation.status === 'completed');
  const openReservations = reservations.filter((reservation) => ['pending', 'confirmed', 'ready'].includes(reservation.status));
  const availableListings = listings.filter((listing) => listing.status === 'active' && listing.farmer?.status === 'active');
  const farmers = data.profiles.filter((profile) => profile.role === 'farmer').length;
  const buyers = data.profiles.filter((profile) => profile.role === 'buyer').length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="A clearer view of the market."
        description="Review the queue, inspect listings and follow activity across the local demo."
        actions={<Link to="/admin/reports" className="btn btn-secondary">Activity reports <ArrowUpRight size={16} aria-hidden="true" /></Link>}
      />

      <StatStrip items={[
        { label: 'Registered accounts', value: data.profiles.length, detail: `${farmers} farmers / ${buyers} buyers` },
        { label: 'Available listings', value: availableListings.length, detail: 'Active stock from active sellers' },
        { label: 'Pending reviews', value: pendingReviews.length, detail: 'Demo profile submissions' },
        { label: 'Completed value', value: money(completed.reduce((total, reservation) => total + reservation.total_amount, 0)), detail: `${completed.length} completed handovers, not verified payments` },
      ]} />

      <Notice>This is a frontend-only, client-local demo. Profile reviews do not verify real identities, and transaction values are not proof of payment.</Notice>

      <section className="panel" aria-labelledby="pending-reviews-heading">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 p-4 sm:p-5">
          <div>
            <h2 id="pending-reviews-heading" className="text-base font-semibold">Pending profile reviews</h2>
            <p className="mt-1 text-xs text-black/60">Oldest submissions first. Showing {Math.min(pendingReviews.length, 5)} of {pendingReviews.length}.</p>
          </div>
          <Link to="/admin/verifications" className="btn btn-quiet">Review queue <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </div>
        {pendingReviews.length ? (
          <div className="table-wrap" role="region" aria-label="Pending profile reviews" tabIndex={0}>
            <table className="data-table min-w-[560px]">
              <caption className="sr-only">The five oldest pending demo profile submissions</caption>
              <thead><tr><th scope="col">Applicant</th><th scope="col">Submitted</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead>
              <tbody>
                {pendingReviews.slice(0, 5).map((review) => {
                  const profile = profiles.get(review.user_id);
                  return (
                    <tr key={review.id}>
                      <td><p className="font-semibold">{profile?.full_name || 'Profile unavailable'}</p><p className="mt-1 text-xs text-black/60">{profile?.seller_name || profile?.email || review.user_id}</p></td>
                      <td className="whitespace-nowrap">{dateTime(review.submitted_at)}</td>
                      <td><StatusBadge status={review.status} /></td>
                      <td><Link className="btn btn-quiet" to={`/admin/verifications?search=${encodeURIComponent(review.id)}`} aria-label={`Review submission for ${profile?.full_name || review.user_id}`}>Review <ArrowUpRight size={14} aria-hidden="true" /></Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={ClipboardCheck} title="The review queue is clear" description="New demo profile submissions will appear here." />}
      </section>

      <section className="panel" aria-labelledby="recent-listings-heading">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 p-4 sm:p-5">
          <div>
            <h2 id="recent-listings-heading" className="text-base font-semibold">Recent listings</h2>
            <p className="mt-1 text-xs text-black/60">Inspect produce details or open the moderation controls.</p>
          </div>
          <Link to="/admin/listings" className="btn btn-quiet">All listings <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </div>
        {recentListings.length ? (
          <div className="table-wrap" role="region" aria-label="Recent produce listings" tabIndex={0}>
            <table className="data-table min-w-[760px]">
              <caption className="sr-only">The six most recently created produce listings</caption>
              <thead><tr><th scope="col">Produce / seller</th><th scope="col">Available</th><th scope="col">Unit price</th><th scope="col">Deadline</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
              <tbody>
                {recentListings.map((listing) => (
                  <tr key={listing.id}>
                    <td><p className="font-semibold">{listing.produce_name}</p><p className="mt-1 text-xs text-black/60">{listing.farmer?.seller_name || listing.farmer?.full_name || 'Seller unavailable'}</p></td>
                    <td className="whitespace-nowrap">{quantity(listing.available_quantity)} {listing.unit}</td>
                    <td className="whitespace-nowrap">{money(listing.price_per_unit)} / {listing.unit}</td>
                    <td><p className="whitespace-nowrap">{shortDate(listing.selling_deadline)}</p><p className="mt-1 text-xs text-black/60">{urgencyLabel(listing.urgency)}</p></td>
                    <td><StatusBadge status={listing.status} />{listing.farmer?.status === 'suspended' && <p className="mt-1 text-xs text-black/60">Seller suspended</p>}</td>
                    <td><div className="flex items-center gap-1"><Link className="btn btn-quiet" to={`/marketplace/${listing.id}`} aria-label={`Inspect ${listing.produce_name}`}>Inspect</Link><Link className="btn btn-quiet" to={`/admin/listings?search=${encodeURIComponent(listing.id)}`} aria-label={`Moderate ${listing.produce_name}`}>Manage</Link></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={Sprout} title="No listings yet" description="Farmer listings from the shared demo will appear here." />}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4 text-sm">
        <p className="text-black/60">{openReservations.length} open reservations across the demo.</p>
        <Link to="/admin/transactions" className="btn btn-secondary">Inspect reservations <ArrowUpRight size={15} aria-hidden="true" /></Link>
      </div>
    </div>
  );
}
