import type { LatLng } from '../types/maps';

/** Open Google Maps Directions for a field-work destination. */
export function openGoogleMapsDirections(destination: LatLng): void {
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('destination', `${destination.lat},${destination.lng}`);
  window.open(url.toString(), '_blank', 'noopener,noreferrer');
}
