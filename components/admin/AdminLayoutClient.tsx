"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { NotificationBell } from "@/components/admin/NotificationBell";
import type { AdminSession } from "@/lib/admin-auth";
import { adminScope, scopeLabel } from "@/lib/admin-scope-core";
import type { AdminNavGroup } from "@/lib/admin-nav";

type Props = {
  children: React.ReactNode;
  session: AdminSession;
  navGroups: AdminNavGroup[];
};

export function AdminLayoutClient({ children, session, navGroups }: Props) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#f4f1ee] text-on-surface print:bg-white">
      {navOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-[#1c1b1b]/45 backdrop-blur-[2px] md:hidden"
          aria-label="إغلاق القائمة"
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      <AdminSidebar
        open={navOpen}
        onClose={() => setNavOpen(false)}
        session={session}
        navGroups={navGroups}
      />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-outline-variant/25 bg-white/90 px-4 py-3 backdrop-blur-md md:hidden print:hidden">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className="flex size-10 items-center justify-center rounded-xl border border-outline-variant/30 bg-surface-container-lowest text-on-surface transition-colors hover:bg-surface-container-low"
            aria-label="فتح القائمة"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              لوحة الإدارة
            </p>
            <p className="truncate text-base font-extrabold tracking-tight text-[#003749]">روائس</p>
            {session.isSuperAdmin ? null : (
              <p className="truncate text-[11px] font-medium text-on-surface-variant">
                {scopeLabel(adminScope(session))}
              </p>
            )}
          </div>
          <div className="flex items-center">
            <NotificationBell />
          </div>
        </header>

        <div className="hidden md:flex justify-end px-8 pt-6 w-full max-w-7xl mx-auto print:hidden">
          <NotificationBell />
        </div>

        <main className="flex-1 px-4 py-6 sm:px-6 md:px-8 md:py-10 print:p-0 print:m-0">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
