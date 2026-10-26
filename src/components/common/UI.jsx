import { useEffect, useId, useRef } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Inbox, Info, PackageCheck, Sprout, X } from 'lucide-react';

export function PageHeader({ eyebrow, title, description, actions }) {
  return <header className="page-header">
    <div className="min-w-0 flex-1 basis-72">{eyebrow && <p className="eyebrow mb-2.5">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="page-header-description mt-2.5">{description}</p>}</div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </header>;
}

export function StatStrip({ items }) {
  const tones = ['yellow', 'green', 'mint', 'neutral'];
  const icons = [Clock3, PackageCheck, CheckCircle2, Sprout];
  return <dl className={`stat-grid mb-6 grid grid-cols-1 gap-3.5 sm:grid-cols-2 ${items.length === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-4'}`}>
    {items.map((item, index) => {
      const Icon = item.icon || icons[index % icons.length];
      return <div key={item.label} className={`stat-card stat-card-${item.tone || tones[index % tones.length]}`}>
        <dt className="flex items-center justify-between gap-3 text-xs font-semibold text-green-900"><span>{item.label}</span><span className="stat-icon"><Icon size={20} strokeWidth={1.7} aria-hidden="true" /></span></dt>
        <dd className="stat-value mt-2 break-words">{item.value}</dd>
        {item.detail && <dd className="stat-detail mt-2 text-[11px] leading-relaxed text-[#536149]">{item.detail}</dd>}
      </div>;
    })}
  </dl>;
}

export function Notice({ tone = 'info', children }) {
  const Icon = ['error', 'warning'].includes(tone) ? AlertCircle : tone === 'success' ? CheckCircle2 : Info;
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`notice ${['error', 'success', 'warning'].includes(tone) ? `notice-${tone}` : ''}`}><Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" /><div className="min-w-0">{children}</div></div>;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return <div className="empty-state flex flex-col items-center"><span className="empty-state-icon"><Icon size={28} strokeWidth={1.6} aria-hidden="true" /></span><h2 className="text-lg text-green-900">{title}</h2>{description && <p className="mt-2 max-w-md text-sm text-[#596650]">{description}</p>}{action && <div className="mt-5">{action}</div>}</div>;
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
  const positive = ['active', 'confirmed', 'ready', 'completed', 'verified', 'reserved', 'sold', 'handed_over', 'ready_for_pickup', 'ready_for_delivery', 'recorded_by_seller'].includes(status);
  const attention = ['pending', 'expired', 'awaiting_confirmation', 'preparing', 'sell-now', 'sell-today'].includes(status);
  const negative = ['cancelled', 'rejected', 'suspended', 'moderated', 'withdrawn'].includes(status);
  const tone = negative ? 'red' : attention ? 'yellow' : positive ? 'green' : 'neutral';
  return <span className={`status-badge status-${tone}`}><span className="status-dot" aria-hidden="true" />{statusLabels[status] || String(status || 'Not provided').replaceAll('_', ' ')}</span>;
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
    <div className="flex items-center justify-between gap-4 border-b border-sage-200 bg-sage-100 px-5 py-3"><h2 id={titleId} className="text-lg text-green-900">{title}</h2><button type="button" onClick={onClose} className="btn btn-quiet !p-2" aria-label="Close dialog"><X size={20} /></button></div>
    <div className="p-5 sm:p-6">{children}</div>
  </dialog>;
}

export function ConfirmDialog({ title, description, confirmLabel = 'Confirm', onConfirm, onClose, busy = false, destructive = false }) {
  return <Modal title={title} onClose={() => { if (!busy) onClose(); }}><div className="text-sm leading-relaxed text-black/70">{description}</div><div className="mt-6 flex flex-wrap justify-end gap-2"><button className="btn btn-secondary" type="button" disabled={busy} onClick={onClose}>Keep unchanged</button><button className={`btn ${destructive ? 'btn-danger' : 'btn-primary'}`} type="button" disabled={busy} onClick={onConfirm}>{busy ? 'Saving...' : confirmLabel}</button></div></Modal>;
}
