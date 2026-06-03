"use client";

import { useState } from "react";
import type { HeadlineOption } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  STANDARD:     "Standard",
  CATCHY:       "Catchy",
  ALLITERATIVE: "Alliterative",
  RHYME:        "Rhyme",
  IDIOM:        "Idiom",
  SHORT_MOBILE: "Mobile",
};

interface Props {
  storyId: string;
  initialHeadlines: HeadlineOption[];
  riskStyles: Record<string, string>;
  approvalStyles: Record<string, string>;
}

export default function HeadlineQueueClient({
  storyId,
  initialHeadlines,
  riskStyles,
  approvalStyles,
}: Props) {
  const [headlines, setHeadlines] = useState(initialHeadlines);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function action(hid: string, act: string, extra?: Record<string, unknown>) {
    setBusy((b) => ({ ...b, [hid]: true }));
    setErrors((e) => ({ ...e, [hid]: "" }));
    try {
      const res = await fetch(
        `/api/admin/stories/${storyId}/headlines/${hid}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: act, ...extra }),
        }
      );
      const j = await res.json();
      if (!res.ok && res.status !== 202) {
        setErrors((e) => ({ ...e, [hid]: j.error ?? "Action failed." }));
      } else {
        // Merge the updated headline back into local state
        setHeadlines((hs) => hs.map((h) => (h.id === hid ? { ...h, ...j } : h)));
      }
    } catch {
      setErrors((e) => ({ ...e, [hid]: "Network error." }));
    } finally {
      setBusy((b) => ({ ...b, [hid]: false }));
      if (act === "reject") {
        setRejectingId(null);
        setRejectReason("");
      }
    }
  }

  // Show only PENDING (and recently actioned) headlines in the queue view
  const visibleHeadlines = headlines.filter(
    (h) => h.approval_status === "PENDING" || h.is_selected
  );

  if (visibleHeadlines.length === 0) {
    return (
      <p className="px-5 py-3 text-sm text-gray-400 italic">
        All options reviewed for this story.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <th className="text-left px-4 py-2 border-b border-gray-200 w-[40%]">Headline</th>
            <th className="text-left px-4 py-2 border-b border-gray-200">Type</th>
            <th className="text-center px-4 py-2 border-b border-gray-200">Safety</th>
            <th className="text-center px-4 py-2 border-b border-gray-200">Catch</th>
            <th className="text-center px-4 py-2 border-b border-gray-200">Risk</th>
            <th className="text-center px-4 py-2 border-b border-gray-200">Status</th>
            <th className="text-center px-4 py-2 border-b border-gray-200">Actions</th>
          </tr>
        </thead>
        <tbody>
          {visibleHeadlines.map((h) => (
            <tr
              key={h.id}
              className={`border-b border-gray-50 ${h.is_selected ? "bg-blue-50" : ""}`}
            >
              {/* Headline text */}
              <td className="px-4 py-3 align-top">
                <p className="font-medium text-gray-800 leading-snug">{h.headline_text}</p>
                {h.is_selected && (
                  <span className="inline-block mt-1 text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded">
                    ✓ Selected
                  </span>
                )}
                {errors[h.id] && (
                  <p className="text-xs text-red-600 mt-1">{errors[h.id]}</p>
                )}
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
                      onClick={() => action(h.id, "reject", { reason: rejectReason })}
                      disabled={busy[h.id]}
                      className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      Confirm Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRejectingId(null); setRejectReason(""); }}
                      className="text-xs text-gray-500 px-2 py-1"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </td>

              {/* Type */}
              <td className="px-4 py-3 align-top whitespace-nowrap">
                <span className="text-xs text-gray-600">
                  {TYPE_LABELS[h.headline_type] ?? h.headline_type}
                </span>
                <span className="block text-xs text-gray-400">Batch {h.generation_batch}</span>
              </td>

              {/* Safety score */}
              <td className="px-4 py-3 text-center align-top">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                  h.factual_safety_score >= 8 ? "bg-green-100 text-green-800" :
                  h.factual_safety_score >= 5 ? "bg-yellow-100 text-yellow-800" :
                  "bg-red-100 text-red-700"
                }`}>
                  {h.factual_safety_score}/10
                </span>
              </td>

              {/* Catchiness score */}
              <td className="px-4 py-3 text-center align-top">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                  h.catchiness_score >= 7 ? "bg-blue-100 text-blue-800" :
                  h.catchiness_score >= 5 ? "bg-gray-100 text-gray-700" :
                  "bg-gray-50 text-gray-500"
                }`}>
                  {h.catchiness_score}/10
                </span>
              </td>

              {/* Risk */}
              <td className="px-4 py-3 text-center align-top">
                <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${
                  riskStyles[h.risk_level] ?? ""
                }`}>
                  {h.risk_level}
                </span>
              </td>

              {/* Approval status */}
              <td className="px-4 py-3 text-center align-top">
                <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                  approvalStyles[h.approval_status] ?? ""
                }`}>
                  {h.approval_status}
                </span>
              </td>

              {/* Actions */}
              <td className="px-4 py-3 text-center align-top">
                {h.approval_status === "PENDING" && !h.is_blocked && (
                  <div className="flex flex-col gap-1.5 items-center min-w-[110px]">
                    <button
                      type="button"
                      onClick={() => action(h.id, "approve")}
                      disabled={busy[h.id]}
                      className="text-xs bg-blue-600 text-white font-bold px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50 w-full"
                    >
                      {busy[h.id] ? "…" : "Approve"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectingId(h.id)}
                      disabled={busy[h.id]}
                      className="text-xs bg-white text-red-600 border border-red-300 px-3 py-1 rounded hover:bg-red-50 disabled:opacity-50 w-full"
                    >
                      Reject
                    </button>
                  </div>
                )}
                {h.approval_status === "APPROVED" && !h.is_selected && (
                  <span className="text-xs text-blue-600 font-medium">Ready to select</span>
                )}
                {h.is_selected && (
                  <span className="text-xs text-blue-600 font-semibold">Active</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
