# Aurelia — AI-Powered Immersive Hotel Experience & Smart Stay Platform

Explore hotel rooms as interactive, physically-lit 3D digital twins before
booking, then travel the full guest journey: Discover → Compare → Experience
in 3D → Book → Pay → Personalize → Stay → Order Food → Request Services →
Explore → Unified Checkout → Feedback — with an AI concierge, a smart stay
wallet, proactive notifications and a QR e-voucher along the way.

**Tagline:** *See your stay. Shape your stay. Live your stay.*

**Stack:** Next.js (App Router) · React Three Fiber + drei +
postprocessing · Tailwind CSS v4 design tokens · Prisma + SQLite · qrcode

## Quick start

```bash
npm install
npm run db:push     # create prisma/dev.db from the schema
npm run db:seed     # 5 hotels / 10 room types with distinct 3D scenes
npm run dev         # http://localhost:3000
```

Other scripts: `npm run build`, `npm start`, `npm run lint`, `npm run typecheck`,
`npm run test:stay` (My-Stay contract suite — run against `npm start`).

Mock payment: any well-formed card works at checkout (e.g. `4242 4242 4242 4242`,
any future expiry). Nothing is stored or charged.

## My Aurelia Stay — the digital twin of your stay

After booking, `/trips/[code]` becomes **MY AURELIA STAY**: a control center
showing hotel, room, dates, guests, booking ID, payment status, stay duration,
countdowns to check-in/checkout and the live stage of the visit —

```
BOOKED → PRE-ARRIVAL → CHECKED-IN → IN-STAY → CHECKOUT → COMPLETED
```

A "digital stay" map links the connected environment: **ROOM · FOOD · SERVICES
→ EXPERIENCES → AI CONCIERGE → WALLET & BILL** — every tile backed by real
booking data.

### Hotel dining & food ordering (`/trips/[code]/stay/food`)

- The booked hotel's **own** kitchen: menu categories (Breakfast, Starters,
  Main Course, Desserts, Beverages, Kids, Healthy…), per-item diet indicator,
  calories, allergens, prep time, availability, add-ons and quantity.
