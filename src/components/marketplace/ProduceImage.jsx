import { useState } from 'react';
import { Sprout } from 'lucide-react';

export default function ProduceImage({ src, alt, className = '', eager = false }) {
  const [failedSource, setFailedSource] = useState(null);
  if (!src || failedSource === src) return <div className={`flex items-center justify-center bg-green/5 ${className}`} role="img" aria-label={`${alt}. Photo not available.`}><div className="flex flex-col items-center gap-2 text-black/60"><Sprout size={36} strokeWidth={1.25} /><span className="text-xs">Photo not available</span></div></div>;
  return <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" className={`bg-black/3 object-cover ${className}`} onError={() => setFailedSource(src)} />;
}
