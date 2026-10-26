import { useEffect, useId, useRef } from 'react';
import { AlertCircle, CheckCircle2, Inbox, Info, X } from 'lucide-react';

export function PageHeader({ eyebrow, title, description, actions }) {
  return <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
    <div className="min-w-0">{eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}<h1 className="text-2xl sm:text-3xl">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black/60">{description}</p>}</div>
    {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
  </header>;
}

export function StatStrip({ items }) {
  return <dl className={`panel mb-7 grid grid-cols-2 divide-x divide-black/10 ${items.length === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-4'}`}>
    {items.map((item) => <div key={item.label} className="min-w-0 p-4 sm:p-5"><dt className="text-sm text-black/60">{item.label}</dt><dd className="mt-1.5 break-words text-2xl font-semibold tracking-tight">{item.value}</dd>{item.detail && <p className="mt-1 text-xs leading-relaxed text-black/55">{item.detail}</p>}</div>)}
  </dl>;
}

export function Notice({ tone = 'info', children }) {
  const Icon = tone === 'error' ? AlertCircle : tone === 'success' ? CheckCircle2 : Info;
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`notice ${tone === 'error' ? 'notice-error' : tone === 'success' ? 'notice-success' : ''}`}><Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" /><div className="min-w-0">{children}</div></div>;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return <div className="panel flex flex-col items-center px-5 py-12 text-center"><Icon size={28} className="mb-4 text-black/45" aria-hidden="true" /><h2 className="text-lg">{title}</h2>{description && <p className="mt-2 max-w-md text-sm text-black/60">{description}</p>}{action && <div className="mt-5">{action}</div>}</div>;
}

const statusLabels = {
  active: 'Active', pending: 'Pending', confirmed: 'Confirmed', ready: 'Ready', completed: 'Completed', reserved: 'Reserved', sold: 'Sold',
  expired: 'Expired', cancelled: 'Cancelled', rejected: 'Rejected', withdrawn: 'Withdrawn', moderated: 'Hidden by admin',
  verified: 'Verified (demo)', unverified: 'Not reviewed', suspended: 'Suspended',
  awaiting_confirmation: 'Awaiting confirmation', preparing: 'Preparing', ready_for_pickup: 'Ready for pickup', ready_for_delivery: 'Ready for delivery', handed_over: 'Handed over',
  not_recorded: 'Payment not recorded', recorded_by_seller: 'Payment recorded by seller (demo)',
  'sell-now': 'Sell Now', 'sell-today': 'Sell Today', planned: 'Planned Surplus',
};

export function StatusBadge({ status }) {
  const positive = ['active', 'confirmed', 'ready', 'completed', 'verified', 'handed_over', 'ready_for_pickup', 'ready_for_delivery'].includes(status);
  const attention = ['pending', 'expired', 'cancelled', 'rejected', 'suspended', 'moderated', 'sell-now', 'sell-today'].includes(status);
  return <span className={`inline-flex max-w-full items-center rounded-sm border px-2 py-1 text-xs font-medium leading-snug ${positive ? 'border-green/25 bg-green/8' : attention ? 'border-yellow/40 bg-yellow/15' : 'border-black/10 bg-black/3'}`}>{statusLabels[status] || String(status || 'Not provided').replaceAll('_', ' ')}</span>;
}

export function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; previousFocus?.focus?.(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} className={`modal-panel ${wide ? 'modal-panel-wide' : ''}`} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
  }}>
    <div className="flex items-center justify-between gap-4 border-b border-black/10 px-5 py-3"><h2 id={titleId} className="text-lg">{title}</h2><button type="button" onClick={onClose} className="btn btn-quiet !p-2" aria-label="Close dialog"><X size={20} /></button></div>
    <div className="p-5 sm:p-6">{children}</div>
  </dialog>;
}

export function ConfirmDialog({ title, description, confirmLabel = 'Confirm', onConfirm, onClose, busy = false }) {
  return <Modal title={title} onClose={() => { if (!busy) onClose(); }}><div className="text-sm leading-relaxed text-black/70">{description}</div><div className="mt-6 flex flex-wrap justify-end gap-2"><button className="btn btn-secondary" type="button" disabled={busy} onClick={onClose}>Keep unchanged</button><button className="btn btn-primary" type="button" disabled={busy} onClick={onConfirm}>{busy ? 'Saving...' : confirmLabel}</button></div></Modal>;
}