- **AI food recommendations** from natural language ("healthy vegetarian
  dinner under ₹500", "something spicy") — matched only against items that
  actually exist and are available at that hotel.
- Cart with server-side pricing (the browser never dictates an amount), 5%
  food tax, optional **scheduled delivery** (breakfast tomorrow 8 AM), and
  order tracking `Confirmed → Preparing → Ready → On the way → Delivered`.
- Statuses only advance through staff actions (`PATCH /api/admin/orders/[id]`,
  ADMIN_TOKEN-gated); a guest tracker can never show "Delivered" early.

### Smart services (`/trips/[code]/stay/services`)

Towels, pillows, toiletries, water, housekeeping, laundry pickup,
maintenance, wake-up calls, luggage help — each request gets the pipeline
`Requested → Accepted → In progress → Completed`, advanced by staff via
`/admin`.

### Explore nearby & AI itinerary (`/trips/[code]/stay/experiences`)

A curated local marketplace around the booked hotel (attractions, museums,
tours, events…) with distance, duration, price and rating; **ADD TO MY STAY**
books it into the wallet. **GENERATE MY ITINERARY / REGENERATE** builds a
day-by-day plan from the real stay dates, hotel tips and experience catalog.

### Aurelia Wallet & unified bill (`/trips/[code]/stay/wallet`)

Every rupee on the stay as one referenced transaction stream
(`ROOM · FOOD · SERVICES · SPA · LAUNDRY · ACTIVITIES …`). Unified checkout
settles all pending charges in a single Razorpay payment
(server-created order + HMAC signature verification) and issues a numbered
invoice. Without Razorpay keys the UI shows an explicit configuration state —
never simulated success.

### Aurelia Concierge

`POST /api/concierge/stay` answers in natural language over the live stay:
food finds (with ORDER buttons), service offers (with REQUEST buttons),
spend questions, nearby ideas, checkout info. It never claims an order was
placed unless the backend confirmed one — buttons post to real endpoints and
surface backend confirmations.

### Notifications & personalization

`GET /api/notifications` derives reminders from real data only (check-in
tomorrow, scheduled orders due, experiences starting soon, bill settled) and
upserts them by stable dedupe key so read-state persists. `/profile` stores a
guest preference profile (diet, allergies, cuisines, room/budget/time
preferences) that feeds recommendations — deletable at any time.

### Hotel operations (`/admin`)

Staff dashboard behind `ADMIN_TOKEN`: bookings, occupancy, revenue, kitchen
board (advance order statuses), service queue, room availability. Locked
with an explicit not-configured state when no token is set.

## The guest journey

| Stage | Where | What's implemented |
| --- | --- | --- |
| Discover | `/` | Search (destination, dates, guests), "near me" geolocation + radius, heuristic AI recommendations, wishlist hearts, results grid with generative SVG art |
| 3D index + compare | `/rooms` | All 3D-enabled twins, **COMPARE ROOMS** table and the **AI room recommendation** (budget / guests / bed / view / balcony → explained pick) |
| Hotel detail | `/hotels/[slug]` | Dataset/live hotel view with 3D concept twin and secure checkout entry |
| Book | `/book/[hotelId]` · `/book/[roomTypeId]` | Razorpay dataset checkout; seeded-room flow: 3 steps Stay → Extras → Payment |
| Confirmation | `/confirmation/[code]` | E-voucher with QR code, folio summary, add-to-calendar, print |
| **My Aurelia Stay** | `/trips/[code]` | Digital-twin hub: stay facts, lifecycle timeline, countdowns, live orders/requests, folio, concierge, journey shortcuts |
| Dining & orders | `/trips/[code]/stay/food` | Hotel menu browser, AI recommendations, cart + scheduling, order tracking |
| Services | `/trips/[code]/stay/services` | One-tap requests + status pipeline |
| Experiences & itinerary | `/trips/[code]/stay/experiences` | Nearby marketplace, add-to-stay, AI itinerary generate/regenerate |
| Wallet & bill | `/trips/[code]/stay/wallet` | Category wallet, unified bill, single Razorpay settlement, invoice |
| Pre-arrival | `/trips/[code]/check-in` | Trip dashboard, countdown, digital check-in form, room-feature pre-selection, weather tips |
| In-stay | `/trips/[code]/in-stay` | Room service ordering, issue reporting with photo attachment, smart-room controls (labeled demo), AI concierge chat |
| Checkout | `/trips/[code]/checkout` | One-tap checkout, itemized folio |
| Feedback | `/trips/[code]/feedback` | Five-category ratings, free-text review with sentiment flagging, loyalty summary |
| Profile | `/profile` | Preference profile with full privacy wipe |
| Staff | `/admin` | Operations dashboard (ADMIN_TOKEN-gated): kitchen board, service queue, rooms, bookings |

## Architecture

```
src/
├── app/
│   ├── page.tsx                      # Discover (server component)
│   ├── hotels/[slug]/page.tsx        # Hotel detail
│   ├── rooms/page.tsx                # 3D index · room compare · AI room recommendation
│   ├── rooms/[id]/page.tsx           # 3D explorer page (lazy-loads client canvas)
│   ├── book/[roomTypeId]/page.tsx    # Booking shell → <BookingFlow> (client)
│   ├── confirmation/[code]/page.tsx  # Voucher + server-rendered QR
│   ├── trips/…                       # MY AURELIA STAY hub, check-in, in-stay, checkout,
│   │                                 #   stay/{food,services,experiences,wallet}
│   ├── concierge/page.tsx            # Concierge explainer + stay switcher
│   ├── profile/page.tsx              # Preference profile (privacy wipe included)
│   ├── admin/page.tsx                # Staff operations dashboard (ADMIN_TOKEN)
│   └── api/
│       ├── hotels/route.ts           # GET list (?q=&guests=&lat=&lng=, origin echo)
│       ├── hotels/[slug]/route.ts    # GET one with rooms
│       ├── room-types/[id]/route.ts
│       ├── availability/route.ts     # GET ?roomTypeId&checkIn&checkOut
│       ├── bookings/route.ts         # POST create · GET ?code=
│       ├── bookings/[code]/…         # pre-arrival · check-in · services · checkout
│       │                             #   food/menu · food/orders · experiences
│       │                             #   wallet · bill(+verify) · itinerary
│       ├── notifications/route.ts    # GET derived reminders · PATCH mark read
│       ├── preferences/route.ts      # GET/PUT/DELETE guest preference profile
│       ├── concierge/stay/route.ts   # POST stay-aware concierge with action cards
│       ├── admin/overview/route.ts   # GET operations snapshot (token-gated)
│       ├── admin/orders/[id]/…       # PATCH food-order status transitions
│       ├── admin/services/[id]/…     # PATCH service-request transitions
│       ├── reviews/route.ts          # POST review w/ sentiment analysis
│       ├── concierge/route.ts        # POST chat (heuristic intents + RAG-ready)
│       └── wishlist/route.ts         # GET/POST/DELETE
├── components/
│   ├── room3d/
│   │   ├── scene.tsx                 # lighting rig, environment, layout, hotspots
│   │   ├── camera-rig.tsx            # eased orbit glides + first-person walkthrough
│   │   ├── textures.ts               # canvas-generated plank/weave/plaster PBR maps
│   │   ├── furniture.tsx             # bed, sofa, desk, tub, fireplace… (+ flicker/sway)
│   │   ├── window-view.tsx           # city / ocean / garden / alps backdrops
│   │   ├── hotspot.tsx               # in-scene Html markers
│   │   └── palettes.ts               # per-palette materials + sky colors
│   ├── booking-flow.tsx              # steps, availability, price quote
│   ├── concierge-chat.tsx            # in-stay AI concierge UI
│   └── …                             # header/footer/theme/search/cards/reveal
└── lib/
    ├── db.ts                          # Prisma singleton
    ├── data.ts                        # query helpers + availability math
    ├── pricing.ts                     # addons catalog, tax/fee quoting
    ├── recommend.ts                   # heuristic recommender (stays history → reasons)
    ├── sentiment.ts                   # lightweight review sentiment classifier
    ├── geo.ts                         # haversine distance helpers
    └── types.ts                       # SceneConfig shared by seed & viewer
prisma/
├── schema.prisma                      # User · Hotel · RoomType · Booking · Review…
└── seed.ts                            # demo data (scene configs included)
```

### Double-booking prevention

`POST /api/bookings` re-checks overlapping `CONFIRMED` bookings inside a
Prisma transaction against the room type's `unitsAvailable`, so concurrent
submissions cannot oversell a date range. Availability is also exposed via
`GET /api/availability` for the booking UI.

### Worldwide location search & current-location detection

The destination field is a full autocomplete (`LocationAutocomplete`), not a
city list:

- **📍 Use my current location** — `navigator.geolocation.getCurrentPosition`
  (high accuracy) → reverse geocoded via `/api/geo/reverse` into a readable
  "City, Region, Country" label (e.g. *Bhubaneswar, Odisha, India*). Denied
  permission, unavailability and timeouts degrade to clear messages plus the
  manual search input; raw coordinates are still usable as a last resort.
- **Type anything** — debounced worldwide search via `/api/geo/search`
  (OpenStreetMap Nominatim; no API key): cities, states/regions, countries,
  landmarks and addresses. Keyboard navigation (↑ ↓ ⏎ esc), ARIA combobox
  semantics, skeleton rows while loading.
- **Selections drive the real search.** Picking a place submits its actual
  coordinates (`place` + `lat` + `lng` params), reusing the near-me pipeline:
  haversine distances, nearest-first ordering and map fit all follow. Free-
  typed text without a pick falls back to the name/city/country query.
- **Provider-agnostic core** — `src/lib/geocoding.ts` wraps the upstream
  service behind `searchPlaces` / `reverseGeocode` with TTL caching, fast
  timeouts and a proper User-Agent; swap in Google Places or Mapbox by
  editing that one file. If upstream is unreachable the API degrades to the
  seeded hotel cities (with their real coordinates) so the demo works offline.

Named acceptance tests: `npm run test:geo` (Bhubaneswar/Tokyo forward search,
Bengaluru reverse geocode, input validation) and `npm run test:near-me`.

### Connecting live hotel data (mandatory)

**Aurelia has no demo/sample hotel inventory.** Without a configured provider
the app shows **“Live hotel data connection required.”** everywhere hotels,
rooms or prices would appear — search, results, detail and booking APIs all
return `503 LIVE_CONNECTION_REQUIRED` instead of substituting anything.

To enable real inventory (Amadeus Self-Service — free test keys):

1. Create an account at <https://developers.amadeus.com> and generate an
   API key + secret.
2. Add to `.env.local` (never committed):

   ```
   HOTEL_PROVIDER=amadeus
   HOTEL_API_KEY=<your key>
   HOTEL_API_SECRET=<your secret>
   # optional: https://api.amadeus.com once Amadeus approves production access
   HOTEL_API_BASE_URL=https://test.amadeus.com
   ```

3. Restart. Search → availability → rooms → ₹ pricing flow through the live
   adapter; booking requires the provider's booking permission (self-service
   accounts see an explicit "partner booking flow required" notice — Aurelia
   never fabricates confirmations).

