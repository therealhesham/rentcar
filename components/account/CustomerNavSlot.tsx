"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type MeUser = { email: string; name: string | null };

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
        className="h-9 w-16 shrink-0 animate-pulse rounded-full bg-[#163332]/10"
        aria-hidden
      />
    );
  }

  if (me) {
    const label = me.name?.trim() || me.email.split("@")[0];
    return (
      <Link
        href="/account"
        className="max-w-[120px] truncate rounded-full border border-[#163332]/25 bg-white/90 px-3 py-2 text-center text-[11px] font-extrabold text-[#163332] shadow-sm backdrop-blur-sm hover:bg-[#163332]/10 sm:max-w-[160px] sm:px-4 sm:text-xs"
        title={me.email}
      >
        {label}
      </Link>
    );
  }

  return (
    <Link
      href="/account/login"
      className="shrink-0 rounded-full bg-[#163332] px-3 py-2 text-[11px] font-extrabold text-white shadow-sm hover:opacity-95 sm:px-4 sm:text-xs"
    >
      دخول
    </Link>
  );
}
