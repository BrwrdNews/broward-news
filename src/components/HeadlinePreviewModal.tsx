"use client";

/**
 * A/B Headline Preview Modal
 *
 * Shows how up to 2 selected headline options would render on the public
 * story page. Opened from HeadlinePanel by clicking "Preview" on any row.
 */

import { useEffect, useRef } from "react";
import type { HeadlineOption } from "@/lib/types";

interface Props {
  headlines: [HeadlineOption] | [HeadlineOption, HeadlineOption];
  municipality: string;
  arrestDate?: string | null;
  sourceName: string;
  charges: string[];
  onClose: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  STANDARD:     "Standard Factual",
  CATCHY:       "Catchy",
  ALLITERATIVE: "Alliterative",
  RHYME:        "Rhyme / Near-rhyme",
  IDIOM:        "Idiom / Play-on-words",
  SHORT_MOBILE: "Short Mobile",
};

function StoryPreview({
  headline,
  municipality,
  arrestDate,
  sourceName,
  charges,
  label,
}: {
  headline: HeadlineOption;
  municipality: string;
  arrestDate?: string | null;
  sourceName: string;
  charges: string[];
  label: string;
}) {
  return (
    <div className="flex-1 min-w-0 border border-gray-200 rounded-lg overflow-hidden">
      {/* Label bar */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">{label}</span>
        <span className="text-xs text-gray-400">{TYPE_LABELS[headline.headline_type]}</span>
      </div>

      {/* Simulated public page */}
      <div className="p-4 bg-white">
        {/* Site header mock */}
        <div className="bg-gray-900 text-white text-xs font-bold px-3 py-1.5 rounded mb-3 inline-block">
          BROWARD NEWS
        </div>

        {/* Article badge */}
        <div className="mb-2">
          <span className="bg-red-600 text-white text-xs font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
            Arrest Report
          </span>
        </div>

        {/* Headline */}
        <h2 className="text-xl font-headline font-bold leading-tight text-gray-900 mb-3">
          {headline.headline_text}
        </h2>

        {/* Meta */}
        <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-3 pb-3 border-b border-gray-100">
          <span><strong>Location:</strong> {municipality}</span>
          {arrestDate && (
            <span>
              <strong>Arrest date:</strong>{" "}
              {new Date(arrestDate).toLocaleDateString("en-US", {
                month: "long", day: "numeric", year: "numeric",
              })}
            </span>
          )}
          <span><strong>Source:</strong> {sourceName}</span>
        </div>

        {/* Charges snippet */}
        {charges.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded p-3 mb-3">
            <p className="text-xs font-bold uppercase text-gray-500 mb-1">Listed Charges</p>
            <ul className="text-xs list-disc list-inside space-y-0.5 text-gray-700">
              {charges.slice(0, 3).map((c, i) => <li key={i}>{c}</li>)}
              {charges.length > 3 && (
                <li className="text-gray-400">+{charges.length - 3} more…</li>
              )}
            </ul>
          </div>
        )}

        {/* Legal notice */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-2 text-xs text-yellow-900">
          An arrest or criminal charge is not a conviction. The individual is presumed
          innocent unless proven guilty in court.
        </div>
      </div>

      {/* Score summary */}
      <div className="bg-gray-50 border-t border-gray-100 px-4 py-2 flex gap-4 text-xs text-gray-500">
        <span>Safety: <strong>{headline.factual_safety_score}/10</strong></span>
        <span>Catchy: <strong>{headline.catchiness_score}/10</strong></span>
        <span>Risk:{" "}
          <strong className={
            headline.risk_level === "LOW" ? "text-green-700" :
            headline.risk_level === "MEDIUM" ? "text-yellow-700" : "text-red-600"
          }>
            {headline.risk_level}
          </strong>
        </span>
        <span>Chars: <strong>{headline.headline_text.length}</strong></span>
      </div>
    </div>
  );
}

export default function HeadlinePreviewModal({
  headlines,
  municipality,
  arrestDate,
  sourceName,
  charges,
  onClose,
}: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Modal header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-800">
              Headline Preview {headlines.length === 2 ? "— A/B Comparison" : ""}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              See how {headlines.length === 2 ? "these options" : "this headline"} would appear
              on the published story page.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl font-bold leading-none px-2"
          >
            ×
          </button>
        </div>

        {/* Preview panels */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className={`flex gap-4 ${headlines.length === 1 ? "max-w-xl mx-auto" : ""}`}>
            <StoryPreview
              headline={headlines[0]}
              municipality={municipality}
              arrestDate={arrestDate}
              sourceName={sourceName}
              charges={charges}
              label={headlines.length === 2 ? "Option A" : "Preview"}
            />
            {headlines.length === 2 && (
              <StoryPreview
                headline={headlines[1]}
                municipality={municipality}
                arrestDate={arrestDate}
                sourceName={sourceName}
                charges={charges}
                label="Option B"
              />
            )}
          </div>

          {/* Diff summary when comparing two */}
          {headlines.length === 2 && (
            <div className="mt-4 bg-gray-50 rounded-lg p-4 text-sm">
              <p className="font-semibold text-gray-700 mb-2">Side-by-side comparison</p>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-gray-500">
                    <th className="text-left py-1 pr-4 font-medium">Metric</th>
                    <th className="text-center py-1 px-4 font-medium">Option A</th>
                    <th className="text-center py-1 px-4 font-medium">Option B</th>
                    <th className="text-left py-1 pl-4 font-medium">Better</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    { label: "Type",    a: TYPE_LABELS[headlines[0].headline_type],  b: TYPE_LABELS[headlines[1].headline_type],  compare: false },
                    { label: "Safety",  a: headlines[0].factual_safety_score,         b: headlines[1].factual_safety_score,         compare: true  },
                    { label: "Catchy",  a: headlines[0].catchiness_score,             b: headlines[1].catchiness_score,             compare: true  },
                    { label: "Risk",    a: headlines[0].risk_level,                   b: headlines[1].risk_level,                   compare: false },
                    { label: "Length",  a: `${headlines[0].headline_text.length} chars`, b: `${headlines[1].headline_text.length} chars`, compare: false },
                  ].map((row) => (
                    <tr key={row.label}>
                      <td className="py-1.5 pr-4 text-gray-600 font-medium">{row.label}</td>
                      <td className="py-1.5 px-4 text-center">{String(row.a)}</td>
                      <td className="py-1.5 px-4 text-center">{String(row.b)}</td>
                      <td className="py-1.5 pl-4 text-green-700 font-medium">
                        {row.compare && typeof row.a === "number" && typeof row.b === "number"
                          ? row.a > row.b ? "A" : row.b > row.a ? "B" : "Tie"
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 text-right">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-600 border border-gray-300 px-4 py-1.5 rounded hover:bg-gray-50"
          >
            Close preview
          </button>
        </div>
      </div>
    </div>
  );
}
