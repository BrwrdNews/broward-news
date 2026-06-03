"use client";

import { useEffect, useState, useCallback } from "react";
import type { HeadlineOption, RiskLevel, HeadlineStatus } from "@/lib/types";
import HeadlinePreviewModal from "@/components/HeadlinePreviewModal";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<string, string> = {
  DAILY_MAIL_HOOK: "Long Dramatic Hook",
  DRAMATIC_LOCAL:  "Dramatic Local Hook",
  CHARGE_FOCUSED:  "Charge-Focused Hook",
  RECORDS_REVEAL:  "Records Reveal",
  POLICE_SAY:      "Police Say",
  SHORT_MOBILE:    "Short Mobile",
  SAFER_FALLBACK:  "Safer Fallback",
};

const RISK_STYLES: Record<RiskLevel, string> = {
  LOW:    "bg-green-100 text-green-800 border-green-200",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200",
  HIGH:   "bg-red-100 text-red-700 border-red-200",
};

const APPROVAL_STYLES: Record<HeadlineStatus, string> = {
  PENDING:  "bg-gray-100 text-gray-600",
  APPROVED: "bg-blue-100 text-blue-700",
  REJECTED: "bg-red-100 text-red-600",
};

function ScorePill({ score, color }: { score: number; color: "green" | "blue" }) {
  const base =
    score >= 8 ? (color === "green" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800")
    : score >= 5 ? "bg-yellow-100 text-yellow-800"
    : "bg-red-100 text-red-700";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${base}`}>
      {score}/10
    </span>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  storyId: string;
  municipality?: string;
  arrestDate?: string | null;
  sourceName?: string;
  charges?: string[];
}

type ActionState = "idle" | "loading" | "success" | "error";

// ---------------------------------------------------------------------------
// HeadlinePanel
// ---------------------------------------------------------------------------

export default function HeadlinePanel({
  storyId,
  municipality = "Broward County",
  arrestDate,
  sourceName = "",
  charges = [],
}: Props) {
  const [headlines, setHeadlines] = useState<HeadlineOption[]>([]);
  const [fetching, setFetching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [actionState, setActionState] = useState<Record<string, ActionState>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [globalError, setGlobalError] = useState("");
  const [globalSuccess, setGlobalSuccess] = useState("");

  // A/B preview state — up to 2 headlines selected for comparison
  const [previewIds, setPreviewIds] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchHeadlines = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch(`/api/admin/stories/${storyId}/headlines`);
      if (res.ok) setHeadlines(await res.json());
    } finally {
      setFetching(false);
    }
  }, [storyId]);

  useEffect(() => { fetchHeadlines(); }, [fetchHeadlines]);

  // ── Generate ──────────────────────────────────────────────────────────────

  async function generate(safeOnly = false) {
    setGenerating(true);
    setGlobalError("");
    setGlobalSuccess("");
    try {
      const res = await fetch(`/api/admin/stories/${storyId}/headlines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ safeOnly }),
      });
      if (!res.ok) {
        const j = await res.json();
        setGlobalError(j.error ?? "Failed to generate headlines.");
      } else {
        const j = await res.json();
        setGlobalSuccess(
          safeOnly
            ? "Safer rewrite generated — approve it below to make it selectable."
            : `Batch ${j.batch} generated — ${j.count} new options added. Review and approve to select.`
        );
        await fetchHeadlines();
      }
    } catch {
      setGlobalError("Network error while generating headlines.");
    } finally {
      setGenerating(false);
    }
  }

  // ── Approve / Reject ──────────────────────────────────────────────────────

  async function approveHeadline(hid: string) {
    setActionState((s) => ({ ...s, [hid]: "loading" }));
    try {
      const res = await fetch(`/api/admin/stories/${storyId}/headlines/${hid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const j = await res.json();
      if (!res.ok) {
        setMessages((m) => ({ ...m, [hid]: j.error ?? "Approve failed." }));
        setActionState((s) => ({ ...s, [hid]: "error" }));
      } else {
        setHeadlines((hs) => hs.map((h) => (h.id === hid ? { ...h, ...j } : h)));
        setActionState((s) => ({ ...s, [hid]: "success" }));
      }
    } catch {
      setMessages((m) => ({ ...m, [hid]: "Network error." }));
      setActionState((s) => ({ ...s, [hid]: "error" }));
    }
  }

  async function rejectHeadline(hid: string) {
    setActionState((s) => ({ ...s, [hid]: "loading" }));
    try {
      const res = await fetch(`/api/admin/stories/${storyId}/headlines/${hid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: rejectReason }),
      });
      const j = await res.json();
      if (!res.ok) {
        setMessages((m) => ({ ...m, [hid]: j.error ?? "Reject failed." }));
        setActionState((s) => ({ ...s, [hid]: "error" }));
      } else {
        setHeadlines((hs) => hs.map((h) => (h.id === hid ? { ...h, ...j } : h)));
        setActionState((s) => ({ ...s, [hid]: "success" }));
      }
    } catch {
      setMessages((m) => ({ ...m, [hid]: "Network error." }));
      setActionState((s) => ({ ...s, [hid]: "error" }));
    } finally {
      setRejectingId(null);
      setRejectReason("");
    }
  }

  // ── Select ────────────────────────────────────────────────────────────────

  async function selectHeadline(hid: string, action: "select" | "confirm" = "select") {
    setActionState((s) => ({ ...s, [hid]: "loading" }));
    setMessages((m) => ({ ...m, [hid]: "" }));
    setValidationErrors((e) => ({ ...e, [hid]: [] }));
    setGlobalError("");
    setGlobalSuccess("");
    try {
      const res = await fetch(`/api/admin/stories/${storyId}/headlines/${hid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await res.json();

      if (res.status === 202 && j.requiresConfirmation) {
        setPendingConfirm(hid);
        setMessages((m) => ({ ...m, [hid]: j.message }));
        setActionState((s) => ({ ...s, [hid]: "idle" }));
        return;
      }
      if (res.status === 422) {
        if (j.validation_errors?.length) {
          setValidationErrors((e) => ({ ...e, [hid]: j.validation_errors }));
        }
        setMessages((m) => ({ ...m, [hid]: j.error ?? "Validation failed." }));
        setActionState((s) => ({ ...s, [hid]: "error" }));
        return;
      }
      if (!res.ok) {
        setMessages((m) => ({ ...m, [hid]: j.error ?? "Action failed." }));
        setActionState((s) => ({ ...s, [hid]: "error" }));
        return;
      }

      setActionState((s) => ({ ...s, [hid]: "success" }));
      setPendingConfirm(null);
      const warnings = j.validation_warnings;
      if (warnings?.length) {
        setMessages((m) => ({ ...m, [hid]: `Selected. Warning: ${warnings.join(" | ")}` }));
      } else {
        setGlobalSuccess("Headline selected and saved to story.");
      }
      await fetchHeadlines();
    } catch {
      setMessages((m) => ({ ...m, [hid]: "Network error." }));
      setActionState((s) => ({ ...s, [hid]: "error" }));
    }
  }

  // ── Block ─────────────────────────────────────────────────────────────────

  async function blockHeadline(hid: string) {
    try {
      await fetch(`/api/admin/stories/${storyId}/headlines/${hid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "block" }),
      });
      await fetchHeadlines();
    } catch {
      setGlobalError("Failed to block headline.");
    }
  }

  // ── A/B Preview ───────────────────────────────────────────────────────────

  function togglePreview(hid: string) {
    setPreviewIds((ids) => {
      if (ids.includes(hid)) return ids.filter((id) => id !== hid);
      if (ids.length >= 2) return [ids[1], hid]; // slide window
      return [...ids, hid];
    });
  }

  const previewHeadlines = previewIds
    .map((id) => headlines.find((h) => h.id === id))
    .filter(Boolean) as HeadlineOption[];

  // ── Grouping ──────────────────────────────────────────────────────────────

  const batches = Array.from(
    new Set(headlines.map((h) => h.generation_batch))
  ).sort((a, b) => b - a);

  const selectedHeadline = headlines.find((h) => h.is_selected);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <section className="bg-white rounded-lg shadow p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between border-b pb-3 gap-4">
        <div>
          <h2 className="font-semibold text-gray-700 text-base">Headline Options</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Generate batches, approve options, then select the final headline.
            Approval is required before a headline can be selected.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {previewIds.length > 0 && (
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="text-sm border border-gray-300 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-50"
            >
              Preview {previewIds.length === 2 ? "A/B" : "(1)"}
            </button>
          )}
          <button
            type="button"
            onClick={() => generate(false)}
            disabled={generating}
            className="bg-brand-dark text-white text-sm font-bold px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
          >
            {generating ? "Generating…" : headlines.length === 0 ? "Generate Headlines" : "Generate 6 More"}
          </button>
        </div>
      </div>

      {/* Global messages */}
      {globalError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded">
          {globalError}
        </div>
      )}
      {globalSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2 rounded">
          {globalSuccess}
        </div>
      )}

      {/* Preview hint */}
      {headlines.length > 0 && previewIds.length === 0 && (
        <p className="text-xs text-gray-400">
          Tip: check up to 2 headlines using the checkboxes, then click <strong>Preview</strong> to compare how they look on the public page.
        </p>
      )}

      {/* Selected headline callout */}
      {selectedHeadline && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
            Currently selected headline
          </p>
          <p className="text-sm font-medium text-blue-900">{selectedHeadline.headline_text}</p>
          <p className="text-xs text-blue-500 mt-1">
            {TYPE_LABELS[selectedHeadline.headline_type]} &middot; Batch {selectedHeadline.generation_batch}
          </p>
        </div>
      )}

      {fetching && <p className="text-sm text-gray-400 italic">Loading headlines…</p>}

      {!fetching && headlines.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          <p>No headline options yet.</p>
          <p className="mt-1">Click <strong>Generate Headlines</strong> to create the first batch.</p>
        </div>
      )}

      {/* Batches */}
      {batches.map((batch) => {
        const batchHeadlines = headlines.filter((h) => h.generation_batch === batch);
        return (
          <div key={batch}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Batch {batch}
              {batch === batches[0] && (
                <span className="ml-2 bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-xs normal-case">newest</span>
              )}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-2 py-2 border border-gray-200 w-6">
                      <span className="sr-only">Preview select</span>
                    </th>
                    <th className="text-left px-3 py-2 border border-gray-200 w-[30%]">Headline + Deck</th>
                    <th className="text-left px-3 py-2 border border-gray-200">Type</th>
                    <th className="text-center px-3 py-2 border border-gray-200">Safety</th>
                    <th className="text-center px-3 py-2 border border-gray-200">Catchy</th>
                    <th className="text-center px-3 py-2 border border-gray-200">Unique</th>
                    <th className="text-center px-3 py-2 border border-gray-200">Drama</th>
                    <th className="text-center px-3 py-2 border border-gray-200">Risk</th>
                    <th className="text-center px-3 py-2 border border-gray-200">Approval</th>
                    <th className="text-left px-3 py-2 border border-gray-200">Notes</th>
                    <th className="text-center px-3 py-2 border border-gray-200">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {batchHeadlines.map((h) => {
                    const isSelected      = h.is_selected;
                    const isBlocked       = h.is_blocked || h.risk_level === "HIGH";
                    const isRejected      = h.approval_status === "REJECTED";
                    const isPendingConfirm = pendingConfirm === h.id;
                    const isPreviewPicked = previewIds.includes(h.id);
                    const rowBg = isSelected ? "bg-blue-50" : isBlocked || isRejected ? "bg-gray-50 opacity-60" : "";

                    return (
                      <tr key={h.id} className={`${rowBg} border-b border-gray-100`}>
                        {/* Preview checkbox */}
                        <td className="px-2 py-2 border border-gray-200 text-center align-top">
                          <input
                            type="checkbox"
                            checked={isPreviewPicked}
                            onChange={() => togglePreview(h.id)}
                            title="Add to preview"
                            className="cursor-pointer accent-brand-red"
                          />
                        </td>

                        {/* Headline text + deck */}
                        <td className="px-3 py-2 border border-gray-200 align-top">
                          <p className="font-medium text-gray-800 leading-snug">{h.headline_text}</p>
                          {h.deck && (
                            <p className="text-xs text-gray-500 italic mt-1 leading-snug border-l-2 border-gray-200 pl-2">{h.deck}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">{h.headline_text.length} chars</p>
                          {isSelected && (
                            <span className="inline-block mt-1 text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded">✓ Selected</span>
                          )}
                          {h.rejection_reason && (
                            <p className="text-xs text-red-500 mt-1">Rejected: {h.rejection_reason}</p>
                          )}
                          {messages[h.id] && (
                            <p className={`text-xs mt-1 ${actionState[h.id] === "error" ? "text-red-600" : "text-yellow-700"}`}>
                              {messages[h.id]}
                            </p>
                          )}
                          {(validationErrors[h.id] ?? []).map((e, i) => (
                            <p key={i} className="text-xs text-red-600 mt-0.5">⚠ {e}</p>
                          ))}
                          {/* Reject reason input */}
                          {rejectingId === h.id && (
                            <div className="mt-2 flex gap-2 items-start">
                              <input
                                type="text"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Rejection reason (optional)"
                                className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => rejectHeadline(h.id)}
                                disabled={actionState[h.id] === "loading"}
                                className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 disabled:opacity-50"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => { setRejectingId(null); setRejectReason(""); }}
                                className="text-xs text-gray-500 px-1 py-1"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Type */}
                        <td className="px-3 py-2 border border-gray-200 align-top whitespace-nowrap">
                          <span className="text-xs text-gray-600">{TYPE_LABELS[h.headline_type]}</span>
                        </td>

                        {/* Safety score */}
                        <td className="px-3 py-2 border border-gray-200 text-center align-top">
                          <ScorePill score={h.factual_safety_score} color="green" />
                        </td>

                        {/* Catchiness score */}
                        <td className="px-3 py-2 border border-gray-200 text-center align-top">
                          <ScorePill score={h.catchiness_score} color="blue" />
                        </td>

                        {/* Uniqueness score */}
                        <td className="px-3 py-2 border border-gray-200 text-center align-top">
                          <ScorePill score={h.uniqueness_score} color="blue" />
                        </td>

                        {/* Sensationalism score */}
                        <td className="px-3 py-2 border border-gray-200 text-center align-top">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                            h.sensationalism_score >= 7 ? "bg-orange-100 text-orange-800"
                            : h.sensationalism_score >= 5 ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-600"
                          }`}>
                            {h.sensationalism_score}/10
                          </span>
                        </td>

                        {/* Risk level */}
                        <td className="px-3 py-2 border border-gray-200 text-center align-top">
                          <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${RISK_STYLES[h.risk_level as RiskLevel]}`}>
                            {h.risk_level}
                          </span>
                        </td>

                        {/* Approval status */}
                        <td className="px-3 py-2 border border-gray-200 text-center align-top">
                          <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${APPROVAL_STYLES[h.approval_status as HeadlineStatus]}`}>
                            {h.approval_status}
                          </span>
                          {h.approved_at && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {new Date(h.approved_at).toLocaleDateString()}
                            </p>
                          )}
                        </td>

                        {/* Notes */}
                        <td className="px-3 py-2 border border-gray-200 align-top">
                          <p className="text-xs text-gray-500 leading-relaxed">{h.reason_for_score}</p>
                          {h.source_fields_used.length > 0 && (
                            <p className="text-xs text-gray-400 mt-1">Fields: {h.source_fields_used.join(", ")}</p>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2 border border-gray-200 align-top">
                          <div className="flex flex-col gap-1.5 items-start min-w-[110px]">
                            {/* Approve */}
                            {h.approval_status === "PENDING" && !isBlocked && (
                              <button
                                type="button"
                                onClick={() => approveHeadline(h.id)}
                                disabled={actionState[h.id] === "loading"}
                                className="text-xs bg-blue-600 text-white font-bold px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50 w-full text-center"
                              >
                                {actionState[h.id] === "loading" ? "…" : "Approve"}
                              </button>
                            )}

                            {/* Reject */}
                            {h.approval_status === "PENDING" && !isBlocked && (
                              <button
                                type="button"
                                onClick={() => setRejectingId(h.id)}
                                disabled={actionState[h.id] === "loading"}
                                className="text-xs bg-white text-red-600 border border-red-300 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50 w-full text-center"
                              >
                                Reject
                              </button>
                            )}

                            {/* Select / confirm (APPROVED only) */}
                            {h.approval_status === "APPROVED" && !isBlocked && !isSelected && (
                              <>
                                {isPendingConfirm ? (
                                  <button
                                    type="button"
                                    onClick={() => selectHeadline(h.id, "confirm")}
                                    disabled={actionState[h.id] === "loading"}
                                    className="text-xs bg-yellow-500 text-white font-bold px-2 py-1 rounded hover:bg-yellow-600 disabled:opacity-50 w-full text-center"
                                  >
                                    Confirm select
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => selectHeadline(h.id)}
                                    disabled={actionState[h.id] === "loading"}
                                    className="text-xs bg-green-600 text-white font-bold px-2 py-1 rounded hover:bg-green-700 disabled:opacity-50 w-full text-center"
                                  >
                                    {actionState[h.id] === "loading" ? "…" : "Select"}
                                  </button>
                                )}
                              </>
                            )}

                            {/* Safer rewrite */}
                            {h.risk_level === "MEDIUM" && (
                              <button
                                type="button"
                                onClick={() => generate(true)}
                                disabled={generating}
                                className="text-xs bg-gray-100 text-gray-700 border border-gray-300 px-2 py-1 rounded hover:bg-gray-200 disabled:opacity-50 w-full text-center"
                              >
                                Safer rewrite
                              </button>
                            )}

                            {/* Block */}
                            {!isBlocked && !isSelected && h.approval_status !== "REJECTED" && (
                              <button
                                type="button"
                                onClick={() => blockHeadline(h.id)}
                                className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 w-full text-center"
                              >
                                Block
                              </button>
                            )}

                            {isSelected && <span className="text-xs text-blue-600 font-semibold">Active</span>}
                            {h.risk_level === "HIGH" && <span className="text-xs text-red-600 font-semibold">Blocked (high risk)</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Footer actions */}
      {headlines.length > 0 && (
        <div className="flex items-center gap-3 pt-2 border-t border-gray-100 flex-wrap">
          <button
            type="button"
            onClick={() => generate(false)}
            disabled={generating}
            className="text-sm text-gray-600 border border-gray-300 px-3 py-1.5 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            {generating ? "Generating…" : "Generate 6 more options"}
          </button>
          <button
            type="button"
            onClick={() => generate(true)}
            disabled={generating}
            className="text-sm text-gray-600 border border-gray-300 px-3 py-1.5 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Generate safer rewrite (STANDARD only)
          </button>
          {previewIds.length > 0 && (
            <button
              type="button"
              onClick={() => { setPreviewIds([]); }}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Clear preview selection
            </button>
          )}
        </div>
      )}

      {/* A/B Preview modal */}
      {previewOpen && previewHeadlines.length > 0 && (
        <HeadlinePreviewModal
          headlines={previewHeadlines as [HeadlineOption] | [HeadlineOption, HeadlineOption]}
          municipality={municipality}
          arrestDate={arrestDate}
          sourceName={sourceName}
          charges={charges}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </section>
  );
}
