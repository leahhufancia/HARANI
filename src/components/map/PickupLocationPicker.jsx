import { useEffect, useId, useRef, useState } from 'react';
import { LocateFixed, MapPin, RotateCcw, X } from 'lucide-react';
import { divIcon } from 'leaflet';
import { MapContainer, Marker, TileLayer, ZoomControl, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import useBrowserLocation from '../../hooks/useBrowserLocation';
import { getCoordinates } from '../../utils/location';

const WORLD_VIEW = [0, 0];
const pickupIcon = divIcon({
  className: 'grid place-items-center rounded-full border-2 border-white bg-[#117b00] font-bold text-white shadow-md',
  html: '<span aria-hidden="true">P</span>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

function PickerEvents({ coordinates, browserLocation, disabled, onChange }) {
  const viewedLocation = useRef(null);
  const map = useMapEvents({
    click(event) {
      if (disabled) return;
      const point = event.latlng.wrap();
      const next = getCoordinates(Number(point.lat.toFixed(6)), Number(point.lng.toFixed(6)));
      if (next) onChange(next);
    },
  });
  const latitude = coordinates?.[0];
  const longitude = coordinates?.[1];

  useEffect(() => {
    if (latitude != null && longitude != null) map.setView([latitude, longitude], Math.max(map.getZoom(), 14), { animate: false });
  }, [map, latitude, longitude]);

  useEffect(() => {
    if (!browserLocation || viewedLocation.current === browserLocation) return;
    viewedLocation.current = browserLocation;
    if (!disabled) map.setView(browserLocation.coordinates, 15, { animate: false });
  }, [map, browserLocation, disabled]);

  useEffect(() => {
    for (const handler of [map.dragging, map.touchZoom, map.boxZoom, map.keyboard]) {
      if (disabled) handler.disable();
      else handler.enable();
    }
  }, [map, disabled]);

  useEffect(() => {
    const container = map.getContainer();
    let frame;
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (container.clientWidth && container.clientHeight) map.invalidateSize({ pan: false });
      });
    };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    observer?.observe(container);
    window.addEventListener('resize', resize);
    resize();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frame);
    };
  }, [map]);

  return null;
}

export default function PickupLocationPicker({ latitude, longitude, onChange, disabled = false }) {
  const id = useId();
  const coordinates = getCoordinates(latitude, longitude);
  const hasCoordinateInput = [latitude, longitude].some((value) => value != null && String(value).trim() !== '');
  const { location, status, requestLocation, clearLocation } = useBrowserLocation();
  const [tileLoading, setTileLoading] = useState(true);
  const [tileError, setTileError] = useState(false);
  const [tileAttempt, setTileAttempt] = useState(0);
  const mapDisabled = disabled || tileError;

  useEffect(() => {
    if (!tileLoading) return;
    const timeout = window.setTimeout(() => { setTileError(true); setTileLoading(false); }, 12000);
    return () => window.clearTimeout(timeout);
  }, [tileLoading, tileAttempt]);

  const locationMessage = {
    idle: 'Your device location is optional and only moves the view. It is never saved as your pickup pin.',
    locating: 'Finding your approximate location to move the view. No pickup pin will be placed or approved.',
    ready: 'Device location only moved the view. Zoom in and select a public meeting point; your pin and approval are never set automatically.',
    denied: 'Location permission was denied. Pan and zoom the map, or enter pickup coordinates below.',
    unavailable: 'Device location is unavailable. Pan and zoom the map, or enter pickup coordinates below.',
    timeout: 'Finding your location timed out. Try again, move the map, or enter pickup coordinates below.',
  }[status];

  return (
    <div className="min-w-0 space-y-3 rounded-lg border border-sage-200 bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 id={`${id}-heading`} className="flex items-center gap-2 text-sm font-semibold text-green-900"><MapPin size={18} aria-hidden="true" />Public pickup pin (optional)</h3>
        <button type="button" className="btn btn-quiet" disabled={disabled || !hasCoordinateInput} onClick={() => { if (!disabled) onChange(null); }}><X aria-hidden="true" />Remove pin</button>
      </div>
      <p id={`${id}-help`} className="text-xs leading-relaxed text-[#596650]">Pan and zoom to a public meeting point, then click to choose it or drag the P marker. The world view is only a starting view, not a chosen pickup location. You can also use the coordinate fields below.</p>
      <p role="status" className="text-xs font-semibold text-green-900">{coordinates ? `Selected pickup pin: ${coordinates[0].toFixed(6)}, ${coordinates[1].toFixed(6)}. Review it before confirming public approval below.` : 'No valid pickup pin selected. Moving the map does not choose a pickup location.'}</p>
      <div className="relative z-0 h-72 overflow-hidden rounded-md border border-sage-200 sm:h-80" role="region" aria-labelledby={`${id}-heading`} aria-describedby={`${id}-help`} aria-disabled={disabled}>
        <MapContainer center={coordinates || WORLD_VIEW} zoom={coordinates ? 14 : 2} minZoom={2} maxZoom={19} zoomControl={false} scrollWheelZoom={false} doubleClickZoom={false} worldCopyJump style={{ width: '100%', height: '100%' }}>
          {!mapDisabled && <ZoomControl position="topleft" />}
          <TileLayer
            key={tileAttempt}
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            maxZoom={19}
            eventHandlers={{
              loading: () => setTileLoading(true),
              load: () => setTileLoading(false),
              tileerror: () => { setTileError(true); setTileLoading(false); },
            }}
          />
          <PickerEvents coordinates={coordinates} browserLocation={location} disabled={mapDisabled} onChange={onChange} />
          {coordinates && <Marker
            position={coordinates}
            icon={pickupIcon}
            draggable={!mapDisabled}
            keyboard={false}
            title="Selected pickup point. You can also edit the coordinate fields below."
            eventHandlers={{
              click: () => { if (!mapDisabled) onChange(coordinates); },
              dragend: (event) => {
                if (mapDisabled) { event.target.setLatLng(coordinates); return; }
                const point = event.target.getLatLng().wrap();
                const next = getCoordinates(Number(point.lat.toFixed(6)), Number(point.lng.toFixed(6)));
                if (next) onChange(next);
              },
            }}
          />}
        </MapContainer>
      </div>
      {tileError ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#D0BE00] p-3">
        <p className="min-w-0 flex-1 text-xs text-[#596650]" role="status">Map tiles could not load. Map selection is paused so you do not choose a point on a blank map. Enter coordinates below or retry; your saved form values are unchanged.</p>
        <button type="button" className="btn btn-secondary" disabled={disabled} onClick={() => { if (disabled) return; setTileError(false); setTileLoading(true); setTileAttempt((previous) => previous + 1); }}><RotateCcw aria-hidden="true" />Retry map</button>
      </div> : tileLoading && <p className="text-xs text-[#596650]" role="status">Loading map tiles. Manual coordinate entry remains available.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary" disabled={disabled || tileError || status === 'locating'} onClick={() => { if (!disabled && !tileError && status !== 'locating') requestLocation(); }}><LocateFixed aria-hidden="true" />{status === 'locating' ? 'Locating device...' : 'Use my location to move map'}</button>
        {status === 'locating' && <button type="button" className="btn btn-quiet" disabled={disabled} onClick={() => { if (!disabled) clearLocation(); }}>Cancel locating</button>}
      </div>
      <p className="text-xs leading-relaxed text-[#596650]" role="status">{locationMessage}</p>
    </div>
  );
}
