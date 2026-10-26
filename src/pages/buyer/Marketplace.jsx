import { useDeferredValue, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, Sprout, X } from 'lucide-react';
import ProductCard from '../../components/marketplace/ProductCard';
import { EmptyState, Notice, PageHeader } from '../../components/common/UI';
import useDemoData from '../../hooks/useDemoData';
import { CATEGORIES, UNITS, filterListings, getListings } from '../../services/produceService';

export default function Marketplace() {
  const data = useDemoData();
  const [params, setParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const search = params.get('q') || '';
  const deferredSearch = useDeferredValue(search);
  const filters = { search: deferredSearch, category: params.get('category') || '', minPrice: params.get('minPrice') || '', maxPrice: params.get('maxPrice') || '', minQuantity: params.get('minQuantity') || '', unit: params.get('unit') || '', urgency: params.get('urgency') || '', fulfillment: params.get('fulfillment') || '', sort: params.get('sort') || 'recent' };
  const activeFilters = ['category', 'minPrice', 'maxPrice', 'minQuantity', 'unit', 'urgency', 'fulfillment'].filter((key) => filters[key] !== '').length;
  const invalid = [filters.minPrice, filters.maxPrice, filters.minQuantity].some((value) => value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0)) || (filters.minPrice !== '' && filters.maxPrice !== '' && Number(filters.maxPrice) < Number(filters.minPrice));
  const listings = invalid ? [] : filterListings(getListings(data), filters);
  const setFilter = (key, value) => setParams((current) => { const next = new URLSearchParams(current); if (value) next.set(key, value); else next.delete(key); return next; }, { replace: true });

  return <div>
    <PageHeader eyebrow="Good food starts close to home" title="Marketplace" description="Fresh local produce from Naga City farmers, fairer prices, and just the quantity you need." />
    <div className="surface-ivory mb-6 flex items-start gap-3 rounded-lg border px-4 py-3"><Sprout size={20} className="mt-0.5 shrink-0 text-green-700" /><p className="text-sm"><strong className="font-semibold">Explore the local demo.</strong> Sample farmers, produce, and prices help you try the full journey. Listings you add are saved only in this browser.</p></div>
    <section aria-label="Search and filter produce" className="filter-panel mb-6">
      <div className="flex flex-wrap gap-3"><div className="relative min-w-0 flex-1 basis-60"><label htmlFor="produce-search" className="sr-only">Search produce by name</label><Search size={18} className="pointer-events-none absolute left-3.5 top-3.5 text-black/45" /><input id="produce-search" type="search" className="input !pl-11" placeholder="What are you looking for?" value={search} onChange={(event) => setFilter('q', event.target.value)} /></div><button type="button" className="btn btn-secondary" aria-expanded={showFilters} aria-controls="produce-filters" onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal />Filters{activeFilters > 0 && <span className="rounded bg-yellow/25 px-1.5">{activeFilters}</span>}</button></div>
      <div className="mt-4 flex flex-wrap gap-2" aria-label="Produce categories">{['', ...CATEGORIES].map((category) => <button type="button" key={category} aria-pressed={filters.category === category} onClick={() => setFilter('category', category)} className={`min-h-10 rounded-sm border px-3 text-sm ${filters.category === category ? 'border-green bg-green text-white' : 'border-sage-200 bg-white text-sage-700 hover:border-sage-400 hover:bg-sage-50'}`}>{category || 'All produce'}</button>)}</div>
      {showFilters && <div id="produce-filters" className="panel surface-ivory mt-4 grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <div><label className="label" htmlFor="min-price">Minimum price / unit (PHP)</label><input id="min-price" type="number" min="0" step="0.01" className="input" placeholder="Any" value={filters.minPrice} onChange={(event) => setFilter('minPrice', event.target.value)} /></div>
        <div><label className="label" htmlFor="max-price">Maximum price / unit (PHP)</label><input id="max-price" type="number" min="0" step="0.01" className="input" placeholder="Any" value={filters.maxPrice} onChange={(event) => setFilter('maxPrice', event.target.value)} /></div>
        <div><label className="label" htmlFor="min-quantity">Minimum available quantity</label><input id="min-quantity" type="number" min="0" step="0.01" className="input" placeholder="Any" value={filters.minQuantity} onChange={(event) => setFilter('minQuantity', event.target.value)} /></div>
        <div><label className="label" htmlFor="filter-unit">Quantity unit</label><select id="filter-unit" className="input" value={filters.unit} onChange={(event) => setFilter('unit', event.target.value)}><option value="">Any listing unit</option>{UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select></div>
        <div><label className="label" htmlFor="filter-urgency">Selling urgency</label><select id="filter-urgency" className="input" value={filters.urgency} onChange={(event) => setFilter('urgency', event.target.value)}><option value="">Any urgency</option><option value="sell-now">Sell Now</option><option value="sell-today">Sell Today</option><option value="planned">Planned Surplus</option></select></div>
        <div><label className="label" htmlFor="filter-fulfillment">Fulfillment</label><select id="filter-fulfillment" className="input" value={filters.fulfillment} onChange={(event) => setFilter('fulfillment', event.target.value)}><option value="">Pickup or delivery</option><option value="pickup">Pickup available</option><option value="delivery">Delivery available</option></select></div>
        <p className="self-end pb-1 text-xs leading-relaxed text-black/55 sm:col-span-2">Prices are per listing unit. Select the same unit to compare like for like. Distance sorting is not offered because precise locations have not been collected.</p>
      </div>}
    </section>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-3"><p aria-live="polite" className="text-sm text-black/60">{listings.length} {listings.length === 1 ? 'harvest' : 'harvests'} available</p>{(activeFilters > 0 || search) && <button type="button" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold underline underline-offset-4" onClick={() => setParams({})}><X size={14} />Clear filters</button>}</div><div className="flex items-center gap-2"><label htmlFor="produce-sort" className="text-sm text-black/60">Sort by</label><select id="produce-sort" className="input !w-auto !min-w-0" value={filters.sort} onChange={(event) => setFilter('sort', event.target.value)}><option value="recent">Recently listed</option><option value="price-low">Lowest price</option><option value="price-high">Highest price</option><option value="soonest">Selling soonest</option></select></div></div>
    {invalid && <div className="mb-5"><Notice tone="error">Use non-negative numbers and a maximum price greater than or equal to the minimum price.</Notice></div>}
    {listings.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-busy={search !== deferredSearch}>{listings.map((listing) => <ProductCard key={listing.id} listing={listing} />)}</div> : <EmptyState icon={Search} title="No harvests match just yet" description="Try a different produce name, widen your price range, or clear the filters." action={<button type="button" className="btn btn-secondary" onClick={() => setParams({})}>Clear all filters</button>} />}
  </div>;
}
