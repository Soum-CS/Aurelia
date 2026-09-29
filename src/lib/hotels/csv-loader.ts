/**
 * Server-side CSV dataset loader.
 *
 * Reads data/hotels_india_live_locations.csv (the configured Aurelia hotel
 * dataset — 15 columns, 36 records), validates and converts every row into
 * typed objects. No hotel values are ever invented: malformed rows are
 * skipped and reported, never repaired with defaults.
 */

export interface CsvHotel {
  hotel_id: string;
  name: string;
  city: string;
  state: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  rating_count: number;
  phone_number: string;
  room_type: string;
  price_per_night_inr: number;
  rooms_available: number;
  /** ISO date strings (YYYY-MM-DD). */
  available_from: string;
  available_to: string;
}

export class DatasetUnavailableError extends Error {
  constructor(message = "Hotel dataset unavailable.") {
    super(message);
    this.name = "DatasetUnavailableError";
  }
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (field || row.length) {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      }
      if (c === "\r" && text[i + 1] === "\n") i++;
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const num = (v: string): number => Number.parseFloat(v.trim());

let cache: { hotels: CsvHotel[]; skipped: number } | null = null;

export async function loadDataset(): Promise<{ hotels: CsvHotel[]; skipped: number }> {
  if (cache) return cache;

  const [{ default: fs }, { join }] = await Promise.all([
    import("node:fs"),
    import("node:path"),
  ]);
  const file = join(process.cwd(), "data", "hotels_india_live_locations.csv");

  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    throw new DatasetUnavailableError(
      "Hotel dataset unavailable. Please configure the Aurelia hotel dataset (data/hotels_india_live_locations.csv)."
    );
  }

  const [header, ...lines] = parseCsv(raw);
  const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
  const required = [
    "hotel_id", "name", "city", "state", "address", "latitude", "longitude",
    "rating", "rating_count", "phone_number", "room_type",
    "price_per_night_inr", "rooms_available", "available_from", "available_to",
  ];
  for (const col of required) {
    if (!(col in idx)) throw new DatasetUnavailableError(`Hotel dataset is missing the "${col}" column.`);
  }

  const hotels: CsvHotel[] = [];
  let skipped = 0;
  for (const line of lines) {
    if (!line.length || !line[idx.hotel_id]?.trim()) continue;
    try {
      const h: CsvHotel = {
        hotel_id: line[idx.hotel_id].trim(),
        name: line[idx.name].trim(),
        city: line[idx.city].trim(),
        state: line[idx.state].trim(),
        address: line[idx.address].trim(),
        latitude: num(line[idx.latitude]),
        longitude: num(line[idx.longitude]),
        rating: num(line[idx.rating]),
        rating_count: Math.round(num(line[idx.rating_count])),
        phone_number: line[idx.phone_number].trim(),
        room_type: line[idx.room_type].trim(),
        price_per_night_inr: num(line[idx.price_per_night_inr]),
        rooms_available: Math.round(num(line[idx.rooms_available])),
        available_from: normalizeDate(line[idx.available_from]),
        available_to: normalizeDate(line[idx.available_to]),
      };
      const valid =
        [h.hotel_id, h.name].every(Boolean) &&
        Number.isFinite(h.latitude) && Number.isFinite(h.longitude) &&
        Number.isFinite(h.price_per_night_inr) && h.price_per_night_inr > 0 &&
        Number.isFinite(h.rooms_available) && h.rooms_available >= 0 &&
        !Number.isNaN(Date.parse(h.available_from)) &&
        !Number.isNaN(Date.parse(h.available_to));
      if (!valid) throw new Error("invalid row");
      hotels.push(h);
    } catch {
      skipped += 1; // malformed rows are skipped, never fabricated
    }
  }

  if (!hotels.length) throw new DatasetUnavailableError("Hotel dataset contained no valid records.");
  cache = { hotels, skipped };
  return cache;
}

function normalizeDate(v: string): string {
  const t = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return t; // validation flags it later
  return d.toISOString().slice(0, 10);
}

/** Availability window check: stay fully inside the record's window. */
export function isAvailableForStay(h: CsvHotel, checkIn: string, checkOut: string, rooms: number): boolean {
  if (h.rooms_available <= 0 || rooms > h.rooms_available) return false;
  return h.available_from <= checkIn && checkOut <= h.available_to;
}
