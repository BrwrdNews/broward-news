import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateHeadlines } from "../src/lib/headline-generator";
import { runSourceFetch } from "../src/lib/ingestion/runSourceFetch";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database…");

  // ── Admin user ──────────────────────────────────────────────────────────
  const hash = await bcrypt.hash("admin123!", 10);
  await prisma.adminUser.upsert({
    where: { email: "admin@browardnews.local" },
    update: {},
    create: { email: "admin@browardnews.local", password: hash, name: "Site Admin" },
  });
  console.log("  ✓ Admin user");

  // ── Default Sources ─────────────────────────────────────────────────────
  const sourceDefs = [
    {
      name:                 "BSO Jail Booking Register",
      source_type:          "BSO_BOOKING_REGISTER",
      base_url:             "https://apps2.browardsheriff.org/JailSearch/",
      description:          "Broward County Sheriff's Office daily booking register. Requires manual input (CAPTCHA-protected search).",
      is_enabled:           true,
      fetch_interval_hours: 0, // manual only
      requires_manual:      true,
    },
    {
      name:                 "BSO Daily Booking Blotter",
      source_type:          "BSO_BOOKING_BLOTTER",
      base_url:             "https://www.sheriff.org/Divisions/Pages/Corrections.aspx",
      description:          "BSO daily booking blotter (PDF). Copy-paste text from PDF into Manual Import.",
      is_enabled:           true,
      fetch_interval_hours: 0,
      requires_manual:      true,
    },
    {
      name:                 "Fort Lauderdale PD News Releases",
      source_type:          "FLPD_NEWS_RELEASES",
      base_url:             "https://www.fortlauderdale.gov/departments/police/news-media",
      description:          "FLPD arrest-related news releases. Live fetch attempted; falls back to manual.",
      is_enabled:           true,
      fetch_interval_hours: 12,
      requires_manual:      false,
    },
    {
      name:                 "Broward Clerk of Courts (Manual)",
      source_type:          "BROWARD_CLERK_MANUAL",
      base_url:             "https://www.browardclerk.org/Web2/CaseSearchExt/",
      description:          "Manual court case lookups. Admin verifies case at browardclerk.org and pastes data here.",
      is_enabled:           true,
      fetch_interval_hours: 0,
      requires_manual:      true,
    },
    {
      name:                 "Manual Admin Submission",
      source_type:          "MANUAL_ADMIN_SUBMISSION",
      base_url:             "https://browardnews.local/admin/manual-source",
      description:          "Admin-pasted content from any official public record source.",
      is_enabled:           true,
      fetch_interval_hours: 0,
      requires_manual:      true,
    },
  ] as const;

  for (const s of sourceDefs) {
    await prisma.source.upsert({
      where: { id: (await prisma.source.findFirst({ where: { source_type: s.source_type } }))?.id ?? "new" },
      update: {},
      create: s,
    });
  }
  console.log("  ✓ Default sources");

  // ── Run mock fetch for BSO Booking Register to populate sample records ──
  const bsoSource = await prisma.source.findFirst({
    where: { source_type: "BSO_BOOKING_REGISTER" },
  });
  if (bsoSource) {
    const existingFetch = await prisma.sourceFetch.count({ where: { source_id: bsoSource.id } });
    if (existingFetch === 0) {
      try {
        const result = await runSourceFetch(bsoSource.id, { useMock: true });
        console.log(`  ✓ BSO mock fetch: ${result.recordsImported} records imported`);
      } catch (e) {
        console.warn("  ⚠ BSO mock fetch skipped:", e instanceof Error ? e.message : String(e));
      }
    }
  }

  // ── Run mock fetch for FLPD News Releases ──────────────────────────────
  const flpdSource = await prisma.source.findFirst({
    where: { source_type: "FLPD_NEWS_RELEASES" },
  });
  if (flpdSource) {
    const existingFetch = await prisma.sourceFetch.count({ where: { source_id: flpdSource.id } });
    if (existingFetch === 0) {
      try {
        const result = await runSourceFetch(flpdSource.id, { useMock: true });
        console.log(`  ✓ FLPD mock fetch: ${result.recordsImported} records imported`);
      } catch (e) {
        console.warn("  ⚠ FLPD mock fetch skipped:", e instanceof Error ? e.message : String(e));
      }
    }
  }

  // ── Sample story with headline options (for UI testing) ─────────────────
  const story1 = await prisma.story.upsert({
    where: { slug: "sample-broward-drug-arrest-2024" },
    update: {},
    create: {
      slug:                     "sample-broward-drug-arrest-2024",
      headline_standard:        "Fort Lauderdale Resident Booked in Broward County on Drug Charge, Records Show",
      headline_catchy:          "New in the Broward Booking Log: Fort Lauderdale Resident Listed on Drug Possession Charge",
      editorial_tone:           "Catchy tabloid-style, fact-bound, legally cautious.",
      geography_focus:          "Fort Lauderdale / Broward County, Florida",
      source_confidence_score:  0.95,
      subject_descriptor:       "man",
      body:                     `A Fort Lauderdale man was booked into the Broward County Main Jail following a traffic stop in which deputies say they discovered cocaine, according to Broward County Sheriff's Office arrest records.\n\nAccording to booking documents, the arrest occurred on January 15, 2024. The subject was listed as facing one count of possession of cocaine and one count of possession with intent to sell or deliver a controlled substance.\n\nAn arrest or criminal charge is not a conviction. The individual is presumed innocent unless proven guilty in court.\n\n*To request a correction or removal, contact us.*`,
      status:                   "DRAFT",
      source_name:              "Broward County Sheriff's Office",
      source_url:               "https://www.sheriff.org/",
      subject_name:             "John Q. Sample",
      charges:                  ["Possession of cocaine", "Possession with intent to sell or deliver a controlled substance"],
      booking_number:           "2024-00001",
      municipality:             "Fort Lauderdale",
      incident_date:            new Date("2024-01-15"),
      arrest_date:              new Date("2024-01-15"),
    },
  });

  // Headline batches for story 1
  for (const batchNumber of [1, 2]) {
    const existing = await prisma.storyHeadline.count({ where: { story_id: story1.id, generation_batch: batchNumber } });
    if (existing > 0) continue;
    const generated = generateHeadlines(
      { municipality: story1.municipality, charges: story1.charges, subject_name: story1.subject_name, subject_descriptor: story1.subject_descriptor, source_name: story1.source_name, arrest_date: story1.arrest_date, booking_number: story1.booking_number, geography_focus: story1.geography_focus },
      batchNumber
    );
    await prisma.storyHeadline.createMany({
      data: generated.map((h) => ({ story_id: story1.id, ...h, generation_batch: batchNumber })),
    });
  }
  const stdH = await prisma.storyHeadline.findFirst({ where: { story_id: story1.id, headline_type: "STANDARD", generation_batch: 1 } });
  if (stdH && !stdH.is_selected) {
    await prisma.storyHeadline.update({ where: { id: stdH.id }, data: { is_selected: true } });
    await prisma.story.update({ where: { id: story1.id }, data: { headline_chosen: stdH.headline_text } });
  }
  console.log("  ✓ Sample story with headline batches");

  console.log("\n✅ Seed complete.");
  console.log("   Admin: admin@browardnews.local / admin123!");
  console.log("   Visit /admin to get started.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
