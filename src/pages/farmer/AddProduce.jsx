import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Camera, MapPin, Sprout } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useDemoData from '../../hooks/useDemoData';
import { CATEGORIES, UNITS, createListing, getListingById, relistListing, updateListing } from '../../services/produceService';
import { dateTime, money, quantity, shortDate, urgencyLabel } from '../../utils/format';
import { EmptyState, Notice, PageHeader } from '../../components/common/UI';
import ProduceImage from '../../components/marketplace/ProduceImage';
import { getCoordinates } from '../../utils/location';

function localDateTime(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
}

function Field({ name, label, error, hint, children }) {
  return (
    <div className="min-w-0">
      <label className="label" htmlFor={name}>{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-black/60">{hint}</p>}
      {error && <p className="field-error" id={`${name}-error`}>{error}</p>}
    </div>
  );
}

export default function AddProduce() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const data = useDemoData();
  const relisting = Boolean(id && params.get('relist') === '1');
  const listing = id ? getListingById(data, id) : null;
  const activeReservations = id ? data.reservations.filter((reservation) => reservation.listing_id === id && ['pending', 'confirmed', 'ready'].includes(reservation.status)) : [];
  const editable = listing && listing.farmer_id === user?.id && (relisting
    ? ['expired', 'withdrawn'].includes(listing.status) && listing.reserved_quantity === 0 && listing.available_quantity > 0
    : ['active', 'reserved'].includes(listing.status));

  if (id && !editable) {
    return <div className="space-y-6"><PageHeader eyebrow="Farmer workspace" title={relisting ? 'Post Again' : 'Edit produce'} /><div className="panel"><EmptyState icon={Sprout} title="This harvest cannot be edited here" description="Check that it belongs to your account and is active. Only expired or withdrawn produce with unsold stock and no open reservations can be relisted. Moderated listings cannot be relisted." action={<Link className="btn btn-secondary" to="/farmer/harvest">Back to My Produce</Link>} /></div></div>;
  }

  return <ProduceForm key={`${user?.id}-${id || 'new'}-${relisting}`} user={user} listing={listing} relisting={relisting} activeReservations={activeReservations} />;
}

