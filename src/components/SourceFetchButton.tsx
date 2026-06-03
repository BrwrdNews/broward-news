"use client";

import { useState } from "react";

interface Props {
  sourceId: string;
  disabled?: boolean;
}

export default function SourceFetchButton({ sourceId, disabled }: Props) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string>("");
  const [error, setError]   = useState<string>("");

  async function runFetch(useMock: boolean) {
    setRunning(true);
    setResult("");
    setError("");
    try {
      const res = await fetch(`/api/admin/sources/${sourceId}/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useMock }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "Fetch failed.");
      } else {
        setResult(
          `${j.status}: ${j.recordsImported} imported, ${j.recordsSkipped} skipped` +
          (j.errors?.length ? ` — ${j.errors[0]}` : "")
        );
      }
    } catch {
      setError("Network error.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-1 items-center">
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => runFetch(false)}
          disabled={disabled || running}
          className="text-xs bg-brand-dark text-white px-2 py-1 rounded hover:bg-gray-800 disabled:opacity-40"
        >
          {running ? "Running…" : "Fetch Live"}
        </button>
        <button
          type="button"
          onClick={() => runFetch(true)}
          disabled={disabled || running}
          className="text-xs bg-gray-100 text-gray-700 border border-gray-300 px-2 py-1 rounded hover:bg-gray-200 disabled:opacity-40"
        >
          Mock
        </button>
      </div>
      {result && (
        <p className="text-xs text-green-700 text-center max-w-[140px]">{result}</p>
      )}
      {error && (
        <p className="text-xs text-red-600 text-center max-w-[140px]">{error}</p>
      )}
    </div>
  );
}
