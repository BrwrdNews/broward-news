"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Source {
  id: string;
  name: string;
  source_type: string;
}

interface Props {
  sources: Source[];
}

export default function ManualSourceForm({ sources }: Props) {
  const router = useRouter();
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? "");
  const [rawText, setRawText]   = useState("");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [result, setResult]     = useState<{
    status: string;
    recordsFound: number;
    recordsImported: number;
    recordsSkipped: number;
    errors: string[];
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rawText.trim()) return;
    setSaving(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/admin/manual-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: sourceId || undefined, raw_text: rawText }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "Import failed.");
      } else {
        setResult(j);
        if (j.recordsImported > 0) {
          setTimeout(() => router.push("/admin/records"), 1500);
        }
      }
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setRawText((ev.target?.result as string) ?? "");
    };
    reader.readAsText(file);
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-5">
      {/* Source selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Source <span className="text-red-500">*</span>
        </label>
        <select
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white"
        >
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* File upload (CSV / text) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Upload file{" "}
          <span className="text-gray-400 text-xs">(CSV or .txt — content will appear in the text area below)</span>
        </label>
        <input
          type="file"
          accept=".csv,.txt,.json"
          onChange={handleFileChange}
          className="text-sm text-gray-600 file:mr-3 file:py-1 file:px-3 file:border file:border-gray-300 file:rounded file:text-xs file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
        />
      </div>

      {/* Raw text area */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Source text <span className="text-red-500">*</span>
        </label>
        <textarea
          rows={14}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={`Paste official source content here. Examples:
• HTML table from BSO booking search
• FLPD press release text
• CSV rows: Name,Date,BookingNo,Agency,City,Charge,Bond
• Broward Clerk JSON: {"case_number":"24-001234CF10A","defendant_name":"...","charges":[...]}`}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-red"
          required
        />
        <p className="text-xs text-gray-400 mt-1">
          {rawText.length > 0 ? `${rawText.length} characters` : ""}
        </p>
      </div>

      {/* Error / result */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded">
          {error}
        </div>
      )}
      {result && (
        <div className={`border rounded p-4 text-sm ${
          result.recordsImported > 0
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-yellow-50 border-yellow-200 text-yellow-800"
        }`}>
          <p className="font-semibold mb-1">
            {result.status} — {result.recordsImported} record{result.recordsImported !== 1 ? "s" : ""} imported
          </p>
          <p className="text-xs">
            Found: {result.recordsFound} &middot; Imported: {result.recordsImported} &middot; Skipped: {result.recordsSkipped}
          </p>
          {result.errors?.length > 0 && (
            <p className="text-xs mt-1 text-red-700">{result.errors[0]}</p>
          )}
          {result.recordsImported > 0 && (
            <p className="text-xs mt-1 text-green-700">Redirecting to Records…</p>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={saving || !rawText.trim()}
        className="w-full bg-brand-red text-white font-bold py-2 px-4 rounded hover:bg-red-700 transition-colors disabled:opacity-50"
      >
        {saving ? "Parsing & importing…" : "Parse & Import"}
      </button>
    </form>
  );
}
