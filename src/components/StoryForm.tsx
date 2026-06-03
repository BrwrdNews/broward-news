"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StoryFormData, StoryStatus } from "@/lib/types";
import HeadlinePanel from "@/components/HeadlinePanel";

interface Props {
  initialData?: Partial<StoryFormData> & { id?: string; status?: StoryStatus };
  mode: "create" | "edit";
}

const DEFAULT: StoryFormData = {
  headline_standard: "",
  headline_catchy: "",
  headline_chosen: "",
  editorial_tone: "Catchy tabloid-style, fact-bound, legally cautious.",
  geography_focus: "Fort Lauderdale / Broward County, Florida",
  source_confidence_score: 0.9,
  body: "",
  source_name: "",
  subject_descriptor: "resident",
  source_url: "",
  incident_date: "",
  arrest_date: "",
  subject_name: "",
  charges: [],
  booking_number: "",
  municipality: "",
  admin_notes: "",
};

export default function StoryForm({ initialData, mode }: Props) {
  const router = useRouter();
  const [data, setData] = useState<StoryFormData>({
    ...DEFAULT,
    ...initialData,
  });
  const [chargeInput, setChargeInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function set(field: keyof StoryFormData, value: unknown) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function addCharge() {
    const c = chargeInput.trim();
    if (!c) return;
    set("charges", [...data.charges, c]);
    setChargeInput("");
  }

  function removeCharge(i: number) {
    set("charges", data.charges.filter((_, idx) => idx !== i));
  }

  async function save(targetStatus?: StoryStatus) {
    setSaving(true);
    setError("");
    setSuccess("");

    const payload = { ...data, status: targetStatus };
    const url =
      mode === "create"
        ? "/api/admin/stories"
        : `/api/admin/stories/${initialData?.id}`;
    const method = mode === "create" ? "POST" : "PATCH";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json();
        setError(j.error ?? "Save failed.");
      } else {
        const j = await res.json();
        setSuccess("Saved.");
        if (mode === "create") {
          router.push(`/admin/stories/${j.id}`);
        }
      }
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 text-sm px-4 py-2 rounded">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-300 text-green-700 text-sm px-4 py-2 rounded">
          {success}
        </div>
      )}

      {/* Headlines */}
      <section className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="font-semibold text-gray-700 border-b pb-2">Headlines</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Standard Headline <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={data.headline_standard}
            onChange={(e) => set("headline_standard", e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
            placeholder="Factual, straightforward headline"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Catchy Headline <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={data.headline_catchy}
            onChange={(e) => set("headline_catchy", e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
            placeholder="Tabloid-style, curiosity-driven headline"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Chosen Headline{" "}
            <span className="text-gray-400 text-xs">(leave blank to use Standard)</span>
          </label>
          <input
            type="text"
            value={data.headline_chosen ?? ""}
            onChange={(e) => set("headline_chosen", e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
            placeholder="Override — edit either headline here, or leave blank"
          />
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => set("headline_chosen", data.headline_standard)}
              className="text-xs text-blue-600 hover:underline"
            >
              Use Standard
            </button>
            <span className="text-gray-300">|</span>
            <button
              type="button"
              onClick={() => set("headline_chosen", data.headline_catchy)}
              className="text-xs text-brand-red hover:underline"
            >
              Use Catchy
            </button>
          </div>
        </div>
      </section>

      {/* Subject & Arrest Info */}
      <section className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="font-semibold text-gray-700 border-b pb-2">Subject & Arrest Info</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject Name</label>
            <input
              type="text"
              value={data.subject_name ?? ""}
              onChange={(e) => set("subject_name", e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Booking Number</label>
            <input
              type="text"
              value={data.booking_number ?? ""}
              onChange={(e) => set("booking_number", e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Arrest Date</label>
            <input
              type="date"
              value={data.arrest_date ?? ""}
              onChange={(e) => set("arrest_date", e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Incident Date</label>
            <input
              type="date"
              value={data.incident_date ?? ""}
              onChange={(e) => set("incident_date", e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Municipality</label>
            <input
              type="text"
              value={data.municipality ?? ""}
              onChange={(e) => set("municipality", e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="Fort Lauderdale"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject Descriptor{" "}
              <span className="text-gray-400 text-xs">used in generated headlines</span>
            </label>
            <select
              value={data.subject_descriptor ?? "resident"}
              onChange={(e) => set("subject_descriptor", e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white"
            >
              <option value="resident">resident</option>
              <option value="man">man</option>
              <option value="woman">woman</option>
              <option value="suspect">suspect</option>
              <option value="person">person</option>
            </select>
          </div>
        </div>

        {/* Charges */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Charges</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={chargeInput}
              onChange={(e) => setChargeInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCharge())}
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="Type a charge and press Enter or Add"
            />
            <button
              type="button"
              onClick={addCharge}
              className="bg-gray-700 text-white text-sm px-3 py-2 rounded hover:bg-gray-900"
            >
              Add
            </button>
          </div>
          {data.charges.length > 0 && (
            <ul className="mt-2 space-y-1">
              {data.charges.map((c, i) => (
                <li key={i} className="flex items-center gap-2 text-sm bg-gray-50 px-3 py-1 rounded">
                  <span className="flex-1">{c}</span>
                  <button
                    type="button"
                    onClick={() => removeCharge(i)}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Source Info */}
      <section className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="font-semibold text-gray-700 border-b pb-2">Source</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Source Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={data.source_name}
              onChange={(e) => set("source_name", e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="Broward County Sheriff's Office"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source URL</label>
            <input
              type="url"
              value={data.source_url ?? ""}
              onChange={(e) => set("source_url", e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confidence Score (0–1)
            </label>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={data.source_confidence_score}
              onChange={(e) =>
                set("source_confidence_score", parseFloat(e.target.value))
              }
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="font-semibold text-gray-700 border-b pb-2">Story Body</h2>
        <textarea
          rows={12}
          value={data.body}
          onChange={(e) => set("body", e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-brand-red"
          placeholder="Write the story body here. Remember to include: strong opening, source attribution, charge details, and close with the presumption-of-innocence statement."
        />
      </section>

      {/* Editorial Metadata */}
      <section className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="font-semibold text-gray-700 border-b pb-2">Editorial Metadata</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Geography Focus</label>
            <input
              type="text"
              value={data.geography_focus}
              onChange={(e) => set("geography_focus", e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Editorial Tone</label>
            <input
              type="text"
              value={data.editorial_tone}
              onChange={(e) => set("editorial_tone", e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes</label>
          <textarea
            rows={3}
            value={data.admin_notes ?? ""}
            onChange={(e) => set("admin_notes", e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="Internal notes — not published"
          />
        </div>
      </section>

      {/* Headline Options Panel — only visible after story is saved (edit mode) */}
      {mode === "edit" && initialData?.id ? (
        <HeadlinePanel
          storyId={initialData.id}
          municipality={data.municipality ?? "Broward County"}
          arrestDate={data.arrest_date ?? null}
          sourceName={data.source_name}
          charges={data.charges}
        />
      ) : (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-5 text-sm text-gray-500 text-center">
          <p className="font-medium">Headline Generator</p>
          <p className="mt-1">
            Save this story as a draft first, then return to this page to generate
            and compare headline options.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pb-10">
        <button
          type="button"
          onClick={() => save("DRAFT")}
          disabled={saving}
          className="bg-gray-700 text-white text-sm font-bold px-5 py-2 rounded hover:bg-gray-900 disabled:opacity-50"
        >
          Save as Draft
        </button>
        <button
          type="button"
          onClick={() => save("PENDING_REVIEW")}
          disabled={saving}
          className="bg-yellow-500 text-white text-sm font-bold px-5 py-2 rounded hover:bg-yellow-600 disabled:opacity-50"
        >
          Submit for Review
        </button>
        {mode === "edit" && (
          <>
            <button
              type="button"
              onClick={() => save("APPROVED")}
              disabled={saving}
              className="bg-blue-600 text-white text-sm font-bold px-5 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => save("PUBLISHED")}
              disabled={saving}
              className="bg-green-600 text-white text-sm font-bold px-5 py-2 rounded hover:bg-green-700 disabled:opacity-50"
            >
              Publish
            </button>
            <button
              type="button"
              onClick={() => save("REJECTED")}
              disabled={saving}
              className="bg-red-600 text-white text-sm font-bold px-5 py-2 rounded hover:bg-red-700 disabled:opacity-50"
            >
              Reject
            </button>
          </>
        )}
      </div>
    </div>
  );
}
