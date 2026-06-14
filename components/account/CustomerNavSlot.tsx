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

export function CustomerNavSlot({ variant = "light" }: { variant?: "light" | "dark" }) {
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
        className={`h-10 w-10 shrink-0 animate-pulse rounded-full sm:h-11 sm:w-11 ${
          variant === "dark" ? "bg-white/10" : "bg-[#163332]/10"
        }`}
        aria-hidden
      />
    );
  }

  if (me) {
    const displayName = me.name?.trim() || me.email.split("@")[0] || "";
    const initials = getInitials(displayName);

    if (variant === "dark") {
      return (
        <Link
          href="/account"
          title={me.name?.trim() || me.email}
          aria-label={`حساب ${displayName}`}
          className="flex w-full items-center gap-3 rounded-2xl bg-white/5 p-3 transition-colors hover:bg-white/10 active:bg-white/15 border border-white/10"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#dbb878] to-[#c9a356] text-sm font-extrabold text-white shadow-sm ring-2 ring-[#dbb878]/30">
            <span dir="ltr" className="select-none uppercase tracking-tight drop-shadow-sm">
              {initials}
            </span>
          </div>
          <div className="flex flex-col flex-1 overflow-hidden">
            <span className="truncate text-sm font-bold text-white" dir="auto">{displayName}</span>
            <span className="truncate text-xs text-white/50" dir="auto">{me.email}</span>
          </div>
        </Link>
      );
    }

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

  if (variant === "dark") {
    return (
      <div className="flex w-full flex-col gap-2.5">
        <Link
          href="/account/login"
          className="flex w-full items-center justify-center rounded-xl bg-[#dbb878] px-4 py-3 text-sm font-bold text-[#2a2520] shadow-[0_4px_16px_rgba(219,184,120,0.2)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          Login
        </Link>
        <Link
          href="/account/register"
          className="flex w-full items-center justify-center rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10 active:bg-white/15"
        >
          Register
        </Link>
      </div>
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
