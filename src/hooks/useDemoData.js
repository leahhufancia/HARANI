import { useSyncExternalStore } from 'react';
import { getSnapshot, subscribe } from '../services/storageService.js';

export default function useDemoData() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
