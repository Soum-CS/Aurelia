export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export interface ProjectedPoint extends GeoPoint {
  x: number;
  y: number;
}

/** Linear lat/lng → viewBox projection over the bounding box of all points. */
export function projectPoints(
  points: GeoPoint[],
  width: number,
  height: number,
  pad = 0.18
): ProjectedPoint[] {
  if (points.length === 0) return [];
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLng = Math.min(minLng, p.longitude);
    maxLng = Math.max(maxLng, p.longitude);
  }
  // guarantee a minimum span so single-point views don't blow up
  const mid = (a: number, b: number) => (a + b) / 2;
  if (maxLat - minLat < 0.02) {
    minLat = mid(minLat, maxLat) - 0.01;
    maxLat = mid(minLat, maxLat) + 0.01;
  }
  if (maxLng - minLng < 0.02) {
    minLng = mid(minLng, maxLng) - 0.01;
    maxLng = mid(minLng, maxLng) + 0.01;
  }
  const spanLat = maxLat - minLat;
  const spanLng = maxLng - minLng;
  const px = spanLng * pad;
  const py = spanLat * pad;

  return points.map((p) => ({
    ...p,
    x: ((p.longitude - (minLng - px)) / (spanLng + px * 2)) * width,
    y: height - ((p.latitude - (minLat - py)) / (spanLat + py * 2)) * height,
  }));
}

/** Convert a distance ring (km) around a point into SVG ellipse radii. */
export function ringRadii(
  center: GeoPoint,
  km: number,
  sx: (lng: number) => number,
  sy: (lat: number) => number
): { rx: number; ry: number } {
  const dLat = km / 111;
  const dLng = km / (111 * Math.cos((center.latitude * Math.PI) / 180));
  return { rx: Math.abs(sx(center.longitude + dLng) - sx(center.longitude)), ry: Math.abs(sy(center.latitude + dLat) - sy(center.latitude)) };
}
