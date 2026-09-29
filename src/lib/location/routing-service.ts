import { GeoPoint } from "../geo";

export interface DestinationTarget {
  latitude: number;
  longitude: number;
  name: string;
  address?: string;
}

export function getGoogleMapsUrl(dest: DestinationTarget, origin?: GeoPoint): string {
  const destQuery = encodeURIComponent(`${dest.name}, ${dest.address ?? `${dest.latitude},${dest.longitude}`}`);
  if (origin) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${dest.latitude},${dest.longitude}&destination_place_id=&travelmode=driving`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${destQuery}`;
}

export function getAppleMapsUrl(dest: DestinationTarget, origin?: GeoPoint): string {
  const q = encodeURIComponent(dest.name);
  if (origin) {
    return `https://maps.apple.com/?saddr=${origin.latitude},${origin.longitude}&daddr=${dest.latitude},${dest.longitude}&q=${q}`;
  }
  return `https://maps.apple.com/?ll=${dest.latitude},${dest.longitude}&q=${q}`;
}

export function getOpenStreetMapUrl(dest: DestinationTarget): string {
  return `https://www.openstreetmap.org/?mlat=${dest.latitude}&mlon=${dest.longitude}#map=16/${dest.latitude}/${dest.longitude}`;
}
