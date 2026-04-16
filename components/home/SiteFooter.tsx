"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z" />
    </svg>
  );
}

const siteLinks = [
  { href: "/", label: "الرئيسية" },
  { href: "/fleet", label: "الاسطول" },
  { href: "#about", label: "نبذة عنا" },
  { href: "#", label: "السياسة والخصوصية" },
  { href: "#", label: "الشروط والأحكام" },
];

const socialLinks = [
  { href: "#", label: "انستقرام", icon: InstagramIcon },
  { href: "#", label: "اكس", icon: XIcon },
  { href: "#", label: "تيك توك", icon: TikTokIcon },
];

/** خلفية تيل داكنة + شريط ذهبي سفلي (معايير فوتر الموقع) */
const FOOTER_BG = "#003749";
const FOOTER_ACCENT = "#d4b896";
const FOOTER_GOLD = "#dbb878";

function isLinkActive(pathname: string, href: string) {
  if (href === "#" || href.startsWith("#")) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteFooter() {
  const pathname = usePathname();

  return (
    <footer className="w-full text-white" style={{ backgroundColor: FOOTER_BG }}>
      <div className="mx-auto grid max-w-screen-xl grid-cols-1 gap-10 px-8 py-14 md:grid-cols-3">
        <div className="flex items-center gap-4 md:justify-self-start">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white p-2 shadow-sm">
            <Image
              src="/logo.svg"
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 object-contain"
            />
          </div>
          <div>
            <p className="text-lg font-bold leading-tight text-white">
              روائس لتأجير السيارات
            </p>
            <p className="text-sm text-white/80">Rawaes Rent Car</p>
          </div>
        </div>

        <div>
          <h4 className="mb-4 text-sm font-bold text-white">خريطة الموقع</h4>
          <ul className="space-y-2">
            {siteLinks.map((link) => {
              const active = isLinkActive(pathname, link.href);
              return (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className={`text-sm transition-colors ${
                      active
                        ? "font-bold"
                        : "text-white hover:opacity-90"
                    }`}
                    style={
                      active
                        ? { color: FOOTER_GOLD }
                        : undefined
                    }
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <h4 className="mb-4 text-sm font-bold text-white">
            وسائل التواصل الاجتماعي
          </h4>
          <div className="mb-6 inline-flex items-center gap-5 rounded-full bg-white px-5 py-2.5 shadow-sm">
            {socialLinks.map((s) => (
              <a
                key={s.label}
                href={s.href}
                aria-label={s.label}
                className="text-neutral-900 transition-opacity hover:opacity-60"
              >
                <s.icon className="h-5 w-5" />
              </a>
            ))}
          </div>
          <p className="text-sm text-white/90">
            الفرع الرئيسي: المدينة المنورة
          </p>
        </div>
      </div>

      <div
        className="w-full py-4 text-center text-xs font-medium text-white"
        style={{ backgroundColor: FOOTER_ACCENT }}
      >
        جميع الحقوق محفوظة لدى روائس لتأجير السيارات
      </div>
    </footer>
  );
}
