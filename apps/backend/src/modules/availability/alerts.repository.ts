import type { AvailabilityStatus } from "./service.js";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AvailabilityAlert {
  id: number;
  userId: string;
  carParkNo: string;
  enabled: boolean;
  lastKnownStatus: AvailabilityStatus;
}

export interface StoredAvailabilityAlert extends Omit<
  AvailabilityAlert,
  "lastKnownStatus"
> {
  lastKnownStatus: AvailabilityStatus | null;
}

export interface AlertRepository {
  createAlert(
    userId: string,
    carParkNo: string,
    lastKnownStatus: AvailabilityStatus,
  ): Promise<StoredAvailabilityAlert>;

  setAlertEnabled(
    id: number,
    userId: string,
    enabled: boolean,
  ): Promise<StoredAvailabilityAlert | null>;

  getEnabledAlerts(): Promise<StoredAvailabilityAlert[]>;

  updateAlertLastKnownStatus(
    id: number,
    status: AvailabilityStatus,
  ): Promise<StoredAvailabilityAlert | null>;
}

interface AlertRow {
  id: number;
  user_id: string;
  car_park_no: string;
  enabled: boolean;
  last_known_status: AvailabilityStatus | null;
}

const ALERT_COLUMNS = "id,user_id,car_park_no,enabled,last_known_status";

function mapAlert(row: AlertRow): StoredAvailabilityAlert {
  return {
    id: row.id,
    userId: row.user_id,
    carParkNo: row.car_park_no,
    enabled: row.enabled,
    lastKnownStatus: row.last_known_status,
  };
}

export function createAlertRepository(client: SupabaseClient): AlertRepository {
  return {
    async createAlert(userId, carParkNo, lastKnownStatus) {
      const { data, error } = await client
        .from("alerts")
        .insert({
          user_id: userId,
          car_park_no: carParkNo,
          last_known_status: lastKnownStatus,
          enabled: true,
        })
        .select(ALERT_COLUMNS)
        .single();

      if (error) throw error;
      if (!data) throw new Error("Missing created alert");

      return mapAlert(data as AlertRow);
    },

    async setAlertEnabled(id, userId, enabled) {
      const { data, error } = await client
        .from("alerts")
        .update({ enabled })
        .eq("id", id)
        .eq("user_id", userId)
        .select(ALERT_COLUMNS)
        .maybeSingle();

      if (error) throw error;

      return data ? mapAlert(data as AlertRow) : null;
    },

    async getEnabledAlerts() {
      const result: StoredAvailabilityAlert[] = [];
      const pageSize = 400;

      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await client
          .from("alerts")
          .select(ALERT_COLUMNS)
          .eq("enabled", true)
          .order("id")
          .range(offset, offset + pageSize - 1);

        if (error) throw error;
        if (!data) throw new Error("Missing enabled alerts result");

        const rows = data as AlertRow[];
        result.push(...rows.map(mapAlert));

        if (rows.length < pageSize) return result;
      }
    },

    // Internal checker operation; ownership-sensitive API updates
    // must use setAlertEnabled instead.
    async updateAlertLastKnownStatus(id, status) {
      const { data, error } = await client
        .from("alerts")
        .update({ last_known_status: status })
        .eq("id", id)
        .select(ALERT_COLUMNS)
        .maybeSingle();

      if (error) throw error;

      return data ? mapAlert(data as AlertRow) : null;
    },
  };
}
