"use client";

import Image from "next/image";
import { Link } from "@/i18n/routing";
import { useCallback, useEffect, useState } from "react";
import { CustomerNavSlot } from "@/components/account/CustomerNavSlot";
import { useSiteBranding } from "@/components/shared/SiteBrandingProvider";
import { navLogoUrl } from "@/lib/site-branding";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLocale, useTranslations } from "next-intl";

type NavKey = "home" | "fleet" | "subscriptions" | "about" | "contact";

// links are now defined inside the component to use translations

type SiteNavProps = {
  active?: NavKey;
};

export function SiteNav({ active = "home" }: SiteNavProps) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const t = useTranslations("SiteNav");
  const locale = useLocale();
  const logoSrc = navLogoUrl(useSiteBranding(), locale);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links: { href: string; key: NavKey; label: string }[] = [
    { href: "/", key: "home", label: t("home") },
    { href: "/fleet", key: "fleet", label: t("fleet") },
    { href: "/about", key: "about", label: t("about") },
    { href: "/contact", key: "contact", label: t("contact") },
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
      <div
        className={`w-full border-b bg-white/95 backdrop-blur transition-[box-shadow,border-color] duration-300 ${
          scrolled
            ? "border-transparent shadow-[0_8px_30px_-12px_rgba(0,55,73,0.22)]"
            : "border-neutral-200 shadow-none"
        }`}
      >
        <div className="relative mx-auto flex h-16 w-full max-w-screen-xl items-center justify-between px-4 sm:h-24 sm:px-6">
          <Link href="/" aria-label="الصفحة الرئيسية" className="relative z-10">
            <Image
              src={logoSrc}
              alt="Rawaes"
              width={176}
              height={58}
              className="h-12 w-auto object-contain sm:h-14"
              priority
              unoptimized={logoSrc.endsWith(".svg") || logoSrc.startsWith("http")}
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
                      ? "bg-[#003749] text-white shadow-sm"
                      : "text-[#2a2520] hover:bg-[#003749]/10"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>

          <div className="relative z-10 flex shrink-0 items-center gap-2">
            <div className="hidden items-center gap-2 md:flex">
              <LanguageSwitcher variant="light" />
              <CustomerNavSlot variant="light" />
            </div>
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
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
            <Link href="/" onClick={closeMenu} aria-label="الصفحة الرئيسية">
              <Image
                src={logoSrc}
                alt="Rawaes"
                width={140}
                height={46}
                className="h-10 w-auto object-contain brightness-0 invert"
                unoptimized={logoSrc.endsWith(".svg") || logoSrc.startsWith("http")}
              />
            </Link>
            <button
              type="button"
              onClick={closeMenu}
              aria-label="إغلاق القائمة"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 active:bg-white/25"
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
                      ? "bg-[#dbb878] text-[#2a2520] shadow-[0_4px_16px_rgba(219,184,120,0.35)]"
                      : "text-white hover:bg-white/10 active:bg-white/15"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>

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
            <p className="text-center text-xs font-medium text-white/50">
              روائس لتأجير السيارات
            </p>
          </div>
        </aside>
      </div>
    </nav>
  );
}
