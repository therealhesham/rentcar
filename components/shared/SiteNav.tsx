"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CustomerNavSlot } from "@/components/account/CustomerNavSlot";

type NavKey = "home" | "fleet" | "subscriptions" | "about" | "contact";

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

  const closeMenu = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closeMenu]);

  return (
    <nav className="fixed left-0 right-0 top-0 z-50">
      <div className="w-full border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="relative mx-auto flex h-16 w-full max-w-screen-xl items-center justify-between px-4 sm:h-24 sm:px-6">
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

          <div className="hidden items-center gap-1 rounded-full bg-[#dbb878] p-1.5 shadow-[0_8px_32px_rgba(119,89,39,0.15)] md:absolute md:left-1/2 md:-translate-x-1/2 md:flex">
            {links.map((l) => {
              const isActive = active === l.key;
              return (
                <Link
                  key={l.key}
                  href={l.href}
                  className={`whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-bold transition-all duration-300 lg:px-7 ${
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
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="site-mobile-menu"
              aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#dbb878] text-[#2a2520] shadow-[0_8px_32px_rgba(119,89,39,0.15)] transition-colors active:bg-[#c9a55e] md:hidden"
            >
              {open ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  className="h-5 w-5"
                  aria-hidden
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
                  aria-hidden
                >
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile drawer — slides in from the left */}
      <div className="md:hidden" aria-hidden={!open}>
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          aria-label="إغلاق القائمة"
          onClick={closeMenu}
          className={`fixed inset-0 z-40 bg-[#163332]/40 backdrop-blur-[2px] transition-opacity duration-300 ${
            open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
        />

        <aside
          id="site-mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="قائمة التنقل"
          className={`fixed inset-y-0 left-0 z-50 flex w-[min(100vw-2.5rem,18rem)] flex-col border-e border-[#c9a55e]/30 bg-[#dbb878] shadow-[4px_0_40px_rgba(22,51,50,0.2)] transition-transform duration-300 ease-out ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between gap-3 border-b border-[#163332]/10 px-4 py-4">
            <Link href="/" onClick={closeMenu} aria-label="الصفحة الرئيسية">
              <Image
                src="/logo.avif"
                alt="Rawaes"
                width={140}
                height={46}
                className="h-10 w-auto object-contain"
              />
            </Link>
            <button
              type="button"
              onClick={closeMenu}
              aria-label="إغلاق القائمة"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#163332]/10 text-[#163332] transition-colors hover:bg-[#163332]/20 active:bg-[#163332]/25"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                className="h-5 w-5"
                aria-hidden
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
            {links.map((l) => {
              const isActive = active === l.key;
              return (
                <Link
                  key={l.key}
                  href={l.href}
                  onClick={closeMenu}
                  className={`rounded-xl px-4 py-3.5 text-base font-bold transition-colors ${
                    isActive
                      ? "bg-[#163332] text-white shadow-sm"
                      : "text-[#2a2520] hover:bg-[#163332]/10 active:bg-[#163332]/15"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-[#163332]/10 px-4 py-4">
            <p className="text-center text-xs font-medium text-[#2a2520]/60">
              روائس لتأجير السيارات
            </p>
          </div>
        </aside>
      </div>
    </nav>
  );
}
