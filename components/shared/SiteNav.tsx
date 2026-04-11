import Link from "next/link";

type NavKey = "home" | "fleet" | "about" | "contact";

const links: { href: string; key: NavKey; label: string }[] = [
  { href: "/", key: "home", label: "الرئيسية" },
  { href: "/fleet", key: "fleet", label: "الاسطول" },
  { href: "#about", key: "about", label: "نبذه عنا" },
  { href: "#contact", key: "contact", label: "تواصل معنا" },
];

type SiteNavProps = {
  active?: NavKey;
};

export function SiteNav({ active = "home" }: SiteNavProps) {
  return (
    <nav className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4">
      <div className="flex items-center gap-1 rounded-full bg-[#dbb878] p-1.5 shadow-[0_8px_32px_rgba(119,89,39,0.15)]">
        {links.map((l) => {
          const isActive = active === l.key;
          return (
            <Link
              key={l.key}
              href={l.href}
              className={`rounded-full px-7 py-2.5 text-sm font-bold transition-all duration-300 ${
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
    </nav>
  );
}
