import { useEffect, useRef, useState } from 'react';
import { getCoordinates } from '../utils/location';

export default function useBrowserLocation() {
  const [state, setState] = useState({ location: null, status: 'idle', error: '' });
  const request = useRef(0);
  useEffect(() => () => { request.current += 1; }, []);

  function requestLocation() {
    const id = ++request.current;
    const fail = (status, error) => {
      if (request.current === id) setState({ location: null, status, error });
    };
    if (!globalThis.isSecureContext || !navigator.geolocation) {
      fail('unavailable', 'Location is unavailable. Use HTTPS and a supported browser, or browse by barangay without distance filters.');
      return;
    }
    setState({ location: null, status: 'locating', error: '' });
    try {
      navigator.geolocation.getCurrentPosition((position) => {
        if (request.current !== id) return;
        const coordinates = getCoordinates(position.coords.latitude, position.coords.longitude);
        if (!coordinates) { fail('unavailable', 'Your browser did not return a valid location. You can still browse by barangay or without distance filters.'); return; }
        setState({ location: { coordinates, accuracy: position.coords.accuracy }, status: 'ready', error: '' });
      }, (error) => {
        const messages = {
          1: ['denied', 'Location permission was denied. You can still browse by barangay or without distance filters.'],
          2: ['unavailable', 'Your location could not be determined. You can still browse by barangay or without distance filters.'],
          3: ['timeout', 'Finding your location timed out. Try again or continue browsing without distance filters.'],
        };
        fail(...(messages[error.code] || messages[2]));
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    } catch {
      fail('unavailable', 'Location is unavailable in this browser. You can still browse by barangay or without distance filters.');
    }
  }

  function clearLocation() {
    request.current += 1;
    setState({ location: null, status: 'idle', error: '' });
  }

  return { ...state, requestLocation, clearLocation };
}
