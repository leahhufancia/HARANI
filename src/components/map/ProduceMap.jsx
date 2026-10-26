import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { getCoordinates } from '../../utils/location';

const markerIcon = L.icon({
  iconRetinaUrl: markerRetinaUrl,
  iconUrl: markerIconUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

// Naga City, Camarines Sur coordinates
const NAGA_CITY_COORDS = [13.6217, 123.1942];

// Haversine formula for calculating distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
  return R * c;
}

export default function ProduceMap({ pickupLocation, latitude, longitude, buyerLocation = null }) {
  const coordinates = getCoordinates(latitude, longitude);
  const buyerCoordinates = Array.isArray(buyerLocation) ? getCoordinates(buyerLocation[0], buyerLocation[1]) : null;

  if (!coordinates) {
    return (
      <div className="surface-sage rounded-xl border p-5">
        <div className="flex items-start gap-3"><span className="section-icon"><MapPin size={20} aria-hidden="true" /></span><div><p className="text-sm font-semibold text-green-900">Exact map pin not provided</p><p className="mt-1 text-xs text-[#596650]">{pickupLocation || 'Ask the farmer for a general pickup location.'}</p></div></div>
        <p className="mt-3 text-xs leading-relaxed text-[#596650]">Confirm the meeting point with the farmer before pickup. A map appears when valid pickup coordinates are provided.</p>
      </div>
    );
  }

  const origin = buyerCoordinates || NAGA_CITY_COORDS;
  const distance = calculateDistance(origin[0], origin[1], coordinates[0], coordinates[1]);
  const distanceLabel = `About ${distance.toFixed(1)} km ${buyerCoordinates ? 'from your location' : 'from central Naga City'} (straight-line distance)`;

  return (
    <div className="space-y-3">
      {distanceLabel && (
        <div className="flex items-center gap-2 text-sm">
          <MapPin size={16} className="shrink-0 text-green-700" aria-hidden="true" />
          <span className="font-medium">{distanceLabel}</span>
        </div>
      )}
      <div className="relative z-0 h-64 overflow-hidden rounded-xl border border-sage-200" role="region" aria-label="Produce pickup map">
        <MapContainer
          key={coordinates.join(',')}
          center={coordinates}
          zoom={14}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={coordinates} icon={markerIcon} alt="Produce pickup location">
            <Popup>{pickupLocation || 'Produce pickup location'}</Popup>
          </Marker>
          {buyerCoordinates && (
            <Marker position={buyerCoordinates} icon={markerIcon} alt="Your location">
              <Popup>Your location</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
      <p className="text-xs text-[#596650]">
        This pin was provided by the farmer. Confirm the exact meeting point before handover.
      </p>
    </div>
  );
}
