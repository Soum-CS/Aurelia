"use client";

import { StayConcierge } from "@/components/stay/stay-concierge";

export function ConciergeChat({
  bookingCode,
  hotelName,
}: {
  bookingCode: string;
  hotelName: string;
}) {
  return <StayConcierge bookingCode={bookingCode} hotelName={hotelName} />;
}

