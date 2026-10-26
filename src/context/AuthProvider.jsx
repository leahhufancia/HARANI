import { useEffect, useState, useSyncExternalStore } from 'react';
import { AuthContext } from './AuthContext';
import useDemoData from '../hooks/useDemoData.js';
import * as authService from '../services/authService.js';
import { processTimeEvents } from '../services/storageService.js';

export function AuthProvider({ children }) {
  const data = useDemoData();
  const sessionId = useSyncExternalStore(authService.subscribeSession, authService.getSessionId, () => null);
  const [maintenanceError, setMaintenanceError] = useState('');
  const user = data.profiles.find((profile) => profile.id === sessionId && profile.status === 'active') || null;

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      processTimeEvents().then(() => { if (mounted) setMaintenanceError(''); }).catch((error) => { if (mounted) setMaintenanceError(error.message); });
    };
    refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { mounted = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);

  const value = {
    user, userRole: user?.role || null, loading: false, storageWarning: data.storage_warning || maintenanceError,
    signIn: authService.signIn, signUp: authService.signUp, signOut: authService.signOut,
    resetPassword: authService.resetPassword,
    updateProfile: (values) => authService.updateProfile(user?.id, values),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
