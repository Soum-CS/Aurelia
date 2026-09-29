import { datasetProvider } from "@/lib/hotels/csv-provider";
import { DatasetUnavailableError } from "@/lib/hotels/csv-loader";
import { amadeusConfigured, amadeusProvider, AmadeusError } from "./amadeus";
import type { HotelProvider } from "./types";

export * from "./types";
export { amadeusConfigured, AmadeusError, DatasetUnavailableError };

export type ProviderMode = "csv" | "amadeus";

/**
 * Resolve the active hotel data source from HOTEL_PROVIDER:
 *   csv     → the configured Aurelia dataset (default; no API credentials)
 *   amadeus → live Amadeus APIs (requires HOTEL_API_KEY / HOTEL_API_SECRET)
 */
export function providerMode(): ProviderMode {
  return process.env.HOTEL_PROVIDER === "amadeus" ? "amadeus" : "csv";
}

export function getProvider(): HotelProvider | null {
  if (providerMode() === "amadeus") {
    return amadeusConfigured() ? amadeusProvider : null;
  }
  return datasetProvider;
}

/** True only for a real-time market feed (never true for the dataset). */
export function isLiveInventory(): boolean {
  return providerMode() === "amadeus" && amadeusConfigured();
}

/** Exact environment configuration required for the active mode. */
export function providerStatus() {
  const mode = providerMode();
  if (mode === "csv") {
    return { configured: true, providerId: "csv-dataset" as const, mode, requires: [] };
  }
  const configured = amadeusConfigured();
  return {
    configured,
    providerId: configured ? ("amadeus" as const) : null,
    mode,
    requires: configured
      ? []
      : ([
          { env: "HOTEL_PROVIDER", value: "amadeus" },
          { env: "HOTEL_API_KEY", value: "<from developers.amadeus.com>" },
          { env: "HOTEL_API_SECRET", value: "<from developers.amadeus.com>" },
        ] satisfies Array<{ env: string; value: string }>),
  };
}
