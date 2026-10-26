import { maintainData } from './dataRules.js';

export const STORAGE_KEY = 'harani.demo.v1';
let snapshot;
let storageFailure = '';
const listeners = new Set();

function createEmptyData() {
  return {
    schemaVersion: 1,
    revision: 0,
    profiles: [],
    listings: [],
    reservations: [],
    carts: [],
    notifications: [],
    verifications: [],
    auditLogs: [],
  };
}

function readSaved() {
  const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
  if (!stored) return null;
  const data = JSON.parse(stored);
  if (data.schemaVersion !== 1 || !['profiles', 'listings', 'reservations', 'notifications', 'verifications', 'auditLogs'].every((key) => Array.isArray(data[key]))) {
    throw new Error('The saved demo format is not supported.');
  }
  return data;
}

function announce(data) {
  snapshot = data;
  listeners.forEach((listener) => listener());
}

export function getSnapshot() {
  if (snapshot) return snapshot;
  try {
    snapshot = readSaved();
    if (!snapshot) {
      snapshot = createEmptyData();
      if (globalThis.localStorage) globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    }
  } catch {
    storageFailure = 'Browser storage is unavailable or the saved demo is unreadable. A temporary preview is shown; changes cannot be saved. Enable local storage or clear only the Harani demo data in your browser settings.';
    snapshot = { ...createEmptyData(), storage_warning: storageFailure };
  }
  return snapshot;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Web Locks serialize the read/validate/write transaction across tabs where supported.
// The synchronous fallback is single-tab only; this is not a production database.
export async function mutateData(update) {
  const commit = () => {
    const current = getSnapshot();
    if (storageFailure) throw new Error(storageFailure);
    let latest;
    try {
      latest = readSaved() || current;
    } catch {
      throw new Error('The local demo could not be read. Reload before making changes.');
    }
    const draft = structuredClone(latest);
    maintainData(draft);
    const result = update(draft);
    if (result instanceof Promise) throw new Error('Local data updates must be synchronous.');
    if (JSON.stringify(draft) !== JSON.stringify(latest)) {
      draft.revision = (latest.revision || 0) + 1;
      try {
        globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(draft));
      } catch {
        throw new Error('The demo could not be saved. Browser storage may be full or disabled. Try a smaller photo; your previous data has not changed.');
      }
      announce(draft);
    } else if (latest.revision !== current.revision) {
      announce(latest);
    }
    return structuredClone(result);
  };
  return globalThis.navigator?.locks?.request ? globalThis.navigator.locks.request(STORAGE_KEY, commit) : commit();
}

export const processTimeEvents = () => mutateData(() => undefined);

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    try {
      const saved = readSaved();
      if (saved) {
        storageFailure = '';
        announce(saved);
      } else {
        snapshot = undefined;
        announce(getSnapshot());
      }
    } catch {
      announce({ ...getSnapshot(), storage_warning: 'Demo data changed in another tab but could not be read. Reload before continuing.' });
    }
  });
}
