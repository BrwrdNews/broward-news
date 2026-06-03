"use client";

import { useEffect, useState, useCallback } from "react";
import type { HeadlineOption, RiskLevel } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<string, string> = {
  STANDARD:     "Standard Factual",
  CATCHY:       "Catchy",
  ALLITERATIVE: "Alliterative",
  RHYME:        "Rhyme / Near-rhyme",
  IDIOM:        "Idiom / Play-on-words",
  SHORT_MOBILE: "Short Mobile",
};

const RISK_STYLES: Record<RiskLevel, string> = {
  LOW:    "bg-green-100 text-green-800 border-green-200",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200",
  HIGH:   "bg-red-100 text-red-700 border-red-200",
};

const RISK_LABELS: Record<RiskLevel, string> = {
  LOW:    "Low risk",
  MEDIUM: "Medium risk — confirm required",
  HIGH:   "High risk — blocked",
};

function ScorePill({ score, colorHigh }: { score: number; colorHigh: boolean }) {
  const bg =
    score >= 8
      ? colorHigh ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
      : score >= 5
      ? "bg-yellow-100 text-yellow-800"
      : "bg-red-100 text-red-700";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${bg}`}>
      {score}/10
    </span>
  );
}

// ---------------------------------------------------------------------------
// HeadlinePanel
// ---------------------------------------------------------------------------

interface Props {
  storyId: string;
}

type ActionState = "idle" | "loading" | "success" | "error";

export default function HeadlinePanel({ storyId }: Props) {
  const [headlines, setHeadlines] = useState<HeadlineOption[]>([]);
  const [fetching, setFetching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [actionState, setActionState] = useState<Record<string, ActionState>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState("");
  const [globalSuccess, setGlobalSuccess] = useState("");

  // ── Fetch ───────────────────────────────────────────────────────────────

  const fetchHeadlines = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch(`/api/admin/stories/${storyId}/headlines`);
      if (res.ok) setHeadlines(await res.json());
    } finally {
      setFetching(false);
    }
  }, [storyId]);

  useEffect(() => {
    fetchHeadlines();
  }, [fetchHeadlines]);

  // ── Generate ────────────────────────────────────────────────────────────

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
            ? "Safer rewrite generated."
            : `Batch ${j.batch} generated — ${j.count} new options added.`
        );
        await fetchHeadlines();
      }
    } catch {
      setGlobalError("Network error while generating headlines.");
    } finally {
      setGenerating(false);
    }
  }

  // ── Select / confirm ─────────────────────────────────────────────────────

  async function selectHeadline(hid: string, action: "select" | "confirm" = "select") {
    setActionState((s) => ({ ...s, [hid]: "loading" }));
    setMessages((m) => ({ ...m, [hid]: "" }));
    setValidationErrors((e) => ({ ...e, [hid]: [] }));
    setGlobalError("");
    setGlobalSuccess("");

    try {
      const res = await fetch(
        `/api/admin/stories/${storyId}/headlines/${hid}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      const j = await res.json();

      if (res.status === 202 && j.requiresConfirmation) {
        // MEDIUM risk — need explicit confirmation
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
      if (j.validation_warnings?.length) {
        setMessages((m) => ({
          ...m,
          [hid]: `Selected. Warning: ${j.validation_warnings.join(" | ")}`,
        }));
      } else {
        setGlobalSuccess("Headline selected and saved to story.");
      }
      await fetchHeadlines();
    } catch {
      setMessages((m) => ({ ...m, [hid]: "Network error." }));
      setActionState((s) => ({ ...s, [hid]: "error" }));
    }
  }

  // ── Block ────────────────────────────────────────────────────────────────

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

  // ── Group by batch ───────────────────────────────────────────────────────

  const batches = Array.from(
    new Set(headlines.map((h) => h.generation_batch))
  ).sort((a, b) => b - a); // newest first

  const selectedHeadline = headlines.find((h) => h.is_selected);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <section className="bg-white rounded-lg shadow p-6 space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h2 className="font-semibold text-gray-700 text-base">
            Headline Options
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Generate, compare, and select the headline that will appear on
            the published story. Only LOW-risk headlines can be selected
            without confirmation.
          </p>
        </div>
        <button
          type="button"
          onClick={() => generate(false)}
          disabled={generating}
          className="bg-brand-dark text-white text-sm font-bold px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50 whitespace-nowrap"
        >
          {generating ? "Generating…" : headlines.length === 0 ? "Generate Headlines" : "Generate 6 More"}
        </button>
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

      {/* Selected headline callout */}
      {selectedHeadline && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
            Currently selected headline
          </p>
          <p className="text-sm font-medium text-blue-900">
            {selectedHeadline.headline_text}
          </p>
          <p className="text-xs text-blue-500 mt-1">
            Type: {TYPE_LABELS[selectedHeadline.headline_type]} &middot; Batch {selectedHeadline.generation_batch}
          </p>
        </div>
      )}

      {fetching && (
        <p className="text-sm text-gray-400 italic">Loading headlines…</p>
      )}

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
                <span className="ml-2 bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-xs normal-case">
                  newest
                </span>
              )}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-3 py-2 border border-gray-200 w-[35%]">Headline</th>
                    <th className="text-left px-3 py-2 border border-gray-200">Type</th>
                    <th className="text-center px-3 py-2 border border-gray-200">Safety</th>
                    <th className="text-center px-3 py-2 border border-gray-200">Catchy</th>
                    <th className="text-center px-3 py-2 border border-gray-200">Risk</th>
                    <th className="text-left px-3 py-2 border border-gray-200">Notes</th>
                    <th className="text-center px-3 py-2 border border-gray-200">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {batchHeadlines.map((h) => {
                    const isSelected = h.is_selected;
                    const isBlocked = h.is_blocked || h.risk_level === "HIGH";
                    const isPendingConfirm = pendingConfirm === h.id;
                    const rowBg = isSelected
                      ? "bg-blue-50"
                      : isBlocked
                      ? "bg-gray-50 opacity-60"
                      : "";

                    return (
                      <tr key={h.id} className={`${rowBg} border-b border-gray-100`}>
                        {/* Headline text */}
                        <td className="px-3 py-2 border border-gray-200 align-top">
                          <p className="font-medium text-gray-800 leading-snug">{h.headline_text}</p>
                          {isSelected && (
                            <span className="inline-block mt-1 text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded">
                              ✓ Selected
                            </span>
                          )}
                          {/* Per-row messages */}
                          {messages[h.id] && (
                            <p className={`text-xs mt-1 ${
                              actionState[h.id] === "error" ? "text-red-600" : "text-yellow-700"
                            }`}>
                              {messages[h.id]}
                            </p>
                          )}
                          {(validationErrors[h.id] ?? []).map((e, i) => (
                            <p key={i} className="text-xs text-red-600 mt-0.5">
                              ⚠ {e}
                            </p>
                          ))}
                        </td>

                        {/* Type */}
                        <td className="px-3 py-2 border border-gray-200 align-top whitespace-nowrap">
                          <span className="text-xs text-gray-600">
                            {TYPE_LABELS[h.headline_type] ?? h.headline_type}
                          </span>
                        </td>

                        {/* Safety score */}
                        <td className="px-3 py-2 border border-gray-200 text-center align-top">
                          <ScorePill score={h.factual_safety_score} colorHigh={true} />
                        </td>

                        {/* Catchiness score */}
                        <td className="px-3 py-2 border border-gray-200 text-center align-top">
                          <ScorePill score={h.catchiness_score} colorHigh={false} />
                        </td>

                        {/* Risk level */}
                        <td className="px-3 py-2 border border-gray-200 text-center align-top">
                          <span
                            className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${
                              RISK_STYLES[h.risk_level as RiskLevel]
                            }`}
                          >
                            {h.risk_level}
                          </span>
                        </td>

                        {/* Notes */}
                        <td className="px-3 py-2 border border-gray-200 align-top">
                          <p className="text-xs text-gray-500 leading-relaxed">
                            {h.reason_for_score}
                          </p>
                          {h.source_fields_used.length > 0 && (
                            <p className="text-xs text-gray-400 mt-1">
                              Fields: {h.source_fields_used.join(", ")}
                            </p>
                          )}
                          {RISK_LABELS[h.risk_level as RiskLevel] && (
                            <p className={`text-xs mt-1 font-medium ${
                              h.risk_level === "HIGH"
                                ? "text-red-600"
                                : h.risk_level === "MEDIUM"
                                ? "text-yellow-700"
                                : "text-green-700"
                            }`}>
                              {RISK_LABELS[h.risk_level as RiskLevel]}
                            </p>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2 border border-gray-200 align-top">
                          <div className="flex flex-col gap-1.5 items-start min-w-[120px]">
                            {/* Select / confirm */}
                            {!isBlocked && !isSelected && (
                              <>
                                {isPendingConfirm ? (
                                  <button
                                    type="button"
                                    onClick={() => selectHeadline(h.id, "confirm")}
                                    disabled={actionState[h.id] === "loading"}
                                    className="text-xs bg-yellow-500 text-white font-bold px-2 py-1 rounded hover:bg-yellow-600 disabled:opacity-50 w-full text-center"
                                  >
                                    Confirm selection
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => selectHeadline(h.id)}
                                    disabled={actionState[h.id] === "loading"}
                                    className="text-xs bg-blue-600 text-white font-bold px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50 w-full text-center"
                                  >
                                    {actionState[h.id] === "loading" ? "…" : "Select"}
                                  </button>
                                )}
                              </>
                            )}

                            {/* Safer rewrite (MEDIUM risk only) */}
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

                            {/* Block (not already blocked, not selected) */}
                            {!isBlocked && !isSelected && (
                              <button
                                type="button"
                                onClick={() => blockHeadline(h.id)}
                                className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 w-full text-center"
                              >
                                Block
                              </button>
                            )}

                            {isSelected && (
                              <span className="text-xs text-blue-600 font-semibold">
                                Active
                              </span>
                            )}

                            {h.risk_level === "HIGH" && (
                              <span className="text-xs text-red-600 font-semibold">
                                Blocked
                              </span>
                            )}
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

      {/* Generate more footer */}
      {headlines.length > 0 && (
        <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
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
        </div>
      )}
    </section>
  );
}
