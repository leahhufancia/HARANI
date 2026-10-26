import { Link } from 'react-router-dom';
import { ArrowUpRight, MapPin } from 'lucide-react';
import ProduceImage from './ProduceImage';
import { StatusBadge } from '../common/UI';
import { money, quantity, shortDate } from '../../utils/format';

export default function ProductCard({ listing }) {
  return <article className="group overflow-hidden rounded-xl border border-sage-200 bg-white shadow-sm transition-shadow hover:shadow-md">
    <Link to={`/marketplace/${listing.id}`} tabIndex={-1} aria-hidden="true" className="relative block">
      <ProduceImage src={listing.image_url} alt={listing.produce_name} className="aspect-[4/3] w-full" />
      <div className="absolute left-3 top-3 rounded-sm bg-white/95 backdrop-blur-sm shadow-sm"><StatusBadge status={listing.urgency} /></div>
    </Link>
    <div className="p-4"><p className="mb-1 text-xs text-black/55">{listing.category}</p><h3 className="text-lg font-semibold"><Link to={`/marketplace/${listing.id}`}>{listing.produce_name}</Link></h3>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2"><p><strong className="text-xl font-bold tracking-tight text-green-700">{money(listing.price_per_unit)}</strong><span className="text-sm text-black/55"> / {listing.unit}</span></p><span className="text-sm font-medium text-sage-700">{quantity(listing.available_quantity)} {listing.unit} left</span></div>
      <p className="mt-3 flex items-start gap-1.5 text-sm text-black/60"><MapPin size={15} className="mt-1 shrink-0 text-sage-600" />{listing.pickup_location}</p>
      {listing.harvest_date && <p className="mt-1 text-xs text-black/55">Harvested {shortDate(listing.harvest_date)}</p>}
      <Link to={`/marketplace/${listing.id}`} className="mt-4 flex min-h-11 items-center justify-between border-t border-sage-200 pt-3 text-sm font-semibold text-green-700 hover:text-green-800">View Produce <ArrowUpRight size={18} /></Link>
    </div>
  </article>;
}
