import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import useCart from '../../hooks/useCart';

export default function CartLink() {
  const { itemCount } = useCart();
  return <Link to="/cart" className="cart-nav-link" aria-label={`Shopping cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}>
    <ShoppingCart size={20} aria-hidden="true" />
    <span className="cart-badge" aria-hidden="true">{itemCount > 99 ? '99+' : itemCount}</span>
  </Link>;
}
