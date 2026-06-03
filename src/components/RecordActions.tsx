"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  recordId: string;
  currentStatus: string;
  isSuppressed: boolean;
  hasStory: boolean;
}

export default function RecordActions({ recordId, currentStatus, isSuppressed, hasStory }: Props) {
  const router = useRouter();
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState("");
  const [success, setSuccess] = useState("");

  async function patch(data: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/admin/records/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "Action failed.");
      } else {
        setSuccess("Updated.");
        router.refresh();
      }
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function generateStory() {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/admin/records/${recordId}/generate-story`, {
        method: "POST",
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "Story generation failed.");
      } else {
        setSuccess("Story draft created!");
        router.push(`/admin/stories/${j.storyId}`);
      }
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-5">
      <h2 className="font-semibold text-gray-700 border-b pb-2 mb-3">Admin Actions</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded mb-3">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2 rounded mb-3">
          {success}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {/* Approve for draft */}
        {currentStatus === "NEW" || currentStatus === "NEEDS_REVIEW" ? (
          <button
            type="button"
            onClick={() => patch({ record_status: "APPROVED_FOR_DRAFT" })}
            disabled={busy || isSuppressed}
            className="text-sm bg-blue-600 text-white font-bold px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-40"
          >
            Approve for Draft
          </button>
        ) : null}

        {/* Generate story */}
        {currentStatus === "APPROVED_FOR_DRAFT" && !hasStory && (
          <button
            type="button"
            onClick={generateStory}
            disabled={busy || isSuppressed}
            className="text-sm bg-green-600 text-white font-bold px-4 py-2 rounded hover:bg-green-700 disabled:opacity-40"
          >
            Generate Story Draft
          </button>
        )}

        {/* Flag duplicate */}
        {currentStatus !== "DUPLICATE" && (
          <button
            type="button"
            onClick={() => patch({ record_status: "DUPLICATE" })}
            disabled={busy}
            className="text-sm bg-orange-500 text-white font-bold px-4 py-2 rounded hover:bg-orange-600 disabled:opacity-40"
          >
            Mark Duplicate
          </button>
        )}

        {/* Reject */}
        {currentStatus !== "REJECTED" && (
          <button
            type="button"
            onClick={() => patch({ record_status: "REJECTED" })}
            disabled={busy}
            className="text-sm bg-red-600 text-white font-bold px-4 py-2 rounded hover:bg-red-700 disabled:opacity-40"
          >
            Reject
          </button>
        )}

        {/* Toggle suppression */}
        <button
          type="button"
          onClick={() => patch({ is_suppressed: !isSuppressed })}
          disabled={busy}
          className={`text-sm font-bold px-4 py-2 rounded disabled:opacity-40 ${
            isSuppressed
              ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
              : "bg-orange-100 text-orange-700 border border-orange-300 hover:bg-orange-200"
          }`}
        >
          {isSuppressed ? "Unsuppress" : "Suppress"}
        </button>

        {/* Reset to NEW */}
        {currentStatus !== "NEW" && currentStatus !== "STORY_GENERATED" && (
          <button
            type="button"
            onClick={() => patch({ record_status: "NEW" })}
            disabled={busy}
            className="text-sm text-gray-500 border border-gray-300 px-4 py-2 rounded hover:bg-gray-50 disabled:opacity-40"
          >
            Reset to New
          </button>
        )}
      </div>

      {isSuppressed && (
        <p className="text-xs text-orange-700 mt-3">
          This record is suppressed. Approve for Draft and Generate Story are disabled.
          Unsuppress only if you have confirmed no minor is involved and the category is not sensitive.
        </p>
      )}
    </div>
  );
}
