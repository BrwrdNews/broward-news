import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
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

  // Sample draft story
  await prisma.story.upsert({
    where: { slug: "sample-broward-arrest-2024" },
    update: {},
    create: {
      slug: "sample-broward-arrest-2024",
      headline_standard:
        "Broward County booking records show Fort Lauderdale man arrested on felony drug charges",
      headline_catchy:
        "Fort Lauderdale man booked after Broward deputies say they found cocaine during traffic stop",
      editorial_tone: "Catchy tabloid-style, fact-bound, legally cautious.",
      geography_focus: "Fort Lauderdale / Broward County, Florida",
      source_confidence_score: 0.95,
      body: `A Fort Lauderdale man was booked into the Broward County jail following a traffic stop in which deputies say they discovered cocaine, according to Broward County Sheriff's Office arrest records.\n\nAccording to booking documents, the arrest occurred on January 15, 2024. The subject was listed as facing one count of possession of cocaine and one count of possession with intent to sell or deliver a controlled substance.\n\nThe Broward County Sheriff's Office made the arrest. No further details were available in the publicly available booking record at time of publication.\n\nAn arrest or criminal charge is not a conviction. The individual is presumed innocent unless proven guilty in court.\n\n*If you believe this story contains an error or wish to request a correction or removal, please contact us.*`,
      status: "DRAFT",
      source_name: "Broward County Sheriff's Office",
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

  console.log("Seed complete. Admin: admin@browardnews.local / admin123!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