Other authorized providers (Expedia Rapid, Booking.com Demand API) require a
signed partner agreement; implement another adapter in
`src/lib/hotel-provider/`. Scraping is not supported by design.

Currency: all prices are ₹ INR (en-IN grouping). Non-INR provider amounts are
converted at the live mid-market USD→INR rate (`src/lib/currency.ts`) with the
rate snapshotted onto each booking.

### Worldwide location search & current-location detection

The destination field is a full autocomplete (`LocationAutocomplete`), not a
city list:

- **📍 Use my current location** — `navigator.geolocation.getCurrentPosition`
  (high accuracy) → reverse geocoded via `/api/geo/reverse` into a readable
  "City, Region, Country" label (e.g. *Bhubaneswar, Odisha, India*). Denied
  permission, unavailability and timeouts degrade to clear messages plus the
  manual search input; raw coordinates are still usable as a last resort.
- **Type anything** — debounced worldwide search via `/api/geo/search`
  (OpenStreetMap Nominatim; no API key): cities, states/regions, countries,
  landmarks and addresses. Keyboard navigation (↑ ↓ ⏎ esc), ARIA combobox
  semantics, skeleton rows while loading.
- **Selections drive the real search.** Picking a place submits its actual
  coordinates (`place` + `lat` + `lng` params), reusing the near-me pipeline:
  haversine distances, nearest-first ordering and map fit all follow. Free-
  typed text without a pick falls back to the name/city/country query.
