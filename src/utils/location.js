export function getCoordinates(latitude, longitude) {
  const number = (value) => {
    if (typeof value !== 'number' && typeof value !== 'string') return NaN;
    if (typeof value === 'string' && !value.trim()) return NaN;
    return Number(value);
  };
  const lat = number(latitude);
  const lng = number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lat, lng] : null;
}

export function distanceKm(from, to) {
  const start = Array.isArray(from) && getCoordinates(...from);
  const end = Array.isArray(to) && getCoordinates(...to);
  if (!start || !end) return null;
  const radians = (degrees) => degrees * Math.PI / 180;
  const latitude = radians(end[0] - start[0]);
  const longitude = radians(end[1] - start[1]);
  const haversine = Math.sin(latitude / 2) ** 2
    + Math.cos(radians(start[0])) * Math.cos(radians(end[0])) * Math.sin(longitude / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, haversine))));
}

export function listingCoordinates(listing) {
  return listing.pickup_location_public === true ? getCoordinates(listing.pickup_latitude, listing.pickup_longitude) : null;
}

export function distanceLabel(listing, originLabel = 'from you') {
  if (!Number.isFinite(listing.distance_km)) return '';
  const distance = listing.distance_km < 0.1 ? '<0.1' : listing.distance_km.toFixed(1);
  return `${distance} km ${originLabel}${listing.location_is_demo ? ' (sample pin)' : ''}`;
}

// Cluster in screen space, using an actual listing pin as each group's anchor.
// A cluster is never a new farmer location, and collocated products stay distinct.
export function clusterListings(listings, project, radius = 48) {
  const cells = new Map();
  const groups = [];
  for (const listing of listings) {
    const coordinates = listingCoordinates(listing);
    if (!coordinates) continue;
    const { x, y } = project(coordinates);
    const cellX = Math.floor(x / radius);
    const cellY = Math.floor(y / radius);
    let group;
    for (let dx = -1; dx <= 1 && !group; dx++) {
      for (let dy = -1; dy <= 1 && !group; dy++) {
        group = cells.get(`${cellX + dx}:${cellY + dy}`)?.find((item) => Math.hypot(item.x - x, item.y - y) < radius);
      }
    }
    if (group) group.listings.push(listing);
    else {
      group = { id: listing.id, coordinates, x, y, listings: [listing] };
      groups.push(group);
      const key = `${cellX}:${cellY}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(group);
    }
  }
  return groups;
}
