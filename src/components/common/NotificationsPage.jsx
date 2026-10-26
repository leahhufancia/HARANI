import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Bell, CheckCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useDemoData from '../../hooks/useDemoData';
import { getUserNotifications, markAllAsRead, markAsRead } from '../../services/notificationService';
import { dateTime } from '../../utils/format';
import { EmptyState, Notice, PageHeader } from './UI';

export default function NotificationsPage() {
  const { user } = useAuth();
  const data = useDemoData();
  const navigate = useNavigate();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const notifications = getUserNotifications(data, user?.id);
  const unread = notifications.filter((item) => !item.is_read).length;
  const visible = unreadOnly ? notifications.filter((item) => !item.is_read) : notifications;
  const read = async (item, open = false) => {
    if (busy) return;
    setBusy(item.id); setError('');
    try { await markAsRead(item.id, user.id); if (open) navigate(item.link); } catch (err) { setError(err.message); } finally { setBusy(''); }
  };
  const readAll = async () => {
    setBusy('all'); setError('');
    try { await markAllAsRead(user.id); } catch (err) { setError(err.message); } finally { setBusy(''); }
  };
  return <div className="max-w-5xl"><PageHeader eyebrow="Your account activity" title="Notifications" description="Reservation updates, handovers, and timely harvest reminders, all in one place." colored actions={<button type="button" className="btn btn-secondary" disabled={unread === 0 || Boolean(busy)} onClick={readAll}><CheckCheck />{busy === 'all' ? 'Saving...' : 'Mark all as read'}</button>} />
    {error && <div className="mb-5"><Notice tone="error">{error}</Notice></div>}
    <div className="tabs mb-5"><button className={`tab ${!unreadOnly ? 'tab-active' : ''}`} type="button" aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)}>All ({notifications.length})</button><button className={`tab ${unreadOnly ? 'tab-active' : ''}`} type="button" aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)}>Unread ({unread})</button></div>
    {visible.length ? <ul className="panel divide-y divide-sage-200">{visible.map((item) => <li key={item.id} className={`flex items-start gap-3 p-4 sm:p-5 ${!item.is_read ? 'bg-yellow-50' : 'bg-white'}`}><Bell size={19} className={`mt-1 shrink-0 ${!item.is_read ? 'text-yellow-600' : 'text-sage-500'}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className={`text-sm font-semibold tracking-normal ${!item.is_read ? 'text-black' : 'text-sage-700'}`}>{item.title}</h2><span className={`text-xs ${!item.is_read ? 'text-yellow-700 font-medium' : 'text-sage-500'}`}>{item.is_read ? 'Read' : 'Unread'}</span></div><p className={`mt-1 text-sm ${!item.is_read ? 'text-black/80' : 'text-sage-600'}`}>{item.message}</p><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><time dateTime={item.created_at} className="text-xs text-sage-500">{dateTime(item.created_at)}</time><div className="flex flex-wrap gap-3">{!item.is_read && <button type="button" disabled={Boolean(busy)} className="min-h-9 text-xs font-semibold underline underline-offset-4 text-green-700" onClick={() => read(item)}>{busy === item.id ? 'Saving...' : 'Mark as read'}</button>}<Link to={item.link} className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-green-700" onClick={(event) => { event.preventDefault(); read(item, true); }}>View update<ArrowUpRight size={15} /></Link></div></div></div></li>)}</ul> : <EmptyState icon={Bell} title={unreadOnly ? 'You are all caught up' : 'Your updates will appear here'} description="Only notifications for this demo account are shown. Try a reservation or handover to see the next update." />}
  </div>;
}
