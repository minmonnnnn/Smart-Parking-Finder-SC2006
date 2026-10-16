export interface CarparkCardData {
  carParkNo?: string;
  name: string;
  distanceMeters: number;
  walkingEtaMinutes: number;
  availableLots: number;
  totalLots: number;
  isSheltered?: boolean;
  hasEvCharging?: boolean;
  parkingCost?: number | null;
  carparkType?: string;
  latitude?: number;
  longitude?: number;
}

export interface RawCarparkInput {
  carpark?: {
    carParkNo?: string;
    id?: string;
    address?: string;
    name?: string;
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
    carParkType?: string;
    isSheltered?: boolean;
    totalLots?: number;
    hasEvCharging?: boolean;
    parkingCost?: number | null;
  };
  availability?: {
    availableLots?: number;
    totalLots?: number;
    status?: string;
  };
  distanceMeters?: number;
  distance?: number;
  walkingEtaMinutes?: number;
  carParkNo?: string;
  id?: string;
  address?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  carParkType?: string;
  isSheltered?: boolean;
  totalLots?: number;
  availableLots?: number;
  hasEvCharging?: boolean;
  parkingCost?: number | null;
}

export function availabilityTone(pct: number): 'success' | 'warning' | 'danger' {
  if (pct >= 30) return 'success';
  if (pct >= 10) return 'warning';
  return 'danger';
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

export function toCarparkCardData(item: RawCarparkInput): CarparkCardData {
  const carpark = item.carpark || item;
  const avail = item.availability || item;
  const total = avail.totalLots || carpark.totalLots || 120;
  const available = avail.availableLots ?? 42;
  const dist =
    item.distanceMeters ??
    (item.distance !== undefined ? Math.round(item.distance * 1000) : 600);
  const walkingEta =
    item.walkingEtaMinutes ?? Math.max(1, Math.round(dist / 80));

  return {
    carParkNo: carpark.carParkNo || carpark.id,
    name: carpark.address || carpark.name || carpark.carParkNo || 'Nearby Carpark',
    distanceMeters: dist,
    walkingEtaMinutes: walkingEta,
    availableLots: available,
    totalLots: total,
    isSheltered: carpark.isSheltered ?? (carpark.carParkType !== undefined && carpark.carParkType !== 'Surface'),
    hasEvCharging: Boolean(carpark.hasEvCharging),
    parkingCost: carpark.parkingCost !== undefined ? carpark.parkingCost : 0.6,
    carparkType: carpark.carParkType || 'Multi-storey',
    latitude: carpark.latitude ?? carpark.lat,
    longitude: carpark.longitude ?? carpark.lng,
  };
}

