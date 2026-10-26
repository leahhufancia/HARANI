import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { divIcon } from 'leaflet';
import { LocateFixed, Maximize2, Search } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import ProduceImage from '../marketplace/ProduceImage';
import { clusterListings, distanceLabel, listingCoordinates } from '../../utils/location';
import { money, quantity } from '../../utils/format';

function MapView({ focusRequest, buyerLocation }) {
  const map = useMap();
  const buyerLat = buyerLocation?.coordinates[0];
  const buyerLng = buyerLocation?.coordinates[1];
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  useEffect(() => {
    if (buyerLat != null && buyerLng != null) map.setView([buyerLat, buyerLng], 14, { animate: false });
  }, [map, buyerLat, buyerLng]);
  useEffect(() => {
    if (!focusRequest?.points?.length) return;
    map.invalidateSize({ pan: false });
    if (focusRequest.listingId) map.setView(focusRequest.points[0], 17, { animate: false });
    else map.fitBounds(focusRequest.points, { padding: [40, 40], maxZoom: 15, animate: false });
  }, [map, focusRequest]);
  return null;
}

function ListingPin({ group, selectedId, focusRequest, onSelect, onShowList, originLabel }) {
  const map = useMap();
  const marker = useRef(null);
  const selected = group.listings.some((listing) => listing.id === selectedId);
  const count = group.listings.length;
  const icon = divIcon({
    className: `produce-map-pin${count > 1 ? ' is-cluster' : ''}${selected ? ' is-selected' : ''}`,
    html: `<span aria-hidden="true">${count > 1 ? count : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21v-9m0 4C4 16 3 10 3 6c6 0 9 3 9 7m0-1c0-6 4-9 9-9 0 6-3 9-9 9"/></svg>'}</span>`,
    iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -22],
  });
  const label = count > 1 ? `${count} produce listings at nearby pickup points` : group.listings[0].produce_name;
  useEffect(() => {
    if (selected && focusRequest?.listingId === selectedId) marker.current?.openPopup();
  }, [selected, selectedId, focusRequest, label]);
  return <Marker key={label} ref={marker} position={group.coordinates} icon={icon} alt={label} title={label} zIndexOffset={selected ? 1000 : 0}
    eventHandlers={{ click: () => onSelect(selected ? selectedId : group.listings[0].id) }}>
    <Popup minWidth={240} maxWidth={300} autoPan={false}>
      {count > 1 && <div className="mb-3 border-b border-black/10 pb-2"><strong>{count} nearby harvests</strong><button type="button" className="map-popup-action" onClick={() => map.fitBounds(group.listings.map(listingCoordinates), { maxZoom: 18, padding: [40, 40], animate: false })}>Zoom to these pickups</button></div>}
      <div className="map-popup-products">
        {group.listings.map((listing) => <div key={listing.id} data-listing-id={listing.id} className={`map-popup-product${listing.id === selectedId ? ' is-selected' : ''}`}>
          <div className="flex items-start gap-3"><ProduceImage src={listing.image_url} alt={listing.produce_name} className="h-14 w-14 shrink-0 rounded" /><div className="min-w-0"><button type="button" className="text-left font-bold hover:underline" onClick={() => onSelect(listing.id)}>{listing.produce_name}</button><div className="mt-1">{money(listing.price_per_unit)} / {listing.unit}</div><div className="text-xs">{quantity(listing.available_quantity)} {listing.unit} available</div></div></div>
          {distanceLabel(listing, originLabel) && <div className="mt-2 text-xs">{distanceLabel(listing, originLabel)}</div>}
          {listing.location_is_demo && <div className="mt-1 text-xs font-semibold">Sample pickup pin, not a verified farm</div>}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><Link className="map-popup-action" to={`/marketplace/${listing.id}`}>View Details</Link><button type="button" className="map-popup-action" onClick={() => onShowList(listing.id)}>Show in results</button></div>
        </div>)}
      </div>
    </Popup>
  </Marker>;
}

function ListingPins(props) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  const groups = clusterListings(props.listings, (coordinates) => map.project(coordinates, zoom));
  return groups.map((group) => <ListingPin key={group.id} {...props} group={group} />);
}

