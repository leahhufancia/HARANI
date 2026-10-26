import haraniLogo from '../../logo/HARANI-removebg-preview.png';

export default function HaraniLogo({ className = '' }) {
  return <img src={haraniLogo} alt="Harani" width="666" height="375" className={`block h-auto max-w-full shrink-0 object-contain ${className || 'w-52'}`} />;
}
