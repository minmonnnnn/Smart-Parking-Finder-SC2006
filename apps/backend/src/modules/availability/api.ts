export interface RawAvailabilityRecord {
  carParkNo: string;
  availableLots: number;
  totalLots: number;
  fetchedAt: Date;
}

interface DataGovCarparkInfo {
  lot_type: string;
  lots_available: string;
  total_lots: string;
}

interface DataGovCarpark {
  carpark_info: DataGovCarparkInfo[];
  carpark_number: string;
  update_datetime: string;
}

interface DataGovItem {
  timestamp: string;
  carpark_data: DataGovCarpark[];
}

interface DataGovResponse {
  items: DataGovItem[];
}

const AVAILABILITY_API_URL =
  "https://api.data.gov.sg/v1/transport/carpark-availability";

export async function fetchCarparkAvailability(): Promise<
  RawAvailabilityRecord[]
> {
  const response = await fetch(AVAILABILITY_API_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch carpark availability: ${response.status}`);
  }

  const data = (await response.json()) as DataGovResponse;

  const carparks = data.items[0]?.carpark_data;

  if (!carparks) {
    throw new Error("Invalid response from carpark availability API");
  }

  return carparks.flatMap((carpark): RawAvailabilityRecord[] => {
    const carInfo = carpark.carpark_info.find((info) => info.lot_type === "C");

    if (!carInfo) {
      return [];
    }

    const availableText = carInfo.lots_available.trim();
    const totalText = carInfo.total_lots.trim();

    if (availableText === "" || totalText === "") {
      return [];
    }

    const availableLots = Number(availableText);
    const totalLots = Number(totalText);
    const fetchedAt = new Date(carpark.update_datetime);

    if (
      !Number.isInteger(availableLots) ||
      !Number.isInteger(totalLots) ||
      availableLots < 0 ||
      totalLots < 0 ||
      availableLots > totalLots ||
      Number.isNaN(fetchedAt.getTime())
    ) {
      return [];
    }

    return [
      {
        carParkNo: carpark.carpark_number,
        availableLots,
        totalLots,
        fetchedAt,
      },
    ];
  });
}
