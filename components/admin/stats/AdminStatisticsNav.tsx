"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: { href: string; label: string; exact?: boolean }[] = [
  { href: "/admin/statistics", label: "نظرة عامة", exact: true },
  { href: "/admin/statistics/bookings", label: "الحجوزات" },
  { href: "/admin/statistics/branches", label: "الفروع" },
  { href: "/admin/statistics/fleet", label: "الأسطول" },
  { href: "/admin/statistics/revenue", label: "الإيرادات" },
];

export function AdminStatisticsNav({ isSuperAdmin = true }: { isSuperAdmin?: boolean }) {
  const pathname = usePathname() ?? "";
  const links = isSuperAdmin ? LINKS : LINKS.filter((l) => l.href !== "/admin/statistics/fleet");

  return (
    <nav
      className="mb-8 flex flex-wrap gap-2 border-b border-outline-variant/20 pb-4"
      aria-label="أقسام الإحصائيات"
    >
      {links.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              active
                ? "bg-primary text-on-primary shadow-[0_4px_14px_-4px_rgba(119,89,39,0.45)]"
                : "bg-white text-on-surface-variant ring-1 ring-outline-variant/25 hover:bg-primary-container/30 hover:text-on-surface"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