function ProduceForm({ user, listing, relisting, activeReservations }) {
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const [values, setValues] = useState(() => ({
    produce_name: listing?.produce_name || '',
    category: listing?.category || '',
    condition_details: listing?.condition_details || '',
    harvest_date: listing?.harvest_date || '',
    listed_quantity: listing?.listed_quantity ?? '',
    unit: listing?.unit || 'kg',
    price_per_unit: listing?.price_per_unit ?? '',
    pickup_location: listing?.pickup_location || user?.location || '',
    pickup_latitude: listing?.pickup_latitude ?? '',
    pickup_longitude: listing?.pickup_longitude ?? '',
    urgency: listing?.urgency || 'planned',
    selling_deadline: localDateTime(listing && !relisting ? listing.selling_deadline : Date.now() + 24 * 3600000),
    pickup_available: listing?.pickup_available ?? true,
    delivery_available: listing?.delivery_available ?? false,
    delivery_fee: listing?.delivery_fee ?? 0,
    image_url: listing?.image_url || '',
  }));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [readingImage, setReadingImage] = useState(false);
  const busyRef = useRef(false);
  const imageReadRef = useRef(0);
  const formRef = useRef(null);
  const fileRef = useRef(null);
  const lockedDetails = activeReservations.length > 0;
  const lockedUnit = Number(listing?.reserved_quantity || 0) + Number(listing?.sold_quantity || 0) > 0;
  const committedQuantity = Number(listing?.reserved_quantity || 0) + Number(listing?.sold_quantity || 0);
  const latestExpiry = Math.max(0, ...activeReservations.map((reservation) => Date.parse(reservation.expires_at)));
  const today = localDateTime(now).slice(0, 10);
  const previewAvailable = Math.max(0, (Number(values.listed_quantity) || 0) - committedQuantity);
  const title = relisting ? 'A fresh start for your harvest' : listing ? 'Edit your harvest' : 'Post your harvest';

  function change(event) {
    const { name, type, value, checked } = event.target;
    setValues((previous) => ({ ...previous, [name]: type === 'checkbox' ? checked : value }));
    setErrors((previous) => ({ ...previous, [name]: undefined, ...(name.endsWith('_available') ? { fulfillment: undefined } : {}) }));
    setError('');
  }

  function inputProps(name) {
    return { id: name, name, value: values[name], onChange: change, 'aria-invalid': Boolean(errors[name]), 'aria-describedby': errors[name] ? `${name}-error` : undefined };
  }

  async function chooseImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setErrors((previous) => ({ ...previous, image_url: undefined }));
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 1024 * 1024 || file.size === 0) {
      setErrors((previous) => ({ ...previous, image_url: 'Choose a JPG, PNG, or WebP image no larger than 1 MB.' }));
      event.target.value = '';
      return;
    }
    const request = ++imageReadRef.current;
    setReadingImage(true);
    try {
      const image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('This image could not be read. Try another file.'));
        reader.onabort = () => reject(new Error('Image selection was interrupted. Choose a photo again.'));
        reader.readAsDataURL(file);
      });
      if (request === imageReadRef.current) setValues((previous) => ({ ...previous, image_url: image }));
    } catch (error) {
      if (request === imageReadRef.current) setErrors((previous) => ({ ...previous, image_url: error.message }));
    } finally {
      if (request === imageReadRef.current) setReadingImage(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (busyRef.current || readingImage) return;
    const next = {};
    const name = values.produce_name.trim();
    const location = values.pickup_location.trim();
    const count = Number(values.listed_quantity);
    // The minute-precision input must not shorten an unchanged reservation deadline by its stored seconds.
    const deadline = Date.parse(listing && !relisting && values.selling_deadline === localDateTime(listing.selling_deadline) ? listing.selling_deadline : values.selling_deadline);
    if (name.length < 2 || name.length > 100) next.produce_name = 'Enter a produce name of 2 to 100 characters.';
    if (!CATEGORIES.includes(values.category)) next.category = 'Choose a produce category.';
    if (!UNITS.includes(values.unit)) next.unit = 'Choose a supported unit.';
    if (!location || location.length > 200) next.pickup_location = 'Enter a general pickup location of up to 200 characters.';
    if ([values.pickup_latitude, values.pickup_longitude].some((value) => String(value).trim() !== '') && !getCoordinates(values.pickup_latitude, values.pickup_longitude)) {
      next.pickup_latitude = 'Use a latitude from -90 to 90.';
      next.pickup_longitude = 'Use a longitude from -180 to 180. Both coordinates are needed.';
    }
    if (values.condition_details.length > 1500) next.condition_details = 'Keep condition details within 1,500 characters.';
    for (const [field, label] of [['listed_quantity', 'Quantity'], ['price_per_unit', 'Price'], ...(values.delivery_available ? [['delivery_fee', 'Delivery cost']] : [])]) {
      const number = Number(values[field]);
      if (values[field] === '' || !Number.isFinite(number) || number < 0 || number > 1000000 || (field === 'listed_quantity' && number === 0)) {
        next[field] = `${label} must be ${field === 'listed_quantity' ? 'greater than zero' : 'zero or greater'}, up to 1,000,000.`;
      } else if (Math.abs(Math.round(number * 100) / 100 - number) > 0.0000001) {
        next[field] = `${label} can have up to two decimal places.`;
      }
    }
    if (Number.isFinite(count) && count < committedQuantity) next.listed_quantity = `Keep at least ${quantity(committedQuantity)} ${values.unit} to cover reserved and sold produce.`;
    if (relisting && count <= Number(listing.sold_quantity)) next.listed_quantity = 'Relisting needs some unsold produce above the quantity already sold.';
    if (!Number.isFinite(deadline) || deadline <= Date.now()) next.selling_deadline = 'Choose a future selling date and time.';
    else if (deadline < latestExpiry) next.selling_deadline = `Keep the deadline on or after ${dateTime(new Date(latestExpiry).toISOString())} for existing reservations.`;
    if (values.harvest_date && (!Number.isFinite(Date.parse(values.harvest_date)) || values.harvest_date > today || Date.parse(values.harvest_date) > deadline)) next.harvest_date = 'Harvest date must be valid, not in the future, and no later than the selling deadline.';
    if (!values.pickup_available && !values.delivery_available) next.fulfillment = 'Offer pickup, delivery, or both.';
    if (errors.image_url) next.image_url = errors.image_url;
    setErrors(next);
    setError('');
    if (Object.keys(next).length) {
      setError('Review the highlighted fields before continuing.');
      requestAnimationFrame(() => {
        const field = formRef.current?.querySelector('[aria-invalid="true"]');
        const details = field?.closest('details');
        if (details) details.open = true;
        field?.focus();
      });
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const input = {
        ...values, produce_name: name, pickup_location: location,
        listed_quantity: count, price_per_unit: Number(values.price_per_unit),
        delivery_fee: values.delivery_available ? Number(values.delivery_fee) : 0,
        selling_deadline: new Date(deadline).toISOString(),
      };
      if (relisting) await relistListing(listing.id, user.id, input);
      else if (listing) await updateListing(listing.id, user.id, input);
      else await createListing(user.id, input);
      navigate('/farmer/harvest', { state: { notice: `${name} ${relisting ? 'relisted' : listing ? 'updated' : 'published'} successfully in this local demo.` } });
    } catch (error) {
      setError(error.message || 'Your listing could not be saved. Your form is still here; please try again.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Farmer workspace" title={title} description="Tell nearby buyers what is ready, what it costs, and how to collect it. All changes stay in this browser demo." colored actions={<Link className="btn btn-quiet" to="/farmer/harvest">Back to My Harvest</Link>} />
      {error && <Notice tone="error">{error}</Notice>}
      {listing && <Notice>Existing reservations keep their agreed price, quantity, and collection details. Total listed stock includes {quantity(listing.reserved_quantity)} {listing.unit} reserved and {quantity(listing.sold_quantity)} {listing.unit} sold.{lockedDetails ? ' Produce name and pickup location are locked while reservations are open.' : ''}{lockedUnit ? ' The unit cannot change after a reservation or sale.' : ''}</Notice>}
      <form ref={formRef} onSubmit={submit} noValidate className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <fieldset disabled={busy} className="min-w-0 space-y-6">
          <legend className="sr-only">Produce listing details</legend>
          <section className="panel p-5 sm:p-6 bg-section-soft" aria-labelledby="produce-details-heading">
            <h2 id="produce-details-heading" className="mb-5 text-lg font-semibold">01 / The harvest</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field name="produce_name" label="Produce name *" error={errors.produce_name}><input {...inputProps('produce_name')} className="input w-full" type="text" required maxLength={100} disabled={lockedDetails} placeholder="e.g. Fresh tomatoes" /></Field>
              <Field name="category" label="Category *" error={errors.category}><select {...inputProps('category')} className="input w-full" required><option value="">Select category</option>{CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></Field>
              <Field name="harvest_date" label="Harvest date" error={errors.harvest_date} hint="Optional. Only use a date that has already occurred."><input {...inputProps('harvest_date')} className="input w-full" type="date" max={today} /></Field>
              <Field name="condition_details" label="Condition details" error={errors.condition_details} hint="Describe ripeness, size, or visible imperfections."><textarea {...inputProps('condition_details')} className="input w-full" rows={3} maxLength={1500} placeholder="e.g. Ripe, mixed sizes, picked this morning" /></Field>
            </div>
            <div className="mt-5 rounded-xl border border-dashed border-black/20 p-4">
              <label className="label flex items-center gap-2" htmlFor="produce-photo"><Camera size={18} aria-hidden="true" /> Produce photo (optional)</label>
              <p className="mb-3 text-xs text-black/60">JPG, PNG, or WebP, up to 1 MB. Stored locally in this browser, not uploaded to a server.</p>
              <input ref={fileRef} id="produce-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} disabled={readingImage} aria-invalid={Boolean(errors.image_url)} aria-describedby={errors.image_url ? 'image_url-error' : undefined} className="input w-full text-sm" />
              {readingImage && <p className="mt-2 text-sm" role="status">Reading your photo...</p>}
              {errors.image_url && <p className="field-error" id="image_url-error">{errors.image_url}</p>}
              {values.image_url && <button type="button" className="btn btn-quiet mt-2" disabled={readingImage} onClick={() => { setValues((previous) => ({ ...previous, image_url: '' })); setErrors((previous) => ({ ...previous, image_url: undefined })); if (fileRef.current) fileRef.current.value = ''; }}>Remove photo</button>}
              {!values.image_url && errors.image_url && <button type="button" className="btn btn-quiet mt-2" onClick={() => { setErrors((previous) => ({ ...previous, image_url: undefined })); if (fileRef.current) fileRef.current.value = ''; }}>Continue without a photo</button>}
            </div>
          </section>

          <section className="panel p-5 sm:p-6 bg-section-yellow" aria-labelledby="quantity-heading">
            <h2 id="quantity-heading" className="mb-5 text-lg font-semibold">02 / Quantity & price</h2>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field name="listed_quantity" label="Total listed quantity *" error={errors.listed_quantity} hint={listing ? 'Includes stock already reserved and sold.' : 'Buyers can reserve part of this stock.'}><input {...inputProps('listed_quantity')} className="input w-full" type="number" inputMode="decimal" min="0.01" max="1000000" step="0.01" required placeholder="50" /></Field>
              <Field name="unit" label="Unit *" error={errors.unit}><select {...inputProps('unit')} className="input w-full" required disabled={lockedUnit}>{UNITS.map((unit) => <option key={unit} value={unit}>{({ kg: 'Kilogram (kg)', g: 'Gram (g)', bundle: 'Bundle', piece: 'Piece', crate: 'Crate' })[unit]}</option>)}</select></Field>
              <Field name="price_per_unit" label="Price per unit (PHP) *" error={errors.price_per_unit}><input {...inputProps('price_per_unit')} className="input w-full" type="number" inputMode="decimal" min="0" max="1000000" step="0.01" required placeholder="30.00" /></Field>
            </div>
          </section>

          <section className="panel p-5 sm:p-6 bg-section-mint" aria-labelledby="selling-heading">
            <h2 id="selling-heading" className="mb-5 text-lg font-semibold">03 / Timing & collection</h2>
            <div className="space-y-5">
              <Field name="pickup_location" label="General pickup location *" error={errors.pickup_location} hint="Use a barangay or public meeting point in Naga City. Avoid private or sensitive details."><input {...inputProps('pickup_location')} className="input w-full" type="text" required maxLength={200} disabled={lockedDetails} placeholder="e.g. Barangay Carolina, Naga City" /></Field>
              <details className="rounded-lg border border-sage-200 bg-ivory-50 p-4">
                <summary className="text-sm font-semibold text-green-900">Map pin (optional)</summary>
                <p className="my-3 text-xs text-[#596650]">Add coordinates for a public pickup point to show a map on this product. Leave both blank if you are unsure.</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field name="pickup_latitude" label="Pickup latitude" error={errors.pickup_latitude}><input {...inputProps('pickup_latitude')} className="input" type="number" step="any" min="-90" max="90" disabled={lockedDetails} placeholder="e.g. 13.6217" /></Field>
                  <Field name="pickup_longitude" label="Pickup longitude" error={errors.pickup_longitude}><input {...inputProps('pickup_longitude')} className="input" type="number" step="any" min="-180" max="180" disabled={lockedDetails} placeholder="e.g. 123.1942" /></Field>
                </div>
              </details>
              <fieldset><legend className="label">Selling urgency *</legend><div className="grid gap-3 sm:grid-cols-3">
                {[['sell-now', 'Sell Now', 'Move this harvest quickly'], ['sell-today', 'Sell Today', 'Ready for today'], ['planned', 'Planned Surplus', 'Plan the next handover']].map(([value, label, detail]) => (
                  <label key={value} className={`flex min-h-20 cursor-pointer items-center gap-3 rounded-xl border p-3 ${values.urgency === value ? 'border-[#159600] bg-[#159600]/5' : 'border-black/15'}`}>
                    <input type="radio" name="urgency" value={value} checked={values.urgency === value} onChange={change} className="h-4 w-4 shrink-0 accent-[#159600]" /><span><span className="block text-sm font-semibold">{label}</span><span className="mt-1 block text-xs text-black/60">{detail}</span></span>
                  </label>
                ))}
              </div></fieldset>
              <Field name="selling_deadline" label="Selling deadline *" error={errors.selling_deadline} hint="Your local date and time. An urgency label does not change this deadline."><input {...inputProps('selling_deadline')} className="input w-full" type="datetime-local" required min={localDateTime(Math.max(now + 60000, latestExpiry))} /></Field>
              <fieldset aria-describedby={errors.fulfillment ? 'fulfillment-error' : undefined}><legend className="label">Collection options *</legend><div className="flex flex-wrap gap-3">
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-black/15 px-4 py-3"><input type="checkbox" name="pickup_available" checked={values.pickup_available} onChange={change} className="h-4 w-4 accent-[#159600]" aria-invalid={Boolean(errors.fulfillment)} />Pickup available</label>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-black/15 px-4 py-3"><input type="checkbox" name="delivery_available" checked={values.delivery_available} onChange={change} className="h-4 w-4 accent-[#159600]" aria-invalid={Boolean(errors.fulfillment)} />Delivery available</label>
              </div>{errors.fulfillment && <p className="field-error" id="fulfillment-error">{errors.fulfillment}</p>}</fieldset>
              {values.delivery_available && <Field name="delivery_fee" label="Delivery cost per reservation (PHP) *" error={errors.delivery_fee} hint="An agreed additional cost, not an online payment. Enter 0 for no added delivery cost."><input {...inputProps('delivery_fee')} className="input w-full" type="number" inputMode="decimal" min="0" max="1000000" step="0.01" required /></Field>}
            </div>
          </section>
          <div className="flex flex-wrap justify-end gap-3">
            <button className="btn btn-secondary" type="button" onClick={() => navigate('/farmer/harvest')}>Cancel</button>
            <button className="btn btn-primary" type="submit" disabled={busy || readingImage}>{busy ? 'Saving harvest...' : relisting ? 'Post Again' : listing ? 'Save Changes' : 'Post Produce'}</button>
          </div>
        </fieldset>

        <aside className="panel overflow-hidden bg-section-soft xl:sticky xl:top-6" aria-label="Listing preview">
          <div className="flex items-center justify-between border-b border-sage-200 bg-sage-200 px-5 py-4"><h2 className="font-semibold">Your listing preview</h2><span className="text-xs text-green-800">Live preview</span></div>
          <ProduceImage src={values.image_url} alt={values.produce_name || 'Produce photo preview'} className="aspect-[4/3] w-full object-cover" />
          <div className="space-y-4 p-5">
            <span className="inline-flex rounded-full bg-[#D0BE00]/15 px-3 py-1 text-xs font-semibold">{urgencyLabel(values.urgency)}</span>
            <div><p className="mb-1 text-xs text-black/60">{values.category || 'Produce category'}</p><h3 className="break-words text-xl font-semibold">{values.produce_name || 'Your fresh harvest'}</h3><p className="mt-2 text-lg font-semibold">{money(values.price_per_unit)} <span className="text-sm font-normal text-black/60">/ {values.unit}</span></p></div>
            <p className="text-sm">{quantity(previewAvailable)} {values.unit} available</p>
            <p className="flex items-start gap-2 text-sm text-black/60"><MapPin size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{values.pickup_location || 'Your general collection point'}</p>
            {values.condition_details && <p className="break-words text-sm text-black/60">{values.condition_details}</p>}
            {values.harvest_date && <p className="text-xs text-black/60">Harvested {shortDate(values.harvest_date)}</p>}
            <div className="space-y-2 border-t border-sage-200 pt-4 text-xs text-black/60"><p>Closes {dateTime(values.selling_deadline)}</p><p>{[values.pickup_available && 'Pickup', values.delivery_available && `Delivery (+${money(values.delivery_fee)})`].filter(Boolean).join(' / ') || 'Choose a collection option'}</p></div>
            <p className="text-xs text-black/60">Preview only. Nothing is published until you save.</p>
          </div>
        </aside>
      </form>
    </div>
  );
}
