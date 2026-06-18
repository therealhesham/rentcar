"use client";

import {
  Activity,
  Ban,
  BarChart2,
  BadgeDollarSign,
  Briefcase,
  Building2,
  CalendarPlus,
  Car,
  CornerDownLeft,
  CreditCard,
  ClipboardList,
  ExternalLink,
  FileText,
  Home,
  Image,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Package,
  Percent,
  Puzzle,
  Receipt,
  Repeat,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  Truck,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/app/admin/LogoutButton";
import type { AdminSession } from "@/lib/admin-auth";
import { adminBranchDisplayName } from "@/lib/admin-branch-display";
import { isAdminNavActive, type AdminNavGroup, type AdminNavItem } from "@/lib/admin-nav";

const ICONS: Record<AdminNavItem["icon"], LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  users: Users,
  "calendar-plus": CalendarPlus,
  car: Car,
  image: Image,
  megaphone: Megaphone,
  "badge-dollar": BadgeDollarSign,
  "shield-check": ShieldCheck,
  sliders: SlidersHorizontal,
  tags: Tags,
  puzzle: Puzzle,
  percent: Percent,
  "map-pin": MapPin,
  truck: Truck,
  receipt: Receipt,
  "building-2": Building2,
  package: Package,
  repeat: Repeat,
  "clipboard-list": ClipboardList,
  scale: Scale,
  briefcase: Briefcase,
  activity: Activity,
  "bar-chart-2": BarChart2,
  "external-link": ExternalLink,
  home: Home,
  "user-cog": UserCog,
  "corner-down-left": CornerDownLeft,
  ban: Ban,
  "credit-card": CreditCard,
  "file-text": FileText,
};

type Props = {
  open: boolean;
  onClose: () => void;
  session: AdminSession;
  navGroups: AdminNavGroup[];
};

export function AdminSidebar({ open, onClose, session, navGroups }: Props) {
  const pathname = usePathname() ?? "";

  return (
    <aside
      className={`print:hidden fixed inset-y-0 start-0 z-50 flex w-[min(100vw-2rem,18rem)] shrink-0 flex-col border-e border-outline-variant/20 bg-[#1c1b1b] text-[#f3f0ef] shadow-2xl transition-transform duration-300 ease-out md:static md:z-auto md:w-60 md:translate-x-0 md:shadow-none lg:w-64 ${
        open ? "translate-x-0" : "translate-x-full md:translate-x-0"
      }`}
      aria-label="قائمة الإدارة"
    >
      <div className="flex items-start justify-between gap-2 border-b border-white/10 px-4 py-5">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#e8c084]/80">
            إدارة
          </p>
          <p className="mt-1 text-lg font-extrabold tracking-tight text-white">روائس</p>
          <p className="mt-0.5 text-[11px] font-medium text-white/45">
            {session.isSuperAdmin
              ? "مدير النظام"
              : session.branchSlug
                ? adminBranchDisplayName(session)
                : "لوحة التحكم"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white md:hidden"
          aria-label="إغلاق القائمة"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <nav className="elegant-scrollbar flex flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-3 py-4">
        {navGroups.map((group) => (
          <div key={group.id}>
            <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-white/35">
              {group.label}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isAdminNavActive(pathname, item.href);
                const Icon = ICONS[item.icon];
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noopener noreferrer" : undefined}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                        active
                          ? "bg-[#e8c084] text-[#281800] shadow-[0_4px_14px_-4px_rgba(232,192,132,0.5)]"
                          : "text-white/78 hover:bg-white/8 hover:text-white"
                      }`}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon
                        className={`size-4 shrink-0 ${active ? "text-[#5d4211]" : "text-[#e8c084]/70"}`}
                        aria-hidden
                      />
                      <span className="min-w-0 truncate">{item.label}</span>
                      {item.external ? (
                        <ExternalLink
                          className="ms-auto size-3.5 shrink-0 opacity-50"
                          aria-hidden
                        />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <LogoutButton variant="sidebar" />
      </div>
    </aside>
  );
}
