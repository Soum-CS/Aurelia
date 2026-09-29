"use client";

import { useEffect, useState } from "react";
import { AIRPORTS, AirportInfo, calculateTravelEstimate, VEHICLE_PRICING } from "@/lib/location/location-service";

interface AirportTransferCardProps {
  hotelId: string;
  hotelName: string;
  hotelLat: number;
  hotelLng: number;
}

export function AirportTransferCard({
  hotelId,
  hotelName,
  hotelLat,
  hotelLng,
}: AirportTransferCardProps) {
  const [nearestAirports, setNearestAirports] = useState<AirportInfo[]>([]);
  const [selectedAirportCode, setSelectedAirportCode] = useState("");
  const [type, setType] = useState<"PICKUP" | "DROP">("PICKUP");
  const [vehicle, setVehicle] = useState<keyof typeof VEHICLE_PRICING>("SEDAN");
  const [passengers, setPassengers] = useState(2);
  const [flightNumber, setFlightNumber] = useState("");
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<{
    code: string;
    priceInr: number;
    travelTimeText: string;
    vehicleLabel: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hotelPoint = { latitude: hotelLat, longitude: hotelLng };
    const sorted = AIRPORTS.map((a) => {
      const est = calculateTravelEstimate(hotelPoint, a);
      return {
        ...a,
        distanceKm: est.distanceKm,
        drivingTimeMinutes: est.drivingMinutes,
        formattedDistance: est.formattedDistance,
        formattedTravelTime: est.formattedDrivingTime,
      };
    }).sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));

    setNearestAirports(sorted.slice(0, 3));
    if (sorted[0]) setSelectedAirportCode(sorted[0].code);
  }, [hotelLat, hotelLng]);

  const selectedAirport = nearestAirports.find((a) => a.code === selectedAirportCode) || nearestAirports[0];
  const vehicleInfo = VEHICLE_PRICING[vehicle] || VEHICLE_PRICING.SEDAN;
  const distance = selectedAirport?.distanceKm ?? 25;
  const estimatedPriceInr = vehicleInfo.baseInr + Math.round(distance * vehicleInfo.perKmInr);

  async function handleBookTransfer(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !phone.trim()) {
      setError("Please provide your name and phone number for the chauffeur.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelId,
          airportCode: selectedAirport.code,
          type,
          vehicleType: vehicle,
          passengers,
          flightNumber,
          scheduledTime: date || new Date(Date.now() + 86400000).toISOString(),
          guestName: name,
          guestPhone: phone,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not book airport transfer.");
      }

      setConfirmedBooking({
        code: data.transfer.code,
        priceInr: data.transfer.priceInr,
        travelTimeText: data.transfer.formattedTravelTime,
        vehicleLabel: data.transfer.vehicleLabel,
      });
      setSubmitting(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Booking transfer failed.");
      setSubmitting(false);
    }
  }

  return (
    <section id="airport-transfer" className="card p-6 shadow-xl sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">VIP Chauffeur Services</p>
          <h3 className="font-display mt-1 text-xl font-semibold sm:text-2xl">
            Airport Intelligence & Transfers
          </h3>
          <p className="mt-1 text-xs leading-relaxed sm:text-sm" style={{ color: "var(--muted)" }}>
            Bespoke terminal meet & greet, luggage assistance, and luxury chauffeur transfers between {hotelName} and nearby international airports.
          </p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-2xl text-accent">
          ✈️
        </div>
      </div>

      {confirmedBooking ? (
        <div className="animate-fade-up mt-6 rounded-2xl border border-line bg-raised/80 p-6 text-center">
          <span className="text-3xl">✅</span>
          <h4 className="font-display mt-2 text-lg font-semibold text-foreground">
            Transfer Confirmed · {confirmedBooking.code}
          </h4>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Your chauffeur has been dispatched and scheduled. Vehicle: {confirmedBooking.vehicleLabel}. Estimated duration: {confirmedBooking.travelTimeText}.
          </p>
          <p className="mt-3 text-lg font-bold text-accent">
            ₹{confirmedBooking.priceInr.toLocaleString("en-IN")}
          </p>
          <button
            type="button"
            onClick={() => setConfirmedBooking(null)}
            className="btn-secondary mt-4 !py-1.5 text-xs font-semibold"
          >
            Book Another Transfer
          </button>
        </div>
      ) : (
        <form onSubmit={handleBookTransfer} className="mt-6 space-y-5">
          {/* Transfer Type toggle */}
          <div className="flex rounded-full border border-line bg-background p-1">
            <button
              type="button"
              onClick={() => setType("PICKUP")}
              className={`flex-1 rounded-full py-2 text-xs font-semibold transition-all ${
                type === "PICKUP"
                  ? "bg-accent text-on-accent shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              🛬 Airport Pickup → Hotel
            </button>
            <button
              type="button"
              onClick={() => setType("DROP")}
              className={`flex-1 rounded-full py-2 text-xs font-semibold transition-all ${
                type === "DROP"
                  ? "bg-accent text-on-accent shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              🛫 Hotel → Airport Drop-off
            </button>
          </div>

          {/* Airport selection */}
          <div>
            <label className="label text-xs">Select Airport</label>
            <div className="mt-1.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {nearestAirports.map((airport) => {
                const isSelected = selectedAirportCode === airport.code;
                return (
                  <button
                    key={airport.code}
                    type="button"
                    onClick={() => setSelectedAirportCode(airport.code)}
                    className={`flex flex-col items-start rounded-2xl border p-3.5 text-left transition-all ${
                      isSelected
                        ? "border-accent bg-accent/10 shadow-sm"
                        : "border-line bg-raised hover:bg-background"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="font-mono text-sm font-bold text-foreground">
                        {airport.code}
                      </span>
                      <span className="text-xs font-semibold text-accent">
                        {airport.formattedDistance}
                      </span>
                    </div>
                    <span className="mt-1 line-clamp-1 text-xs text-muted">
                      {airport.name}
                    </span>
                    <span className="mt-1.5 text-[11px] font-medium text-foreground">
                      🚗 ~{airport.drivingTimeMinutes} min drive
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Vehicle selection */}
          <div>
            <label className="label text-xs">Select Chauffeur Vehicle</label>
            <div className="mt-1.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {(Object.keys(VEHICLE_PRICING) as Array<keyof typeof VEHICLE_PRICING>).map((vKey) => {
                const v = VEHICLE_PRICING[vKey];
                const isSelected = vehicle === vKey;
                const vPrice = v.baseInr + Math.round(distance * v.perKmInr);
                return (
                  <button
                    key={vKey}
                    type="button"
                    onClick={() => setVehicle(vKey)}
                    className={`flex flex-col items-start rounded-2xl border p-3.5 text-left transition-all ${
                      isSelected
                        ? "border-accent bg-accent/10 shadow-sm"
                        : "border-line bg-raised hover:bg-background"
                    }`}
                  >
                    <span className="text-xs font-bold text-foreground">{v.label}</span>
                    <span className="mt-1 text-xs text-muted">Max {v.maxPax} passengers</span>
                    <span className="mt-2 text-sm font-semibold text-accent">
                      ₹{vPrice.toLocaleString("en-IN")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Guest and Flight Details */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label text-xs">Guest Full Name</label>
              <input
                type="text"
                required
                className="input !py-2 text-xs sm:text-sm"
                placeholder="Ava Laurent"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="label text-xs">Contact Phone / WhatsApp</label>
              <input
                type="tel"
                required
                className="input !py-2 text-xs sm:text-sm"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="label text-xs">Flight Number (Optional)</label>
              <input
                type="text"
                className="input !py-2 text-xs sm:text-sm"
                placeholder="e.g. AI-506 / 6E-204"
                value={flightNumber}
                onChange={(e) => setFlightNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="label text-xs">Pickup Date & Time</label>
              <input
                type="datetime-local"
                className="input !py-2 text-xs sm:text-sm"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="rounded-xl bg-red-500/10 p-3 text-xs font-medium text-red-500">
              {error}
            </p>
          )}

          {/* Submit button */}
          <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-xs text-muted">Total Transfer Fare:</span>
              <p className="font-display text-xl font-bold text-foreground">
                ₹{estimatedPriceInr.toLocaleString("en-IN")}
              </p>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary !py-2.5 !px-6 text-xs font-semibold"
            >
              {submitting ? "Booking Transfer…" : "Confirm VIP Transfer"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
