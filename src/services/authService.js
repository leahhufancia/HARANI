import { getSnapshot, mutateData, processTimeEvents } from './storageService.js';
import { addAudit, addNotification, newId, requireProfile } from './dataRules.js';
import { CATEGORIES } from './demoSeed.js';

export const SESSION_KEY = 'harani.demo.session';
const sessionListeners = new Set();
let memorySessionId = null;

export const roleHome = (role) => ({ farmer: '/farmer/dashboard', buyer: '/marketplace', admin: '/admin/dashboard' }[role] || '/');

export function getSessionId() {
  try {
    return globalThis.sessionStorage?.getItem(SESSION_KEY) || globalThis.localStorage?.getItem(SESSION_KEY) || memorySessionId;
  } catch {
    return memorySessionId;
  }
}

export function subscribeSession(listener) {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

function saveSession(id, remember = true) {
  try {
    globalThis.localStorage?.removeItem(SESSION_KEY);
    globalThis.sessionStorage?.removeItem(SESSION_KEY);
    if (id) {
      const storage = remember ? globalThis.localStorage : globalThis.sessionStorage;
      storage?.setItem(SESSION_KEY, id);
    }
  } catch {
    throw new Error('The demo session could not be saved. Enable browser storage and try again.');
  }
  memorySessionId = id;
  sessionListeners.forEach((listener) => listener());
}

function validEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  return email;
}

// Only these non-sensitive fields may be persisted. Passwords never enter the store.
function safeProfile(values, role) {
  const full_name = String(values.full_name || '').trim();
  if (full_name.length < 2 || full_name.length > 100) throw new Error('Full name must contain 2 to 100 characters.');
  const text = (key, max = 200) => String(values[key] || '').trim().slice(0, max);
  const buyer_type = values.buyer_type === 'business' ? 'business' : 'household';
  return {
    full_name, phone: text('phone', 30), location: text('location'),
    seller_name: role === 'farmer' ? text('seller_name', 100) : '',
    categories: role === 'farmer' && Array.isArray(values.categories) ? values.categories.filter((category) => CATEGORIES.includes(category)) : [],
    buyer_type: role === 'buyer' ? buyer_type : '',
    business_name: role === 'buyer' && buyer_type === 'business' ? text('business_name', 100) : '',
    business_type: role === 'buyer' && buyer_type === 'business' ? text('business_type', 100) : '',
    business_location: role === 'buyer' && buyer_type === 'business' ? text('business_location') : '',
    preferences: { deadline_reminders: values.preferences?.deadline_reminders !== false, listing_updates: values.preferences?.listing_updates !== false },
    onboarding_complete: Boolean(values.onboarding_complete),
  };
}

export async function signIn(email, _password = '', remember = true) {
  const normalized = validEmail(email);
  await processTimeEvents();
  const profile = getSnapshot().profiles.find((item) => item.email.toLowerCase() === normalized);
  if (!profile) throw new Error('No local demo profile uses this email. Select a sample account or register a new demo profile.');
  if (profile.status !== 'active') throw new Error('This demo account is suspended. Use the administrator demo to review its status.');
  saveSession(profile.id, remember);
  return profile;
}

export async function signUp(email, password, role, values) {
  const normalized = validEmail(email);
  if (!['farmer', 'buyer'].includes(role)) throw new Error('Choose Farmer or Buyer.');
  if (typeof password !== 'string' || password.length < 6) throw new Error('Use at least 6 characters for the simulated password. It will not be saved.');
  const profile = await mutateData((data) => {
    if (data.profiles.some((item) => item.email.toLowerCase() === normalized)) throw new Error('A demo profile already uses this email. Log in with that email instead.');
    const record = { ...safeProfile(values, role), id: newId('profile'), email: normalized, role, status: 'active', verification_status: 'unverified', created_at: new Date().toISOString(), onboarding_complete: false };
    data.profiles.push(record);
    addAudit(data, record.id, 'profile_created', 'profile', record.id, `${role} demo profile created. No password or identity document stored.`);
    addNotification(data, record.id, 'Welcome to your Harani demo', 'Your profile is saved in this browser. Complete the optional introduction and explore your workspace.', '/onboarding');
    return record;
  });
  saveSession(profile.id);
  return profile;
}

export async function updateProfile(id, values) {
  return mutateData((data) => {
    const profile = requireProfile(data, id);
    const email = validEmail(values.email ?? profile.email);
    if (data.profiles.some((item) => item.id !== id && item.email.toLowerCase() === email)) throw new Error('Another demo profile already uses this email.');
    Object.assign(profile, safeProfile({ ...profile, ...values }, profile.role), { email });
    addAudit(data, id, 'profile_updated', 'profile', id, 'Non-sensitive demo profile information updated.');
    return profile;
  });
}

export async function signOut() {
  saveSession(null);
}

export async function requestVerification(userId) {
  return mutateData((data) => {
    const profile = requireProfile(data, userId, 'farmer');
    if (['verified', 'pending'].includes(profile.verification_status)) throw new Error('Your demo profile is already reviewed or awaiting review.');
    const record = { id: newId('verification'), user_id: userId, status: 'pending', submitted_at: new Date().toISOString(), reviewed_at: null, reviewed_by: null, reason: '', notes: 'The farmer requested a simulated review of their public demo profile. No sensitive documents were collected.', document_label: 'Demo seller profile (no real document)' };
    data.verifications.unshift(record);
    profile.verification_status = 'pending';
    addAudit(data, userId, 'verification_requested', 'verification', record.id, 'Demo seller profile submitted for simulated review.');
    return record;
  });
}

export async function resetPassword(email) {
  validEmail(email);
  return { simulated: true };
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === SESSION_KEY || event.key === null) {
      memorySessionId = null;
      sessionListeners.forEach((listener) => listener());
    }
  });
}
