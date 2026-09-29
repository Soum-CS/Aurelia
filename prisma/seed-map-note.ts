import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed the LocusMap note #5210539 exactly as imported — coordinates and
 * description are preserved verbatim. The description ("Sikkim") is NOT
 * treated as fact: the note lands in NEEDS_VERIFICATION until the
 * reverse-geocoding verification service has run (see src/lib/map-notes.ts).
 */
async function main() {
  await prisma.mapNote.upsert({
    where: { noteId: "5210539" },
    update: {},
    create: {
      noteId: "5210539",
      source: "LocusMap",
      authorName: "anonymous",
      description: "sikkim",
      // Imported verbatim from the LocusMap export — not validated yet.
      latitude: 22.4211,
      longitude: 87.3226,
      verificationStatus: "NEEDS_VERIFICATION",
    },
  });
  console.log("Seeded LocusMap note #5210539 (needs verification).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
