import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { distanceKm, getCoordinates } from '../../utils/location';

const markerIcon = L.icon({
  iconRetinaUrl: markerRetinaUrl,
  iconUrl: markerIconUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

function MapSize() {
  const map = useMap();
  useEffect(() => {
    const resize = () => map.invalidateSize({ pan: false });
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    observer?.observe(map.getContainer());
    window.addEventListener('resize', resize);
    return () => { observer?.disconnect(); window.removeEventListener('resize', resize); };
  }, [map]);
  return null;
}

export default function ProduceMap({ produceName = 'Produce', pickupLocation, pickupBarangay, latitude, longitude, publicPickup = false, buyerLocation = null, isDemo = false }) {
  const coordinates = publicPickup === true ? getCoordinates(latitude, longitude) : null;
  const publicLocation = publicPickup === true ? pickupLocation || pickupBarangay || '' : '';
  const buyerCoordinates = Array.isArray(buyerLocation) ? getCoordinates(buyerLocation[0], buyerLocation[1]) : null;
  const [tileError, setTileError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tileAttempt, setTileAttempt] = useState(0);
  const coordinateKey = coordinates?.join(',') || '';
  useEffect(() => {
    if (!coordinateKey || !loading) return;
    const timer = window.setTimeout(() => { setTileError(true); setLoading(false); }, 12000);
    return () => window.clearTimeout(timer);
  }, [coordinateKey, loading, tileAttempt]);

  if (!coordinates) {
    return (
      <div className="surface-sage rounded-xl border p-5">
        <div className="flex items-start gap-3"><span className="section-icon"><MapPin size={20} aria-hidden="true" /></span><div><p className="text-sm font-semibold text-green-900">{publicLocation ? 'Interactive map unavailable' : 'Pickup location not provided'}</p><p className="mt-1 text-xs text-[#596650]">{publicLocation || 'A public pickup point has not been published.'}</p></div></div>
        <p className="mt-3 text-xs leading-relaxed text-[#596650]">The interactive map is unavailable until the farmer provides a confirmed public pickup pin. You can still add this produce to your cart or reserve it while it is available.</p>
      </div>
    );
  }

  const distance = distanceKm(buyerCoordinates, coordinates);
  const distanceLabel = distance === null ? '' : `About ${distance.toFixed(1)} km from your location${isDemo ? ' to a sample pin' : ''} (straight-line distance)`;

  return (
    <div className="space-y-3">
      {distanceLabel && (
        <div className="flex items-center gap-2 text-sm">
          <MapPin size={16} className="shrink-0 text-green-700" aria-hidden="true" />
          <span className="font-medium">{distanceLabel}</span>
        </div>
      )}
      <div className="produce-pickup-map relative z-0 h-72 overflow-hidden rounded-lg border border-sage-200 sm:h-80" role="region" aria-label={`Pickup map for ${produceName}`}>
        <MapContainer
          key={coordinates.join(',')}
          center={coordinates}
          zoom={15}
          minZoom={2}
          maxZoom={19}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
        >
          <TileLayer
            key={tileAttempt}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            eventHandlers={{ loading: () => setLoading(true), load: () => setLoading(false), tileerror: () => { setTileError(true); setLoading(false); } }}
          />
          <MapSize />
          <Marker key={produceName} position={coordinates} icon={markerIcon} alt={`Pickup for ${produceName}`} title={`Pickup for ${produceName}`}>
            <Popup maxHeight={150}><strong>{produceName}</strong><p>{publicLocation || 'Confirmed public pickup point'}</p>{isDemo && <p>Sample pickup pin, not a verified farm location.</p>}</Popup>
          </Marker>
          {buyerCoordinates && (
            <Marker position={buyerCoordinates} icon={markerIcon} alt="Your location">
              <Popup>Your location</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
      {loading && !tileError && <p role="status" className="text-xs text-black/60">Loading pickup map...</p>}
      {tileError && <p role="alert" className="text-xs text-black/65">Map tiles could not load. The saved pickup point and product details are still available. <button type="button" className="inline-flex min-h-11 items-center font-semibold underline" onClick={() => { setTileError(false); setLoading(true); setTileAttempt((attempt) => attempt + 1); }}>Retry map tiles</button></p>}
      <p className="text-xs text-[#596650]">
        {isDemo ? 'This is a simulated pickup pin in the local demo, not a verified farmer location.' : 'This public pickup pin was provided by the farmer, not independently verified. Confirm the meeting point before handover.'}
      </p>
    </div>
  );
}