export default function MarketplaceMap({ listings, initialPoints, buyerLocation, searchOrigin, radius, selectedId, focusRequest, onSelect, onShowList, onSearchArea, onReturnToBuyer, originLabel }) {
  const map = useRef(null);
  const [initial] = useState(() => initialPoints.length ? { bounds: initialPoints, boundsOptions: { padding: [40, 40], maxZoom: 13 } } : { center: [0, 0], zoom: 2 });
  const [tileError, setTileError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tileRevision, setTileRevision] = useState(0);
  return <section aria-label="Nearby produce map" className="nearby-map-panel">
    <div className="flex flex-wrap gap-2 border-b border-black/10 bg-white p-3">
      <button type="button" className="btn btn-primary" onClick={() => { const center = map.current?.getCenter().wrap(); if (center) onSearchArea([center.lat, center.lng]); }}><Search />Search this area</button>
      <button type="button" className="btn btn-secondary" disabled={!buyerLocation} onClick={onReturnToBuyer} aria-label="Return to my location"><LocateFixed /><span className="hidden sm:inline">My location</span></button>
      <button type="button" className="btn btn-secondary" disabled={!listings.length} onClick={() => map.current?.fitBounds(listings.map(listingCoordinates), { padding: [40, 40], maxZoom: 15, animate: false })} aria-label="Fit all matching pickup points"><Maximize2 /><span className="hidden sm:inline">Fit results</span></button>
    </div>
    <div className="nearby-map-canvas" role="region" aria-label="Interactive pickup map. Use arrow keys to pan and plus or minus to zoom.">
      <MapContainer ref={map} {...initial} minZoom={2} maxZoom={19} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer key={tileRevision} url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          eventHandlers={{ loading: () => setLoading(true), load: () => setLoading(false), tileerror: () => { setTileError(true); setLoading(false); } }} />
        <MapView focusRequest={focusRequest} buyerLocation={buyerLocation} />
        {searchOrigin && radius !== 'all' && <Circle center={searchOrigin} radius={Number(radius) * 1000} interactive={false} pathOptions={{ color: '#159600', fillOpacity: 0.025, weight: 1, dashArray: '5 5' }} />}
        {searchOrigin && originLabel === 'from map search point' && <CircleMarker center={searchOrigin} radius={7} pathOptions={{ color: '#000000', fillColor: '#D0BE00', fillOpacity: 1, weight: 2 }}><Popup>Map search point. This is not your current location.</Popup></CircleMarker>}
        {buyerLocation && <>
          {Number.isFinite(buyerLocation.accuracy) && buyerLocation.accuracy > 0 && <Circle center={buyerLocation.coordinates} radius={buyerLocation.accuracy} interactive={false} pathOptions={{ color: '#2563eb', weight: 1, fillOpacity: 0.05 }} />}
          <CircleMarker center={buyerLocation.coordinates} radius={8} pathOptions={{ color: '#ffffff', fillColor: '#2563eb', fillOpacity: 1, weight: 3 }}><Popup>Your browser location. Not shared with farmers.</Popup></CircleMarker>
        </>}
        <ListingPins listings={listings} selectedId={selectedId} focusRequest={focusRequest} onSelect={onSelect} onShowList={onShowList} originLabel={originLabel} />
      </MapContainer>
      {!listings.length && <div className="map-empty-message" role="status"><strong>No matching pickup pins</strong><span>Move the map and search this area, widen the radius, or clear filters. Listings without a published pin stay off the map.</span></div>}
    </div>
    <div className="space-y-1 border-t border-black/10 bg-white px-4 py-3 text-xs text-black/65">
      <p>Green: public pickup points. Numbered circles group nearby listings. Blue: your location, only after permission.</p>
      {!buyerLocation && <p>No buyer location has been assumed. {initialPoints.length ? 'The initial view fits published pickup pins.' : 'This is a world overview, not a selected location.'}</p>}
      <p>Distances are approximate straight-line distances, not travel routes.</p>
      {loading && !tileError && <p role="status">Loading map tiles...</p>}
      {tileError && <p role="alert">Some map tiles could not load. You can still browse results and pickup pins. <button type="button" className="inline-flex min-h-11 items-center font-semibold underline" onClick={() => { setTileError(false); setLoading(true); setTileRevision((value) => value + 1); }}>Retry map tiles</button></p>}
    </div>
  </section>;
}
