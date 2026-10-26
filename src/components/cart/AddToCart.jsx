import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ShoppingCart } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useCart from '../../hooks/useCart';
import { addCartItem, cartListingError, validCartQuantity } from '../../services/cartService';
import QuantityStepper from './QuantityStepper';

export default function AddToCart({ listing, quantity: selectedQuantity }) {
  const { user } = useAuth();
  const { buyerId, items } = useCart();
  const navigate = useNavigate();
  const [count, setCount] = useState('1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const submitting = useRef(false);
  const messageId = useId();
  const value = selectedQuantity ?? count;
  const inCart = items.find((item) => item.listing_id === listing.id)?.quantity || 0;
  const remaining = Math.max(0, Math.floor(listing.available_quantity) - inCart);
  const unavailable = cartListingError(listing, buyerId);
  const invalid = !validCartQuantity(value) || Number(value) > remaining;
  const validation = unavailable || (!validCartQuantity(value) ? 'Cart quantities must be positive whole numbers. Use Reserve Produce for fractions.' : Number(value) > remaining ? `Already in cart: ${inCart} ${listing.unit}. You can add ${remaining} more.` : '');

  useEffect(() => {
    if (!confirmation) return;
    const timer = window.setTimeout(() => setConfirmation(''), 4500);
    return () => window.clearTimeout(timer);
  }, [confirmation]);

  if (user && user.role !== 'buyer') return null;

  const add = async () => {
    if (!user) { navigate('/login', { state: { from: `/marketplace/${listing.id}` } }); return; }
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await addCartItem(buyerId, listing.id, value);
      setConfirmation(`${value} ${listing.unit} added to your cart.`);
    } catch (err) { setError(err.message); }
    finally { submitting.current = false; setBusy(false); }
  };

  return <div className="mt-4 space-y-2" aria-busy={busy}>
    {selectedQuantity == null && <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold">Quantity ({listing.unit})</span><QuantityStepper label={`Quantity for ${listing.produce_name}`} value={count} onChange={(next) => { setCount(next); setError(''); }} max={remaining} disabled={busy || Boolean(unavailable) || remaining < 1} invalid={invalid} describedBy={validation ? messageId : undefined} /></div>}
    <button type="button" className="btn btn-secondary w-full" onClick={add} disabled={busy || Boolean(unavailable) || invalid} aria-describedby={validation ? messageId : undefined}><ShoppingCart aria-hidden="true" />{busy ? 'Adding...' : 'Add to Cart'}</button>
    {validation && <p id={messageId} className="text-xs text-black/65">{validation}</p>}
    {error && <p className="text-xs font-medium text-black" role="alert">{error}</p>}
    <div role="status" aria-live="polite" aria-atomic="true">{confirmation && <p className="flex flex-wrap items-center gap-1.5 text-xs text-black"><Check size={14} className="text-green-700" aria-hidden="true" />{confirmation}<Link to="/cart" className="font-semibold underline underline-offset-2">View cart</Link></p>}</div>
  </div>;
}