- **Provider-agnostic core** — `src/lib/geocoding.ts` wraps the upstream
  service behind `searchPlaces` / `reverseGeocode` with TTL caching, fast
  timeouts and a proper User-Agent; swap in Google Places or Mapbox by
  editing that one file. If upstream is unreachable the API degrades to the
  seeded hotel cities (with their real coordinates) so the demo works offline.

Named acceptance tests: `npm run test:geo` (Bhubaneswar/Tokyo forward search,
Bengaluru reverse geocode, input validation) and `npm run test:near-me`.

### Real hotel inventory: provider layer & going live

Aurelia's Prisma DB stores **application data only** (users, bookings,
wishlists, search history, reviews). Live hotel inventory, availability and
rates come from a swappable provider (`src/lib/hotel-provider/`):

| Provider | Status | Requirements |
| --- | --- | --- |
| `aurelia-demo` | default | none — seeded collection, badged **DEMO DATA** |
| `amadeus` | ready — activates via env vars | free self-service key from developers.amadeus.com; set `HOTEL_PROVIDER=amadeus`, `HOTEL_API_KEY`, `HOTEL_API_SECRET` (see `.env.example`) |

When a live provider is configured, every surface switches its badge to
**Live availability** and the same code path serves real hotels, real room
offers (incl. cancellation policy, meal plan, taxes) and provider-authorized
imagery. Provider-supplied panoramas / 3D models render in the room
experience labeled *Official 360° view* / *Official virtual tour*; without
them the procedural twin is always labeled **Concept twin**, never passed
off as photography. Secrets live only in `.env.local` (git-ignored) and are
used exclusively inside Next.js server routes.

**Currency**: all user-facing prices are ₹ INR with en-IN grouping.
Internal amounts are USD; conversion uses the live USD→INR mid-market rate
(`src/lib/currency.ts`, cached 1 h), snapshots into each booking
(`totalInr`, `inrRateUsed`), and is re-verified server-side before payment.

**Price integrity**: the browser never dictates a price. `POST
/api/bookings/quote` re-derives the authoritative quote + availability; if
the total changed, the guest sees an explicit "Price updated" consent step;
`POST /api/bookings` re-validates inventory in a transaction and stores the
server-computed totals with full currency/provider provenance.

### "Near me" & map correctness contract

Treated as a hard requirement (spec §2.1):

- **Real device coordinates only.** `navigator.geolocation.getCurrentPosition`
  with high accuracy — no IP-guessing, no hardcoded default city. If
  permission is denied, unavailable, or it times out, an explicit
  "Enter your city" input appears (`NearMeControls`); nothing renders against
  a placeholder location.
- **One distance code path.** `GET /api/hotels?lat=&lng=` computes haversine
  distances from real coordinates in `listHotels`; the sorted list, the map
  pins and their distance labels all consume that single result.
- **The map re-fits every search.** `StayMap` projects its viewBox from the
  bounding box of the actual returned markers + user pin on each render —
  there is no stale default center to drift out of sync.
- **Radius only filters when chosen.** No implicit radius hides far results;
  picking "Within N km" is explicit, and an empty result offers "Show
  everything, nearest first".
- **Named acceptance test:** `npm run build && npm start && npm run
  test:near-me` — searches from Bengaluru, India (thousands of km from every
  seeded hotel), and asserts: origin echo, honest empty set for a small
  radius, coordinate-derived distances matching an independent haversine,
  nearest-first ordering, and a map SSR containing the user pin plus exactly
  the hotels the API sorted.

