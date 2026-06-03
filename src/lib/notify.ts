/**
 * Headline notification helper.
 *
 * Sends an in-app notification record and, if SMTP is configured,
 * an email alert to the admin address.
 *
 * Environment variables (all optional — falls back to console log):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 *   NOTIFY_EMAIL_TO   (defaults to SMTP_USER)
 *   NEXTAUTH_URL      (used to build story links)
 */

import { prisma } from "./prisma";

export interface NotifyBatchReadyOptions {
  storyId: string;
  storySlug: string;
  storyHeadline: string;
  municipality: string | null;
  batchNumber: number;
  headlineCount: number;
}

export async function notifyBatchReady(opts: NotifyBatchReadyOptions) {
  const { storyId, batchNumber } = opts;

  // ── 1. Write in-app notification record ──────────────────────────────────
  const record = await prisma.headlineNotification.create({
    data: {
      story_id: storyId,
      batch: batchNumber,
      type: "BATCH_READY",
    },
  });

  // ── 2. Attempt email (graceful fail if SMTP not configured) ───────────────
  const smtpHost = process.env.SMTP_HOST;
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const storyUrl = `${baseUrl}/admin/stories/${storyId}`;

  if (!smtpHost) {
    console.log(
      `[notify] SMTP not configured. Headline batch ready:\n` +
        `  Story : ${opts.storyHeadline}\n` +
        `  Batch : ${batchNumber} (${opts.headlineCount} options)\n` +
        `  URL   : ${storyUrl}`
    );
    return record;
  }

  try {
    // Dynamic import so nodemailer is only loaded when actually needed
    const nodemailer = await import("nodemailer").then((m) => m.default ?? m);

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(process.env.SMTP_PORT ?? "587"),
      secure: process.env.SMTP_PORT === "465",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });

    const to = process.env.NOTIFY_EMAIL_TO ?? process.env.SMTP_USER ?? "";
    if (!to) throw new Error("NOTIFY_EMAIL_TO is not set");

    await transporter.sendMail({
      from: `"Broward News CMS" <${process.env.SMTP_USER}>`,
      to,
      subject: `[Broward News] Headline batch ${batchNumber} ready for review`,
      html: `
        <p><strong>A new headline batch is ready for review.</strong></p>
        <table style="border-collapse:collapse;width:100%;max-width:520px">
          <tr><td style="padding:4px 8px;color:#666">Story</td>
              <td style="padding:4px 8px">${opts.storyHeadline}</td></tr>
          <tr><td style="padding:4px 8px;color:#666">Location</td>
              <td style="padding:4px 8px">${opts.municipality ?? "Broward County"}</td></tr>
          <tr><td style="padding:4px 8px;color:#666">Batch</td>
              <td style="padding:4px 8px">${batchNumber} &mdash; ${opts.headlineCount} options generated</td></tr>
        </table>
        <p style="margin-top:16px">
          <a href="${storyUrl}" style="background:#cc0000;color:#fff;padding:8px 16px;
             border-radius:4px;text-decoration:none;font-weight:bold">
            Review Headlines
          </a>
        </p>
        <p style="color:#999;font-size:12px;margin-top:24px">
          Broward News CMS &mdash; ${baseUrl}
        </p>`,
      text:
        `Headline batch ${batchNumber} ready for review.\n\n` +
        `Story: ${opts.storyHeadline}\n` +
        `Location: ${opts.municipality ?? "Broward County"}\n` +
        `Options: ${opts.headlineCount}\n\n` +
        `Review: ${storyUrl}`,
    });

    await prisma.headlineNotification.update({
      where: { id: record.id },
      data: { email_sent: true },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[notify] Email send failed: ${msg}`);
    await prisma.headlineNotification.update({
      where: { id: record.id },
      data: { email_error: msg },
    });
  }

  return record;
}

// ---------------------------------------------------------------------------
// Badge count — unreviewed batches (PENDING headlines, not dismissed)
// ---------------------------------------------------------------------------

export async function getPendingHeadlineBadgeCount(): Promise<number> {
  // Count distinct stories that have at least one PENDING headline
  const result = await prisma.storyHeadline.groupBy({
    by: ["story_id"],
    where: { approval_status: "PENDING" },
  });
  return result.length;
}
