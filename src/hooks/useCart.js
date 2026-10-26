import { useAuth } from '../context/AuthContext';
import useDemoData from './useDemoData';
import { getCart } from '../services/cartService';

export default function useCart() {
  const { user } = useAuth();
  const data = useDemoData();
  const buyerId = user?.role === 'buyer' ? user.id : null;
  return { ...getCart(data, buyerId), buyerId };
}
