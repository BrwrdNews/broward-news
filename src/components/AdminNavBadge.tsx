"use client";

/**
 * Polls /api/admin/notifications every 60 s and shows a red badge count
 * on the "Headlines" nav link when there are PENDING headline options.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminNavBadge() {
  const [count, setCount] = useState(0);

  async function refresh() {
    try {
      const res = await fetch("/api/admin/notifications", { cache: "no-store" });
      if (res.ok) {
        const j = await res.json();
        setCount(j.badge_count ?? 0);
      }
    } catch {
      // non-fatal
    }
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Link
      href="/admin/headlines"
      className="relative text-sm hover:text-brand-red transition-colors flex items-center gap-1.5"
    >
      Headlines
      {count > 0 && (
        <span className="inline-flex items-center justify-center bg-brand-red text-white text-xs font-bold rounded-full h-4 min-w-[1rem] px-1 leading-none">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
