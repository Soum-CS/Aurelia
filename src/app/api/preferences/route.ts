import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserToken, findUserByToken, ensureUser } from "@/lib/user";

export const dynamic = "force-dynamic";

const FOOD_PREFS = ["vegetarian", "vegan", "jain", "spicy", "healthy", "high-protein", "low-cal"];
const MAX_LIST = 20;

function strList(v: unknown): string[] {
  let arr: unknown[] = [];
  if (Array.isArray(v)) {
    arr = v;
  } else if (typeof v === "string") {
    arr = v.split(",");
  } else {
    return [];
  }
  const cleaned = arr
    .map(String)
    .map((s) => s.trim().toLowerCase().slice(0, 40))
    .filter(Boolean);
  return [...new Set(cleaned)].slice(0, MAX_LIST);
}

function normalizeTime(val: unknown): string | null {
  if (typeof val !== "string" || !val.trim()) return null;
  const s = val.trim();
  const m24 = s.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (m24) {
    const hh = m24[1].padStart(2, "0");
    const mm = m24[2];
    return `${hh}:${mm}`;
  }
  const m12 = s.match(/^([01]?\d):([0-5]\d)\s*(am|pm)$/i);
  if (m12) {
    let hh = parseInt(m12[1], 10);
    const mm = m12[2];
    const ampm = m12[3].toUpperCase();
    if (ampm === "PM" && hh < 12) hh += 12;
    if (ampm === "AM" && hh === 12) hh = 0;
    return `${String(hh).padStart(2, "0")}:${mm}`;
  }
  return null;
}

function parsePrefs(row: {
  foodPrefs: string; cuisines: string; roomPrefs: string; interests: string;
  allergies: string; bedPreference: string | null; temperatureC: number | null;
  budgetPerNightInr: number | null; checkinTime: string | null; checkoutTime: string | null;
}) {
  return {
    foodPrefs: JSON.parse(row.foodPrefs || "[]"),
    cuisines: JSON.parse(row.cuisines || "[]"),
    roomPrefs: JSON.parse(row.roomPrefs || "[]"),
    interests: JSON.parse(row.interests || "[]"),
    allergies: JSON.parse(row.allergies || "[]"),
    bedPreference: row.bedPreference,
    temperatureC: row.temperatureC,
    budgetPerNightInr: row.budgetPerNightInr,
    checkinTime: row.checkinTime,
    checkoutTime: row.checkoutTime,
  };
}

/** GET — the signed-in guest's preference profile (empty object if none). */
export async function GET(request: NextRequest) {
  const token = await getUserToken();
  const user = await findUserByToken(token);
  
  // Optionally support booking code lookup if guest has a specific booking
  const code = request.nextUrl.searchParams.get("code");
  let userId = user?.id;
  if (!userId && code) {
    const b = await db.booking.findUnique({ where: { code } });
    if (b?.userId) userId = b.userId;
  }

  if (!userId) return NextResponse.json({ preferences: {} });
  const row = await db.userPreference.findUnique({ where: { userId } });
  return NextResponse.json({ preferences: row ? parsePrefs(row) : {} });
}

/** PUT — upsert preferences with validation. */
export async function PUT(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, setCookie } = await ensureUser();

  const data: Record<string, unknown> = {};
  if ("foodPrefs" in body) {
    const list = strList(body.foodPrefs);
    const bad = list.find((p) => !FOOD_PREFS.includes(p));
    if (bad) return NextResponse.json({ error: `Unknown food preference "${bad}".` }, { status: 400 });
    data.foodPrefs = JSON.stringify(list);
  }
  for (const key of ["cuisines", "roomPrefs", "interests", "allergies"]) {
    if (key in body) data[key] = JSON.stringify(strList(body[key]));
  }
  if ("bedPreference" in body) {
    data.bedPreference = typeof body.bedPreference === "string" && body.bedPreference
      ? body.bedPreference.slice(0, 40) : null;
  }
  if ("temperatureC" in body) {
    const t = Number(body.temperatureC);
    data.temperatureC = Number.isFinite(t) ? Math.min(30, Math.max(16, Math.round(t))) : null;
  }
  if ("budgetPerNightInr" in body) {
    const b = Number(body.budgetPerNightInr);
    data.budgetPerNightInr = Number.isFinite(b) && b > 0 ? Math.round(b) : null;
  }
  if ("checkinTime" in body) {
    data.checkinTime = normalizeTime(body.checkinTime);
  }
  if ("checkoutTime" in body) {
    data.checkoutTime = normalizeTime(body.checkoutTime);
  }

  const saved = await db.userPreference.upsert({
    where: { userId },
    update: data as never,
    create: { userId, ...data } as never,
  });

  // bind cookie if a fresh guest was created by ensureUser()
  const res = NextResponse.json({ success: true, preferences: parsePrefs(saved) });
  if (setCookie) res.headers.append("Set-Cookie", setCookie);
  return res;
}

/** DELETE — full privacy control: wipe the preference profile. */
export async function DELETE() {
  const token = await getUserToken();
  const user = await findUserByToken(token);
  if (!user) return NextResponse.json({ success: true, deleted: false });
  await db.userPreference.deleteMany({ where: { userId: user.id } });
  return NextResponse.json({ success: true, deleted: true });
}
