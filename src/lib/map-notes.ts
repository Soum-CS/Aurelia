import { db } from "./db";
import { reverseGeocodeDetailed } from "./geocoding";

/**
 * Third-party map note verification (LocusMap imports).
 *
 * Core rule: the note's description is a CLAIM, never a fact. Coordinates are
 * reverse-geocoded through the configured geocoding provider and compared.
 * A description that doesn't match its coordinates becomes LOCATION_MISMATCH —
 * coordinates are never silently changed and unverified notes are never
 * presented as verified facts.
 *
 * Lifecycle: IMPORTED → NEEDS_VERIFICATION → VERIFIED | LOCATION_MISMATCH → RESOLVED | REJECTED
 */

export const NOTE_STATUSES = [
  "NEEDS_VERIFICATION",
  "VERIFIED",
  "LOCATION_MISMATCH",
  "RESOLVED",
  "REJECTED",
] as const;
export type NoteStatus = (typeof NOTE_STATUSES)[number];

export interface NoteVerificationResult {
  status: "VERIFIED" | "LOCATION_MISMATCH" | "NEEDS_VERIFICATION";
  address: {
    formatted: string | null;
    country: string | null;
    state: string | null;
    district: string | null;
    city: string | null;
  };
  reason: string;
}

/** Token-overlap match between the claimed description and real address parts. */
function descriptionMatches(description: string, address: NonNullable<NoteVerificationResult["address"]>): boolean {
  const tokens = description
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4); // ignore tiny words like "of", "the"
  if (tokens.length === 0) return false;
  const haystack = [
    address.city,
    address.district,
    address.state,
    address.country,
    address.formatted,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  // every meaningful token in the claim must appear in the actual location
  return tokens.every((t) => haystack.includes(t));
}

export async function verifyMapNote(noteId: string): Promise<NoteVerificationResult> {
  const note = await db.mapNote.findUnique({ where: { noteId } });
  if (!note) throw new Error(`Map note ${noteId} not found`);

  let address: NoteVerificationResult["address"] = {
    formatted: null, country: null, state: null, district: null, city: null,
  };

  try {
    const detailed = await reverseGeocodeDetailed(note.latitude, note.longitude);
    if (detailed) address = detailed;
  } catch {
    // Geocoder unreachable: leave NEEDS_VERIFICATION with stored fields intact.
    return {
      status: "NEEDS_VERIFICATION",
      address,
      reason: "Reverse geocoding is temporarily unavailable — the note stays pending rather than being guessed.",
    };
  }

  if (!address.formatted) {
    return {
      status: "NEEDS_VERIFICATION",
      address,
      reason: "No address found at these coordinates — marked for manual review.",
    };
  }

  await db.mapNote.update({
    where: { noteId },
    data: {
      reverseGeocodedAddress: address.formatted,
      country: address.country,
      state: address.state,
      district: address.district,
      city: address.city,
    },
  });

  if (descriptionMatches(note.description, address)) {
    return {
      status: "VERIFIED",
      address,
      reason: `Description matches the reverse-geocoded location (${[address.city, address.state].filter(Boolean).join(", ")}).`,
    };
  }

  return {
    status: "LOCATION_MISMATCH",
    address,
    reason: `Coordinates resolve to ${[
      address.city ?? address.district,
      address.state,
      address.country,
    ]
      .filter(Boolean)
      .join(", ")}, which does not match the claimed “${note.description}”. The original coordinates and description are preserved.`,
  };
}