## The 3D approach — photoreal, not gamey

Rooms are built **procedurally** from primitives driven by a JSON `scene`
config stored per room type (`palette`, `windowView`, `bed`, `extras`) — zero
asset downloads, instant loads on mobile, new variants defined entirely by
seed data. The *realism* comes from how the scene is lit and moved:

**Lighting & materials**
- Image-based lighting via drei `<Environment>` rigs built from
  `<Lightformer>`s, swapped wholesale between a low sun + sky dome (day) and
  moonlight + warm practical pools (night) — baked once per toggle, no HDRI
  downloads.
- ACES-filmic tone mapping and sRGB output (React Three Fiber defaults).
- Keyed sunlight angled through the window opening so it lands on the bed,
  with soft PCF shadows tuned to the room bounds.
- `<ContactShadows>` grounding every furniture piece; wall/floor junctions
  pick up natural occlusion.
- Procedural canvas PBR maps (`textures.ts`): wood-plank color + roughness
  with grain streaks and board joints, fine weave bump on all textiles,
  plaster mottling on walls.
- Honest imperfection: offset throw pillow, asymmetric pillow tilt, flickering
  lamp/fire light at night, drifting dust motes in the sunbeam, curtains that
  sway almost imperceptibly.
- Fabric softness: sheen-based subsurface approximation on duvet and curtains,
  with daylight bleeding faintly through the curtain weave (fake backlight).
- **Auto-exposure**: the "lens" stops down as you face the bright window and
  opens up toward darker corners (`ExposureRig`), like a real eye adapting.
- Polished-floor env reflections (cubemap via IBL) plus reflective glass,
  chrome fixtures and tub — glossy surfaces read as one continuous space.
- Correct scale anchors: real 2.03 m door with brass lever, true-to-size
  furniture, consistent metre-based units.

**Camera & movement**
- Natural focal length: 55° FOV (human-eye-like), not a game-engine wide angle.
- Damped orbit controls plus **eased hotspot transitions** — clicking a marker
  or chip glides the camera to a considered framing over ~1.4 s (cubic
  ease-in-out), like a photographer repositioning, then hands control back.
- **Step-inside walkthrough mode**: fixed 1.55 m eye height, drag-to-look
  (grab-the-world, street-view style), WASD/arrow-key glide with exponential
  velocity damping so you settle instead of stopping dead, and soft collision
  bounds against walls and every furniture piece.
- Depth of field focused on the bed + gentle vignette via
  `@react-three/postprocessing`, enabled only on desktop pointers and skipped
  when `prefers-reduced-motion` is set.

To swap in real authored models later: export GLB (Draco-compressed) from
Blender/Spline, drop into `public/models/`, and replace the primitives inside
`<RoomScene>` with drei's `useGLTF` — the lighting rig, hotspots, camera glides
and walkthrough mode all work unchanged. For authored HDRIs, replace the
`<Lightformer>` children in `RoomEnvironment` with an `files={...}` preset.

## Data model notes

SQLite has no array columns, so `amenities`, `addons`, `scene` and similar are
stored as JSON strings and parsed in `src/lib/data.ts` / `src/lib/types.ts`.
Swapping to PostgreSQL only requires changing the `datasource` provider and
promoting those fields to real arrays/jsonb.

The stay domain adds: `Restaurant · MenuCategory · MenuItem` (dining, anchored
by a stable `hotelKey`: a property id or `csv:<dataset id>` for dataset
bookings), `FoodOrder · FoodOrderItem` (server-priced orders with status
timelines), `Experience · ExperienceBooking`, `WalletTransaction`
(unique-ref charges feeding the unified bill), `Invoice`,
`Notification` (dedupe-keyed reminders) and `UserPreference`.
Every food order, service request, experience booking, wallet transaction and
invoice carries the `bookingId` (and user where applicable) it belongs to —
guests can never attach stay services to a hotel they aren't staying at.

## Design system

Warm upscale hospitality palette (ivory / brass / pine) defined as CSS custom
properties in `globals.css` and exposed to Tailwind v4 via `@theme inline`.
Class-based dark mode with its own considered palette (not inverted grays);
Fraunces (display serif) + Inter (UI grotesque) via `next/font`. Motion is
part of the language: eased scroll reveals (`<Reveal>`, IntersectionObserver),
fade-ups, hover lifts — all respecting `prefers-reduced-motion`. Skeleton
loaders mirror real content shapes (hotel cards, the 3D canvas itself).
