import Image from "next/image";
import { DAILY_PRICE_EXCL_TAX_AR } from "@/lib/pricing";

const cars = [
  {
    name: "Mercedes-Benz S-Class",
    category: "أداء فاخر",
    price: "1,200",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAbr7a24gd76E0ksdjTkKIo6Y8HyhXHNvxYM_14kOQ8oGBVwNPNVL2SzOynMcW4blmaC-M0EcBhFcv4CgBcpToXBkBWOBNvnsKpBd_n0DdoZM7_QeE4LRljkXlLSjZIjQYfS41dWS5t7LiHegojRVvKXgDhtCmak209Jx9mtAFGm1G38zLaLIJ7PJgLwr3iBtviCrQ8UF-Ffk647aBt8-Llmdml8hfUbUYRYRdwTdd5ObGe9In0nFlGWlhwzHCLqFAOs3WxrIiFZUrK",
    alt: "مرسيدس بنز الفئة S أمام مبنى عصري",
    cta: "outline" as const,
    badge: null as string | null,
  },
  {
    name: "Range Rover Vogue",
    category: "دفع رباعي راقٍ",
    price: "1,800",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBIAJVOknhP009l0AjiNcGTXE-Oi5i5_k7J5c5bpFZ2zUL_alj7q2yRCxRFux-3qmKgumCc0aQtJq2wplbIwk7Wm69Lzv7WhNF2SI1tbh_8NO-mx_8S9Eb0OTakc2WSGWokw4P54FPzoQPkI1hlW25hh01HSN0GfGuw-QNsRbUuQkwwFaQA7BzIwaXUX5ZiApMUWLO-licDqdna0ImZrcoPfAXS8WUWs--3n7wmJ9SJhDvkPenb7XyKgmorCXe7H5ddzDO3MyAbl0j2",
    alt: "رنج روفر فوغ بيضاء على ممر فاخر",
    cta: "primary" as const,
    badge: "متاح الآن",
  },
  {
    name: "Audi R8 Spyder",
    category: "رياضية فائقة",
    price: "2,500",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuC40LVvzIpEA9trr94Lo9PKnh3xvRcTFe0qo9Z-9lFf4yZki1Azk5oP8zqIXJRr0yWXGw27dweS5k9-XkxfqYcb3NAl7yH27OR1Ksg1yIeaLAmio8ndCmzg_xa-8XwT85d8xgYe9ZIObHEwoCvk3il4MdD0C-dGeAPoVVmw43kDHIqSr7VrdjcJBn_GV7of9PxNipu4AmHloLXaKSDa2s_XKK3kGN7mVnwjkxfyNDHPwMYCK8G954auWs0ranR0yktyWiast_GfTyMs",
    alt: "أودي R8 سبايدر على طريق مفتوح",
    cta: "outline" as const,
    badge: null as string | null,
  },
] as const;

export function FleetShowcase() {
  return (
    <section id="fleet" className="bg-background py-32">
      <div className="mx-auto max-w-7xl px-8">
        <div className="mb-20 text-center">
          <h2 className="mb-4 text-[2.5rem] font-extrabold tracking-tight">
            أسطول مختار بعناية
          </h2>
          <div className="mx-auto h-1 w-12 rounded-full bg-primary" />
        </div>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
          {cars.map((car) => (
            <div key={car.name} className="group">
              <div className="relative mb-6 aspect-[4/3] overflow-hidden rounded-xl bg-surface-container-low">
                {car.badge ? (
                  <div className="absolute start-4 top-4 z-10 rounded-full bg-primary-fixed px-3 py-1 text-[10px] font-bold tracking-wide text-on-primary-fixed">
                    {car.badge}
                  </div>
                ) : null}
                <Image
                  src={car.image}
                  alt={car.alt}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(min-width: 1024px) 33vw, 100vw"
                />
              </div>
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 text-start">
                  <h3 className="mb-1 text-xl font-bold">{car.name}</h3>
                  <p className="text-sm text-on-surface-variant">{car.category}</p>
                </div>
                <div className="shrink-0 text-end">
                  <span
                    className="block text-xl font-extrabold text-primary"
                    dir="ltr"
                  >
                    {car.price} ر.س
                  </span>
                  <span className="text-[10px] font-bold tracking-wide text-on-surface-variant">
                    في اليوم
                  </span>
                  <span className="mt-1 block max-w-[7rem] text-end text-[9px] leading-snug text-on-surface-variant/90">
                    {DAILY_PRICE_EXCL_TAX_AR}
                  </span>
                </div>
              </div>
              {car.cta === "outline" ? (
                <button
                  type="button"
                  className="w-full rounded-xl border border-outline-variant py-4 text-xs font-bold tracking-wide text-primary transition-colors hover:bg-primary-container/10"
                >
                  عرض التفاصيل
                </button>
              ) : (
                <button
                  type="button"
                  className="golden-gradient w-full rounded-xl py-4 text-xs font-bold tracking-wide text-white shadow-lg transition-all hover:opacity-90"
                >
                  احجز الآن
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
