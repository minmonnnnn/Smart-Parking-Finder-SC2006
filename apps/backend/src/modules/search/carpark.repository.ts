import type { SupabaseClient } from '@supabase/supabase-js';
import type { Carpark, CarparkType } from '@smart-parking/shared-types';

interface CarparkRow {
  car_park_no: string;
  address: string;
  latitude: number;
  longitude: number;
  car_park_type: CarparkType;
  total_lots: number | null;
  free_parking: string | null;
  night_parking: string | null;
  has_ev_charging: boolean | null;
  parking_system: 'Electronic' | 'Coupon' | null;
  postal_code: string | null;
  parking_cost: number | null;
  updated_at: string;
}

const SHELTERED_TYPES: CarparkType[] = ['Basement', 'Multi-storey', 'Covered'];

function rowToCarpark(row: CarparkRow): Carpark {
  return {
    carParkNo: row.car_park_no,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    carParkType: row.car_park_type,
    isSheltered: SHELTERED_TYPES.includes(row.car_park_type),
    totalLots: row.total_lots ?? 0,
    freeParking: row.free_parking ?? null,
    nightParking: row.night_parking ?? 'NO',
    hasEvCharging: row.has_ev_charging ?? false,
    parkingSystem: row.parking_system ?? 'Electronic',
    postalCode: row.postal_code ?? null,
    parkingCost: row.parking_cost ?? null,
    updatedAt: row.updated_at,
  };
}

// Returns all carparks within ~5km of the destination using a bounding box pre-filter.
// PostGIS not required — the bounding box is tight enough for Singapore's scale.
export async function getCarparksNearby(
  client: SupabaseClient,
  destLat: number,
  destLng: number,
  radiusKm = 5,
): Promise<Carpark[]> {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((destLat * Math.PI) / 180));

  const { data, error } = await client
    .from('carparks')
    .select('*')
    .gte('latitude', destLat - latDelta)
    .lte('latitude', destLat + latDelta)
    .gte('longitude', destLng - lngDelta)
    .lte('longitude', destLng + lngDelta);

  if (error) throw new Error(`carparks query failed: ${error.message}`);
  return (data as CarparkRow[]).map(rowToCarpark);
}

export async function getCarparkByNo(
  client: SupabaseClient,
  carParkNo: string,
): Promise<Carpark | null> {
  // 1. Try exact match on car_park_no
  const { data: exactMatch, error: err1 } = await client
    .from('carparks')
    .select('*')
    .eq('car_park_no', carParkNo)
    .maybeSingle();

  if (err1) throw new Error(`carpark lookup failed: ${err1.message}`);
  if (exactMatch) return rowToCarpark(exactMatch as CarparkRow);

  // 2. Fallback to matching by address (e.g. from saved favourites)
  const { data: addrMatch, error: err2 } = await client
    .from('carparks')
    .select('*')
    .ilike('address', `%${carParkNo}%`)
    .limit(1);

  if (err2) throw new Error(`carpark lookup failed: ${err2.message}`);
  if (addrMatch && addrMatch.length > 0 && addrMatch[0]) {
    return rowToCarpark(addrMatch[0] as CarparkRow);
  }

  return null;
}
