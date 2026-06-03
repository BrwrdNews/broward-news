import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateHeadlines } from "../src/lib/headline-generator";
import { runSourceFetch } from "../src/lib/ingestion/runSourceFetch";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helper — upsert a story + seed all 7 headline types across 2 batches
// ---------------------------------------------------------------------------

async function seedStoryWithHeadlines(data: {
  slug: string;
  headline_standard: string;
  headline_catchy: string;
  body: string;
  source_name: string;
  source_url?: string;
  subject_name?: string;
  subject_descriptor: string;
  charges: string[];
  booking_number?: string;
  municipality: string;
  arrest_date: Date;
  bond?: string;
  release_status?: string;
  arresting_agency?: string;
}) {
  const story = await prisma.story.upsert({
    where: { slug: data.slug },
    update: {},
    create: {
      slug:                     data.slug,
      headline_standard:        data.headline_standard,
      headline_catchy:          data.headline_catchy,
      editorial_tone:           "Catchy tabloid-style, fact-bound, legally cautious.",
      editorial_tone_setting:   "SENSATIONAL_CAUTIOUS",
      geography_focus:          "Fort Lauderdale / Broward County, Florida",
      source_confidence_score:  0.9,
      subject_descriptor:       data.subject_descriptor,
      body:                     data.body,
      status:                   "DRAFT",
      source_name:              data.source_name,
      source_url:               data.source_url ?? null,
      subject_name:             data.subject_name ?? null,
      charges:                  data.charges,
      booking_number:           data.booking_number ?? null,
      municipality:             data.municipality,
      arrest_date:              data.arrest_date,
    },
  });

  for (const batchNumber of [1, 2]) {
    const existing = await prisma.storyHeadline.count({
      where: { story_id: story.id, generation_batch: batchNumber },
    });
    if (existing > 0) continue;

    const generated = generateHeadlines(
      {
        municipality:      data.municipality,
        charges:           data.charges,
        subject_name:      data.subject_name,
        subject_descriptor: data.subject_descriptor,
        source_name:       data.source_name,
        arrest_date:       data.arrest_date,
        booking_number:    data.booking_number,
        geography_focus:   "Fort Lauderdale / Broward County, Florida",
        bond:              data.bond,
        release_status:    data.release_status,
        arresting_agency:  data.arresting_agency,
      },
      batchNumber,
      false,
      "SENSATIONAL_CAUTIOUS"
    );

    await prisma.storyHeadline.createMany({
      data: generated.map((h) => ({
        story_id:             story.id,
        headline_text:        h.headline_text,
        deck:                 h.deck,
        headline_type:        h.headline_type,
        factual_safety_score: h.factual_safety_score,
        catchiness_score:     h.catchiness_score,
        uniqueness_score:     h.uniqueness_score,
        sensationalism_score: h.sensationalism_score,
        risk_level:           h.risk_level,
        reason_for_score:     h.reason_for_score,
        source_fields_used:   h.source_fields_used,
        generation_batch:     batchNumber,
      })),
    });
  }

  // Pre-select the DAILY_MAIL_HOOK from batch 1 as the default
  const hook = await prisma.storyHeadline.findFirst({
    where: { story_id: story.id, headline_type: "DAILY_MAIL_HOOK", generation_batch: 1 },
  });
  if (hook && !hook.is_selected) {
    await prisma.storyHeadline.update({
      where: { id: hook.id },
      data: { is_selected: true, approval_status: "APPROVED", approved_at: new Date() },
    });
    await prisma.story.update({
      where: { id: story.id },
      data: { headline_chosen: hook.headline_text },
    });
  }

  return story;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

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
      fetch_interval_hours: 0,
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
    const existing = await prisma.source.findFirst({ where: { source_type: s.source_type } });
    if (!existing) await prisma.source.create({ data: s });
  }
  console.log("  ✓ Default sources");

  // ── Mock fetches ───────────────────────────────────────────────────────
  for (const sourceType of ["BSO_BOOKING_REGISTER", "FLPD_NEWS_RELEASES"] as const) {
    const src = await prisma.source.findFirst({ where: { source_type: sourceType } });
    if (!src) continue;
    const existing = await prisma.sourceFetch.count({ where: { source_id: src.id } });
    if (existing > 0) continue;
    try {
      const r = await runSourceFetch(src.id, { useMock: true });
      console.log(`  ✓ ${sourceType} mock fetch: ${r.recordsImported} records imported`);
    } catch (e) {
      console.warn(`  ⚠ ${sourceType} mock fetch skipped:`, e instanceof Error ? e.message : e);
    }
  }

  // ── 4 Sample stories — each demonstrates different charge categories ─────
  // These produce 7 × 2 batches = 14 headlines per story (56 total examples)

  // Story 1 — Drug possession (multi-charge, bond set)
  await seedStoryWithHeadlines({
    slug:               "sample-fl-drug-possession-2024",
    headline_standard:  "Fort Lauderdale Man Booked in Broward County on Drug Possession Charge, Records Show",
    headline_catchy:    "Fort Lauderdale man is booked on drug possession charge after Broward records list additional listed count",
    body:               `A Fort Lauderdale man was booked into the Broward County Main Jail on drug-related charges, according to Broward County Sheriff's Office arrest records.\n\nBooking records list a drug possession charge and an additional listed count.\n\nAn arrest or criminal charge is not a conviction. The individual is presumed innocent unless proven guilty in court.\n\n*To request a correction or removal, contact us.*`,
    source_name:        "Broward County Sheriff's Office",
    source_url:         "https://www.sheriff.org/",
    subject_name:       "John Q. Sample",
    subject_descriptor: "man",
    charges:            ["Possession of cocaine", "Possession with intent to sell or deliver a controlled substance"],
    booking_number:     "2024-00001",
    municipality:       "Fort Lauderdale",
    arrest_date:        new Date("2024-01-15"),
    bond:               "$5,000",
    release_status:     "Held",
    arresting_agency:   "Broward County Sheriff's Office",
  });

  // Story 2 — DUI, single charge, released on bond
  await seedStoryWithHeadlines({
    slug:               "sample-pompano-dui-2024",
    headline_standard:  "Pompano Beach Woman Booked in Broward County on DUI Charge, Records Show",
    headline_catchy:    "Pompano Beach woman lands in Broward booking log on DUI charge as records reveal release on bond listed",
    body:               `A Pompano Beach woman was booked into the Broward County Main Jail on a DUI charge, according to Broward County Sheriff's Office arrest records.\n\nRecords show the subject was released on bond following processing.\n\nAn arrest or criminal charge is not a conviction. The individual is presumed innocent unless proven guilty in court.\n\n*To request a correction or removal, contact us.*`,
    source_name:        "Broward County Sheriff's Office",
    subject_name:       "Jane R. Sample",
    subject_descriptor: "woman",
    charges:            ["Driving under the influence (DUI)"],
    booking_number:     "2024-00002",
    municipality:       "Pompano Beach",
    arrest_date:        new Date("2024-02-10"),
    bond:               "$500",
    release_status:     "Released on bond",
    arresting_agency:   "Broward County Sheriff's Office",
  });

  // Story 3 — Weapons charge (FLPD), two counts
  await seedStoryWithHeadlines({
    slug:               "sample-fl-weapons-2024",
    headline_standard:  "Fort Lauderdale Man Booked in Broward County on Weapons Charge, Records Show",
    headline_catchy:    "Fort Lauderdale man appears in Broward jail records on felon in possession of a firearm charge — additional listed count confirmed",
    body:               `A Fort Lauderdale man was booked into the Broward County Main Jail on weapons-related charges following a traffic stop, according to Fort Lauderdale Police Department records.\n\nBooking records list a felon in possession of a firearm charge and a concealed weapon charge.\n\nAn arrest or criminal charge is not a conviction. The individual is presumed innocent unless proven guilty in court.\n\n*To request a correction or removal, contact us.*`,
    source_name:        "Fort Lauderdale Police Department",
    source_url:         "https://www.fortlauderdale.gov/departments/police",
    subject_name:       "Jerome W. Sample",
    subject_descriptor: "man",
    charges:            ["Felon in possession of a firearm (F2)", "Carrying a concealed firearm without a license (F3)"],
    booking_number:     "2024-00003",
    municipality:       "Fort Lauderdale",
    arrest_date:        new Date("2024-03-05"),
    bond:               "$50,000",
    release_status:     "Held",
    arresting_agency:   "Fort Lauderdale Police Department",
  });

  // Story 4 — Theft/burglary (Pompano Beach), single count, different agency
  await seedStoryWithHeadlines({
    slug:               "sample-pompano-burglary-2024",
    headline_standard:  "Pompano Beach Resident Booked in Broward County on Burglary Charge, Records Show",
    headline_catchy:    "Broward records reveal Pompano Beach resident was booked on burglary charge and theft charge",
    body:               `A Pompano Beach resident was booked into the Broward County Main Jail on burglary and theft charges, according to Broward County Sheriff's Office arrest records.\n\nBooking records list a burglary of a dwelling charge and a grand theft charge.\n\nAn arrest or criminal charge is not a conviction. The individual is presumed innocent unless proven guilty in court.\n\n*To request a correction or removal, contact us.*`,
    source_name:        "Broward County Sheriff's Office",
    subject_name:       "Terrell J. Sample",
    subject_descriptor: "resident",
    charges:            ["Burglary of a dwelling — unoccupied (F2)", "Grand theft — $10,000 to under $100,000 (F2)"],
    booking_number:     "2024-00004",
    municipality:       "Pompano Beach",
    arrest_date:        new Date("2024-04-20"),
    bond:               "$25,000",
    release_status:     "Held",
    arresting_agency:   "Broward County Sheriff's Office",
  });

  console.log("  ✓ 4 sample stories — 7 headline types × 2 batches each");

  // ── Print sample headlines for visual inspection ─────────────────────────
  const sampleHeadlines = await prisma.storyHeadline.findMany({
    where: { generation_batch: 1 },
    orderBy: [{ story_id: "asc" }, { headline_type: "asc" }],
    select: { headline_type: true, headline_text: true, deck: true },
    take: 28,
  });

  console.log("\n  Sample generated headlines (batch 1):");
  for (const h of sampleHeadlines) {
    console.log(`  [${h.headline_type.padEnd(16)}] ${h.headline_text}`);
    if (h.deck) console.log(`  ${"".padEnd(18)} → ${h.deck}`);
  }

  console.log("\n✅ Seed complete.");
  console.log("   Admin: admin@browardnews.local / admin123!");
  console.log("   Visit /admin to get started.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
