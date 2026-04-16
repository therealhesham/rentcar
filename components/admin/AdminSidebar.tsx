"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/app/admin/LogoutButton";

const nav = [
  { href: "/admin", label: "لوحة التحكم" },
  { href: "/admin/customers", label: "العملاء" },
  { href: "/admin/direct-booking", label: "حجز مباشر (مكتب)" },
  { href: "/admin/home", label: "هيرو الرئيسية" },
  { href: "/admin/vehicles", label: "إضافة مركبة" },
  { href: "/admin/categories", label: "فئات الأسطول" },
  { href: "/admin/car-bookings", label: "حجوزات السيارات" },
  { href: "/admin/fleet-availability", label: "توفر المركبات" },
  { href: "/fleet", label: "عرض الأسطول" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar() {
  const pathname = usePathname() ?? "";

  return (
    <aside className="flex w-full shrink-0 flex-col border-e border-outline-variant/30 bg-surface-container-low/80 md:w-56 lg:w-64">
      <div className="border-b border-outline-variant/30 px-4 py-5">
        <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
          إدارة
        </p>
        <p className="mt-1 text-lg font-extrabold tracking-tight">Rawaes</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {nav.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                active
                  ? "bg-primary-container text-on-primary-container"
                  : "text-on-surface hover:bg-surface-container"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        <Link
          href="/"
          className="rounded-xl px-3 py-2.5 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container"
        >
          الموقع العام
        </Link>
      </nav>
      <div className="border-t border-outline-variant/30 p-3">
        <LogoutButton />
      </div>
    </aside>
  );
}
