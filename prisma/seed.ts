import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateHeadlines } from "../src/lib/headline-generator";

const prisma = new PrismaClient();

async function main() {
  // ── Admin user ──────────────────────────────────────────────────────────
  const hash = await bcrypt.hash("admin123!", 10);
  await prisma.adminUser.upsert({
    where: { email: "admin@browardnews.local" },
    update: {},
    create: {
      email: "admin@browardnews.local",
      password: hash,
      name: "Site Admin",
    },
  });

  // ── Sample story 1: drug charge (non-sensitive) ─────────────────────────
  const story1 = await prisma.story.upsert({
    where: { slug: "sample-broward-drug-arrest-2024" },
    update: {},
    create: {
      slug: "sample-broward-drug-arrest-2024",
      headline_standard:
        "Fort Lauderdale Resident Booked in Broward County on Drug Charge, Records Show",
      headline_catchy:
        "New in the Broward Booking Log: Fort Lauderdale Resident Listed on Drug Possession Charge",
      editorial_tone: "Catchy tabloid-style, fact-bound, legally cautious.",
      geography_focus: "Fort Lauderdale / Broward County, Florida",
      source_confidence_score: 0.95,
      subject_descriptor: "man",
      body: `A Fort Lauderdale man was booked into the Broward County Main Jail following a traffic stop in which deputies say they discovered cocaine, according to Broward County Sheriff's Office arrest records.\n\nAccording to booking documents, the arrest occurred on January 15, 2024. The subject was listed as facing one count of possession of cocaine and one count of possession with intent to sell or deliver a controlled substance.\n\nThe Broward County Sheriff's Office made the arrest. No further details were available in the publicly available booking record at time of publication.\n\nAn arrest or criminal charge is not a conviction. The individual is presumed innocent unless proven guilty in court.\n\n*To request a correction or removal of this story, please contact us.*`,
      status: "DRAFT",
      source_name: "Broward County Sheriff's Office",
      source_url: "https://www.sheriff.org/",
      subject_name: "John Q. Sample",
      charges: [
        "Possession of cocaine",
        "Possession with intent to sell or deliver a controlled substance",
      ],
      booking_number: "2024-00001",
      municipality: "Fort Lauderdale",
      incident_date: new Date("2024-01-15"),
      arrest_date: new Date("2024-01-15"),
    },
  });

  // Generate and insert headline options for story 1 (2 batches = 12 options)
  for (const batchNumber of [1, 2]) {
    const existingBatch = await prisma.storyHeadline.count({
      where: { story_id: story1.id, generation_batch: batchNumber },
    });
    if (existingBatch > 0) continue;

    const generated = generateHeadlines(
      {
        municipality: story1.municipality,
        charges: story1.charges,
        subject_name: story1.subject_name,
        subject_descriptor: story1.subject_descriptor,
        source_name: story1.source_name,
        arrest_date: story1.arrest_date,
        booking_number: story1.booking_number,
        geography_focus: story1.geography_focus,
      },
      batchNumber
    );

    await prisma.storyHeadline.createMany({
      data: generated.map((h) => ({
        story_id: story1.id,
        headline_text: h.headline_text,
        headline_type: h.headline_type,
        factual_safety_score: h.factual_safety_score,
        catchiness_score: h.catchiness_score,
        risk_level: h.risk_level,
        reason_for_score: h.reason_for_score,
        source_fields_used: h.source_fields_used,
        generation_batch: batchNumber,
      })),
    });
  }

  // Mark the STANDARD headline from batch 1 as selected (demo default)
  const standardHeadline = await prisma.storyHeadline.findFirst({
    where: { story_id: story1.id, headline_type: "STANDARD", generation_batch: 1 },
  });
  if (standardHeadline && !standardHeadline.is_selected) {
    await prisma.storyHeadline.update({
      where: { id: standardHeadline.id },
      data: { is_selected: true },
    });
    await prisma.story.update({
      where: { id: story1.id },
      data: { headline_chosen: standardHeadline.headline_text },
    });
  }

  // ── Sample story 2: DUI (non-sensitive, different municipality) ──────────
  const story2 = await prisma.story.upsert({
    where: { slug: "sample-pompano-dui-2024" },
    update: {},
    create: {
      slug: "sample-pompano-dui-2024",
      headline_standard:
        "Pompano Beach Resident Booked in Broward County on DUI Charge, Records Show",
      headline_catchy:
        "Behind the Booking: Pompano Beach Resident Faces DUI Charge Per Records",
      editorial_tone: "Catchy tabloid-style, fact-bound, legally cautious.",
      geography_focus: "Fort Lauderdale / Broward County, Florida",
      source_confidence_score: 0.9,
      subject_descriptor: "woman",
      body: `A Pompano Beach woman was booked into the Broward County Main Jail on a DUI charge, according to Broward County Sheriff's Office arrest records.\n\nAn arrest or criminal charge is not a conviction. The individual is presumed innocent unless proven guilty in court.\n\n*To request a correction or removal, please contact us.*`,
      status: "DRAFT",
      source_name: "Broward County Sheriff's Office",
      subject_name: "Jane R. Sample",
      charges: ["Driving under the influence (DUI)"],
      booking_number: "2024-00002",
      municipality: "Pompano Beach",
      arrest_date: new Date("2024-02-10"),
    },
  });

  // Generate headlines for story 2
  const existingStory2 = await prisma.storyHeadline.count({
    where: { story_id: story2.id },
  });
  if (existingStory2 === 0) {
    const generated2 = generateHeadlines(
      {
        municipality: story2.municipality,
        charges: story2.charges,
        subject_name: story2.subject_name,
        subject_descriptor: story2.subject_descriptor,
        source_name: story2.source_name,
        arrest_date: story2.arrest_date,
        booking_number: story2.booking_number,
        geography_focus: story2.geography_focus,
      },
      1
    );
    await prisma.storyHeadline.createMany({
      data: generated2.map((h) => ({
        story_id: story2.id,
        ...h,
        generation_batch: 1,
      })),
    });
  }

  console.log("✅ Seed complete.");
  console.log("   Admin login: admin@browardnews.local / admin123!");
  console.log("   Sample stories seeded with headline options.");
  console.log("   Visit /admin/stories to review.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
