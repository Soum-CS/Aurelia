"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { formatDate } from "@/lib/format";

export interface StayPassProps {
  code: string;
  guestName: string;
  hotelName: string;
  roomName: string;
  roomNumber?: string | null;
  checkIn: string | Date;
  checkOut: string | Date;
  guests: number;
  hotelAddress?: string;
  hotelLat?: number;
  hotelLng?: number;
}

export function DigitalStayPass({
  code,
  guestName,
  hotelName,
  roomName,
  roomNumber,
  checkIn,
  checkOut,
  guests,
  hotelAddress,
  hotelLat,
  hotelLng,
}: StayPassProps) {
  const [qrUrl, setQrUrl] = useState<string>("");

  useEffect(() => {
    const payload = JSON.stringify({
      aureliaPass: true,
      code,
      guest: guestName,
      hotel: hotelName,
      room: roomNumber ?? roomName,
      ci: new Date(checkIn).toISOString().slice(0, 10),
      co: new Date(checkOut).toISOString().slice(0, 10),
    });

    QRCode.toDataURL(payload, {
      margin: 1,
      width: 200,
      color: {
        dark: "#1c1917",
        light: "#ffffff",
      },
    })
      .then((url) => setQrUrl(url))
      .catch(() => {});
  }, [code, guestName, hotelName, roomName, roomNumber, checkIn, checkOut]);

  const directionsUrl =
    hotelLat && hotelLng
      ? `https://www.google.com/maps/dir/?api=1&destination=${hotelLat},${hotelLng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${hotelName} ${hotelAddress ?? ""}`
        )}`;

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="relative overflow-hidden rounded-3xl border border-line bg-raised shadow-2xl">
        {/* Pass Top Bar */}
        <div className="flex items-center justify-between border-b border-line bg-background/90 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xl text-accent">⚜️</span>
            <span className="font-display text-sm font-bold tracking-widest uppercase">
              Aurelia Stay Pass
            </span>
          </div>
          <span className="font-mono text-xs font-semibold text-accent">{code}</span>
        </div>

        {/* Pass Main Body */}
        <div className="p-6">
          <p className="eyebrow">Confirmed Reservation</p>
          <h2 className="font-display mt-1 text-2xl font-bold tracking-tight text-foreground">
            {hotelName}
          </h2>
          <p className="mt-1 text-xs text-muted">
            {hotelAddress ?? "Bespoke luxury hospitality sanctuary"}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 text-xs">
            <div>
              <span className="text-muted uppercase tracking-wider text-[10px]">Guest Name</span>
              <p className="mt-0.5 text-sm font-semibold text-foreground">{guestName}</p>
            </div>
            <div>
              <span className="text-muted uppercase tracking-wider text-[10px]">Accommodations</span>
              <p className="mt-0.5 text-sm font-semibold text-foreground">
                {roomNumber ? `${roomNumber} · ` : ""}
                {roomName}
              </p>
            </div>
            <div>
              <span className="text-muted uppercase tracking-wider text-[10px]">Check-in (From 14:00)</span>
              <p className="mt-0.5 text-sm font-semibold text-foreground">{formatDate(checkIn)}</p>
            </div>
            <div>
              <span className="text-muted uppercase tracking-wider text-[10px]">Check-out (Until 11:00)</span>
              <p className="mt-0.5 text-sm font-semibold text-foreground">{formatDate(checkOut)}</p>
            </div>
            <div>
              <span className="text-muted uppercase tracking-wider text-[10px]">Party</span>
              <p className="mt-0.5 text-sm font-semibold text-foreground">{guests} Guests</p>
            </div>
            <div>
              <span className="text-muted uppercase tracking-wider text-[10px]">Status</span>
              <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-emerald-600">
                ● Confirmed
              </p>
            </div>
          </div>
        </div>

        {/* Perforated Divider */}
        <div className="relative flex items-center justify-between border-y border-dashed border-line bg-background/50 px-4 py-2">
          <div className="absolute -left-3 h-6 w-6 rounded-full bg-background border-r border-line" />
          <span className="text-[10px] font-semibold tracking-widest uppercase text-muted">
            Scan at Reception or Self-Check-in Tablet
          </span>
          <div className="absolute -right-3 h-6 w-6 rounded-full bg-background border-l border-line" />
        </div>

        {/* Pass QR Section */}
        <div className="flex flex-col items-center justify-center p-6 text-center">
          {qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrUrl}
              alt={`QR code for stay pass ${code}`}
              className="h-36 w-36 rounded-2xl border border-line p-2 shadow-inner"
            />
          ) : (
            <div className="skeleton h-36 w-36 rounded-2xl" />
          )}
          <span className="font-mono mt-2 text-xs tracking-wider text-muted">{code}</span>

          <div className="mt-5 flex w-full gap-2">
            <a
              href={directionsUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-primary flex-1 justify-center !py-2.5 text-xs font-semibold"
            >
              🗺️ Get Directions
            </a>
            <button
              type="button"
              onClick={() => window.print()}
              className="btn-secondary justify-center !py-2.5 !px-3 text-xs font-semibold"
            >
              🖨️ Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
