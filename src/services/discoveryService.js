import { filterListings } from './produceService.js';
import { distanceKm, getCoordinates, listingCoordinates } from '../utils/location.js';

export const DISTANCE_RADII = ['1', '5', '10', '25', 'all'];

export function invalidDiscoveryFilters(filters) {
  return ['minPrice', 'maxPrice', 'minQuantity'].some((key) => filters[key] !== '' && filters[key] != null && (!Number.isFinite(Number(filters[key])) || Number(filters[key]) < 0))
    || (filters.minPrice !== '' && filters.minPrice != null && filters.maxPrice !== '' && filters.maxPrice != null && Number(filters.maxPrice) < Number(filters.minPrice))
    || (filters.radius != null && !DISTANCE_RADII.includes(String(filters.radius)));
}

export function discoverListings(publicListings, filters = {}, origin = null, buyerCoordinates = null) {
  if (invalidDiscoveryFilters(filters)) return { listings: [], mapListings: [], unlocatedCount: 0, excludedUnlocatedCount: 0 };
  const coordinates = Array.isArray(origin) ? getCoordinates(...origin) : null;
  const matches = filterListings(publicListings, filters)
    .filter((listing) => !filters.barangay || listing.pickup_barangay === filters.barangay)
    .map((listing) => {
      const pin = listingCoordinates(listing);
      return { ...listing, distance_km: distanceKm(coordinates, pin), buyer_distance_km: distanceKm(buyerCoordinates, pin) };
    });
  const unlocatedCount = matches.filter((listing) => !listingCoordinates(listing)).length;
  const radius = filters.radius == null || filters.radius === 'all' ? null : Number(filters.radius);
  const distanceBased = coordinates && (radius !== null || filters.sort === 'nearest');
  const listings = matches.filter((listing) => !distanceBased || (listing.distance_km !== null && (radius === null || listing.distance_km <= radius)));
  if (coordinates && filters.sort === 'nearest') {
    listings.sort((a, b) => a.distance_km - b.distance_km || Date.parse(b.created_at) - Date.parse(a.created_at) || String(a.id).localeCompare(String(b.id)));
  }
  return { listings, mapListings: listings.filter((listing) => listingCoordinates(listing)), unlocatedCount, excludedUnlocatedCount: distanceBased ? unlocatedCount : 0 };
}
