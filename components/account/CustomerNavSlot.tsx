"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type MeUser = { email: string; name: string | null };

/**
 * Extract two letters to use as an avatar fallback.
 * - If the source has 2+ whitespace-separated parts (e.g. "Ahmed Mohamed"),
 *   take the first letter of each part → "AM".
 * - Otherwise take the first two characters of the trimmed source.
 */
function getInitials(source: string): string {
  const cleaned = source.trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

export function CustomerNavSlot() {
  const [me, setMe] = useState<MeUser | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/account/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { user?: MeUser | null }) => {
        if (!cancelled) setMe(d.user ?? null);
      })
      .catch(() => {
        if (!cancelled) setMe(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (me === undefined) {
    return (
      <span
        className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-[#163332]/10 sm:h-11 sm:w-11"
        aria-hidden
      />
    );
  }

  if (me) {
    const displayName = me.name?.trim() || me.email.split("@")[0] || "";
    const initials = getInitials(displayName);
    return (
      <Link
        href="/account"
        title={me.name?.trim() || me.email}
        aria-label={`حساب ${displayName}`}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#dbb878] to-[#c9a356] text-[12.5px] font-extrabold text-white shadow-[0_4px_14px_-4px_rgba(219,184,120,0.45)] outline-none ring-1 ring-[#dbb878]/35 transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-[#163332]/45 sm:h-11 sm:w-11 sm:text-[13px]"
      >
        <span
          dir="ltr"
          className="select-none uppercase tracking-tight drop-shadow-sm"
        >
          {initials}
        </span>
      </Link>
    );
  }

  return (
    <div
      role="group"
      aria-label="حساب المستخدم"
      dir="ltr"
      className="flex shrink-0 items-center gap-1.5 text-[11px] font-extrabold sm:text-xs"
    >
      <Link
        href="/account/login"
        className="rounded-full bg-[#163332] px-3 py-2 text-white shadow-sm outline-none transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-[#dbb878]/45 sm:px-4"
      >
        Login
      </Link>
      <span className="h-4 w-px bg-[#163332]/25" aria-hidden />
      <Link
        href="/account/register"
        className="rounded-full border border-[#163332]/25 bg-white/90 px-3 py-2 text-[#163332] shadow-sm outline-none transition-colors hover:bg-[#163332]/5 focus-visible:ring-2 focus-visible:ring-[#dbb878]/45 sm:px-4"
      >
        Register
      </Link>
    </div>
  );
}
