import { useState } from 'react';
import { History, Search } from 'lucide-react';
import { EmptyState, Notice, PageHeader, StatStrip } from '../../components/common/UI';
import useDemoData from '../../hooks/useDemoData';
import { shortDate } from '../../utils/format';

export default function AuditHistory() {
  const data = useDemoData();
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('all');
  const profiles = new Map(data.profiles.map((profile) => [profile.id, profile]));
  const actions = [...new Set(data.auditLogs.map((entry) => entry.action))].sort();
  const query = search.trim().toLowerCase();
  const logs = data.auditLogs.map((entry) => ({
    ...entry,
    actor: entry.actor_name || profiles.get(entry.actor_id)?.full_name || entry.actor_id || 'Local demo system',
    detailText: typeof entry.details === 'string' ? entry.details : entry.details ? JSON.stringify(entry.details) : '',
  })).filter((entry) => (
    (action === 'all' || entry.action === action)
    && [entry.id, entry.actor, entry.actor_id, entry.action, entry.entity_type, entry.entity_id, entry.detailText, entry.created_at].some((value) => String(value || '').toLowerCase().includes(query))
  )).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administration" title="A record of what changed." description="Follow actual actions, actors and recorded reasons in the shared demo." />
      <StatStrip items={[
        { label: 'Recorded events', value: data.auditLogs.length, detail: 'Stored in this browser' },
        { label: 'Action types', value: actions.length, detail: 'Derived from recorded events' },
        { label: 'Recorded actors', value: new Set(data.auditLogs.map((entry) => entry.actor_id || entry.actor_name || 'demo-system')).size, detail: 'Accounts and demo system actors' },
        { label: 'Matching events', value: logs.length, detail: 'With the current filters' },
      ]} />
      <Notice>This client-local history is editable demo data. It is not immutable, tamper-proof or a production security log. Resetting the demo also resets its history.</Notice>

      <section className="panel" aria-label="Local demo audit history">
        <div className="grid gap-3 border-b border-black/10 p-4 sm:grid-cols-[minmax(0,2fr)_1fr]">
          <div><label className="label" htmlFor="audit-search">Search activity</label><div className="relative"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/40" aria-hidden="true" /><input id="audit-search" type="search" className="input pl-9" placeholder="Actor, action, entity, reason or event ID" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
          <div><label className="label" htmlFor="audit-action">Recorded action</label><select id="audit-action" className="input" value={action} onChange={(event) => setAction(event.target.value)}><option value="all">All actions</option>{actions.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-black/60"><p aria-live="polite">{logs.length} of {data.auditLogs.length} events / newest first / browser-local time</p>{(search || action !== 'all') && <button type="button" className="btn btn-quiet" onClick={() => { setSearch(''); setAction('all'); }}>Clear filters</button>}</div>
        {logs.length ? <div className="table-wrap" role="region" aria-label="Audit events, scroll horizontally for all columns" tabIndex={0}>
          <table className="data-table min-w-[880px]">
            <caption className="sr-only">Actual client-local demo events ordered newest first, with actor, action, entity and details</caption>
            <thead><tr><th scope="col">When</th><th scope="col">Actor</th><th scope="col">Action</th><th scope="col">Entity</th><th scope="col">Recorded details</th></tr></thead>
            <tbody>{logs.map((entry) => <tr key={entry.id}>
              <td className="whitespace-nowrap"><time dateTime={entry.created_at} title={entry.created_at}>{shortDate(entry.created_at)}<span className="mt-1 block text-xs text-black/55">{new Date(entry.created_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span></time></td>
              <td className="max-w-48"><p className="font-semibold">{entry.actor}</p><p className="mt-1 break-all text-xs text-black/60">{entry.actor_id || 'System event'}</p></td>
              <td className="max-w-48"><code className="break-words text-xs">{entry.action}</code></td>
              <td className="max-w-48"><p className="text-xs font-semibold">{entry.entity_type}</p><p className="mt-1 break-all text-xs text-black/60">{entry.entity_id || 'No entity ID'}</p></td>
              <td className="min-w-64 max-w-lg"><p className="whitespace-pre-wrap break-words text-sm">{entry.detailText || 'No details recorded.'}</p><p className="mt-2 break-all text-xs text-black/60">Event: {entry.id}</p></td>
            </tr>)}</tbody>
          </table>
        </div> : <EmptyState icon={History} title={data.auditLogs.length ? 'No matching audit events' : 'No activity recorded yet'} description={data.auditLogs.length ? 'Try a different search or clear the action filter.' : 'Local demo actions will appear here with their actor, entity and recorded details.'} />}
      </section>
    </div>
  );
}
