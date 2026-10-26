import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const titles = { '/': 'Local harvests, closer to you', '/login': 'Log In', '/register': 'Join Harani', '/forgot-password': 'Password Recovery', '/marketplace': 'Marketplace', '/cart': 'Shopping Cart', '/checkout': 'Checkout', '/onboarding': 'Your next step' };

export default function RouteEffects() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const last = pathname.split('/').filter(Boolean).pop() || '';
    document.title = `Harani | ${titles[pathname] || last.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}`;
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname, hash]);
  return null;
}
