import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, MapPin } from 'lucide-react';
import ProduceImage from './ProduceImage';
import { StatusBadge } from '../common/UI';
import { dateTime, money, quantity, shortDate } from '../../utils/format';
import { distanceLabel } from '../../utils/location';
import AddToCart from '../cart/AddToCart';

export default function ProductCard({ listing }) {
  const navigate = useNavigate();
  const location = useLocation();
  const productPath = `/marketplace/${listing.id}`;
  const detailsState = { marketplaceSearch: location.pathname === '/marketplace' ? location.search : '' };
  const publicPickup = listing.pickup_location_public === true ? listing.pickup_location || listing.pickup_barangay || '' : '';
  return <article id={`produce-${listing.id}`} data-listing-id={listing.id} aria-label={listing.produce_name}
    onClick={(event) => { if (!event.defaultPrevented && !event.ctrlKey && !event.metaKey && !event.target.closest('a, button, input, select, textarea, label') && !window.getSelection()?.toString()) navigate(productPath, { state: detailsState }); }}
    className="marketplace-product group relative flex h-full flex-col overflow-hidden rounded-xl border border-sage-200 bg-white shadow-sm transition-shadow hover:shadow-md">
    <Link to={productPath} state={detailsState} tabIndex={-1} aria-hidden="true" className="relative block">
      <ProduceImage src={listing.image_url} alt={listing.produce_name} className="aspect-[4/3] w-full" />
      <div className="absolute left-3 top-3 rounded-sm bg-white/95 backdrop-blur-sm shadow-sm"><StatusBadge status={listing.urgency} /></div>
    </Link>
    <div className="flex flex-1 flex-col p-4"><p className="mb-1 text-xs text-black/55">{listing.category}</p><h3 className="text-lg font-semibold"><Link to={productPath} state={detailsState}>{listing.produce_name}</Link></h3>
      <p className="mt-1 text-xs text-black/60">{listing.farmer?.seller_name || 'Local farmer'}</p>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2"><p><strong className="text-xl font-bold tracking-tight text-green-700">{money(listing.price_per_unit)}</strong><span className="text-sm text-black/55"> / {listing.unit}</span></p><span className="text-sm font-medium text-sage-700">{quantity(listing.available_quantity)} {listing.unit} left</span></div>
      <p className="mt-3 flex items-start gap-1.5 text-sm text-black/60"><MapPin size={15} className="mt-1 shrink-0 text-sage-600" />{publicPickup ? <Link to={`${productPath}#pickup-location`} state={detailsState} className="hover:underline">{publicPickup}</Link> : 'Pickup location not provided'}</p>
      {distanceLabel(listing) && <p className="mt-2 text-sm font-semibold text-green-800">{distanceLabel(listing)}</p>}
      {listing.harvest_date && <p className="mt-2 text-xs text-black/55">Harvested {shortDate(listing.harvest_date)}</p>}
      {listing.selling_deadline && <p className="mt-1 text-xs text-black/65">Available until {dateTime(listing.selling_deadline)}</p>}
      <div className="mt-auto"><AddToCart listing={listing} /></div>
      <Link to={productPath} state={detailsState} className="btn btn-primary mt-4 w-full">View Product <ArrowUpRight size={18} /></Link>
    </div>
  </article>;
}
