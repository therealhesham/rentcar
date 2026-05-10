"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { CustomerNavSlot } from "@/components/account/CustomerNavSlot";

type NavKey = "home" | "fleet" | "about" | "contact";

const links: { href: string; key: NavKey; label: string }[] = [
  { href: "/", key: "home", label: "الرئيسية" },
  { href: "/fleet", key: "fleet", label: "الاسطول" },
  { href: "/about", key: "about", label: "نبذة عنا" },
  { href: "#contact", key: "contact", label: "تواصل معنا" },
];

type SiteNavProps = {
  active?: NavKey;
};

export function SiteNav({ active = "home" }: SiteNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed left-0 right-0 top-0 z-50">
      <div className="w-full border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto relative flex h-16 w-full max-w-screen-xl items-center justify-between px-4 sm:h-24 sm:px-6">
          <Link href="/" aria-label="الصفحة الرئيسية" className="relative z-10">
            <Image
              src="/logo.avif"
              alt="Rawaes"
              width={176}
              height={58}
              className="h-12 w-auto object-contain sm:h-14"
              priority
            />
          </Link>

          <div className="hidden items-center gap-1 rounded-full bg-[#dbb878] p-1.5 shadow-[0_8px_32px_rgba(119,89,39,0.15)] sm:absolute sm:left-1/2 sm:-translate-x-1/2 sm:flex">
            {links.map((l) => {
              const isActive = active === l.key;
              return (
                <Link
                  key={l.key}
                  href={l.href}
                  className={`rounded-full px-5 py-2.5 text-sm font-bold transition-all duration-300 lg:px-7 ${
                    isActive
                      ? "bg-[#163332] text-white shadow-sm"
                      : "text-[#2a2520] hover:bg-[#163332]/10"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>

          <div className="relative z-10 flex shrink-0 items-center gap-2">
            <CustomerNavSlot />
            <button
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#dbb878] text-[#2a2520] shadow-[0_8px_32px_rgba(119,89,39,0.15)] transition-colors active:bg-[#c9a55e] sm:hidden"
            >
              {open ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  className="h-5 w-5"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  className="h-5 w-5"
                >
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="absolute left-3 right-3 top-[72px] overflow-hidden rounded-2xl bg-[#dbb878] shadow-[0_12px_40px_rgba(119,89,39,0.25)] sm:hidden">
          {links.map((l) => {
            const isActive = active === l.key;
            return (
              <Link
                key={l.key}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`block px-5 py-3.5 text-sm font-bold transition-colors ${
                  isActive
                    ? "bg-[#163332] text-white"
                    : "text-[#2a2520] hover:bg-[#163332]/10"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
