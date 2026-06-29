"use client";

import { Link } from "@/i18n/routing";
import { useCallback, useEffect, useState } from "react";
import { CustomerNavSlot } from "@/components/account/CustomerNavSlot";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useTranslations } from "next-intl";

type NavKey = "home" | "fleet" | "subscriptions" | "about" | "contact";

type SiteNavProps = {
  active?: NavKey;
};

/** Car icon — inline SVG so no extra dependency */
function CarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M18.92 6.01A1 1 0 0 0 18 5.5H6a1 1 0 0 0-.92.61l-2 5A1 1 0 0 0 3 12v4a1 1 0 0 0 1 1h1a2 2 0 0 0 4 0h6a2 2 0 0 0 4 0h1a1 1 0 0 0 1-1v-4a1 1 0 0 0-.08-.39l-2-5.6ZM6.85 7.5h10.3l1.43 4H5.42l1.43-4ZM7 17a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm10 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
    </svg>
  );
}

export function SiteNav({ active = "home" }: SiteNavProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("SiteNav");

  const links: { href: string; key: NavKey; label: string }[] = [
    { href: "/", key: "home", label: t("home") },
    { href: "/fleet", key: "fleet", label: t("fleet") },
    { href: "/about", key: "about", label: t("about") },
    { href: "#contact", key: "contact", label: t("contact") },
  ];

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
      {/* ─── Desktop bar ─── */}
      <div className="w-full border-b border-[#e5e2dc] bg-[#fcf9f8]/95 backdrop-blur-xl">
        <div className="relative mx-auto flex h-[4.5rem] w-full max-w-screen-xl items-center justify-between px-6 sm:h-24 sm:px-8">

          {/* LEFT — brand logo */}
          <Link
            href="/"
            aria-label="الصفحة الرئيسية"
            className="relative z-10 flex items-center gap-2.5 text-[#003749] transition-opacity hover:opacity-80"
          >
            <CarIcon className="h-7 w-7 shrink-0 text-[#003749]" />
            <span className="whitespace-nowrap text-[17px] font-extrabold leading-none tracking-tight text-[#003749]">
              روائس لتأجير السيارات
            </span>
          </Link>

          {/* CENTER — pill nav (desktop only) */}
          <div className="absolute left-1/2 -translate-x-1/2 hidden items-center gap-0.5 rounded-full bg-[#dbb878]/20 p-1.5 shadow-[0_2px_16px_rgba(119,89,39,0.10)] md:flex">
            {links.map((l) => {
              const isActive = active === l.key;
              return (
                <Link
                  key={l.key}
                  href={l.href}
                  className={`whitespace-nowrap rounded-full px-5 py-2 text-[13.5px] font-bold transition-all duration-200 ${
                    isActive
                      ? "bg-[#003749] text-white shadow-[0_4px_14px_rgba(0,55,73,0.35)]"
                      : "text-[#4e453a] hover:bg-[#003749]/8 hover:text-[#003749]"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>

          {/* RIGHT — language + auth (desktop) + hamburger (mobile) */}
          <div className="relative z-10 flex shrink-0 items-center gap-2">
            {/* Desktop controls */}
            <div className="hidden items-center gap-3 md:flex">
              <LanguageSwitcher variant="light" />

              {/* Thin divider */}
              <div className="h-5 w-px bg-[#c0b8ae]" aria-hidden />

              <CustomerNavSlot variant="light" />
            </div>

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="site-mobile-menu"
              aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#dbb878]/40 bg-[#dbb878]/15 text-[#003749] transition-all active:scale-90 md:hidden"
            >
              {open ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="h-5 w-5" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="h-5 w-5" aria-hidden>
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ─── Mobile drawer ─── */}
      <div className="md:hidden" aria-hidden={!open}>
        {/* Backdrop */}
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          aria-label="إغلاق القائمة"
          onClick={closeMenu}
          className={`fixed inset-0 z-40 bg-[#003749]/40 backdrop-blur-[2px] transition-opacity duration-300 ${
            open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
        />

        <aside
          id="site-mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="قائمة التنقل"
          className={`fixed inset-y-0 left-0 z-50 flex w-[min(100vw-2.5rem,18rem)] flex-col border-e border-white/10 bg-[#003749] shadow-[4px_0_40px_rgba(0,0,0,0.35)] transition-transform duration-300 ease-out ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Drawer header */}
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
            <Link
              href="/"
              onClick={closeMenu}
              aria-label="الصفحة الرئيسية"
              className="flex items-center gap-2 text-white"
            >
              <CarIcon className="h-6 w-6 shrink-0" />
              <span className="text-sm font-extrabold tracking-tight">روائس لتأجير السيارات</span>
            </Link>
            <button
              type="button"
              onClick={closeMenu}
              aria-label="إغلاق القائمة"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="h-5 w-5" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          {/* Drawer links */}
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
                      ? "bg-[#dbb878] text-[#1a1408] shadow-[0_4px_16px_rgba(219,184,120,0.35)]"
                      : "text-white hover:bg-white/10 active:bg-white/15"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>

          {/* Drawer footer — language + auth */}
          <div className="flex flex-col gap-4 border-t border-white/10 px-4 py-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white/70">{t("language") || "اللغة"}</span>
              <LanguageSwitcher variant="dark" />
            </div>
            <div className="w-full">
              <CustomerNavSlot variant="dark" />
            </div>
          </div>

          <div className="border-t border-white/10 px-4 py-4">
            <p className="text-center text-xs font-medium text-white/50">روائس لتأجير السيارات</p>
          </div>
        </aside>
      </div>
    </nav>
  );
}
