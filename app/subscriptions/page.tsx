import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "@/components/home/SiteFooter";
import { SiteNav } from "@/components/shared/SiteNav";
import { prisma } from "@/lib/prisma";
import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";
import {
  MAX_SUBSCRIPTION_DURATION_MONTHS,
  MIN_SUBSCRIPTION_DURATION_MONTHS,
  parseDurationOptionsCsv,
} from "@/lib/subscriptions/duration-options";
import { subscriptionSubtotalExclVat, vatFromSubtotal } from "@/lib/subscriptions/pricing";
import { buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "باقات الاشتراك الشهري",
  description:
    "اشترك شهرياً في سيارات فاخرة من روائس — باقات مرنة، أسعار شفافة، وتوصيل من الفروع في المملكة.",
  path: "/subscriptions",
});

const PLACEHOLDER =
  "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200&q=80";

export default async function SubscriptionsLandingPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; months?: string; start?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Math.min(Number(params?.page) || 1, 999));
  const presetMonthsNum = Number(params?.months);
  const presetStartRaw =
    typeof params?.start === "string" ? params.start.trim() : "";
  const widgetPreset =
    Number.isInteger(presetMonthsNum) &&
    presetMonthsNum >= MIN_SUBSCRIPTION_DURATION_MONTHS &&
    presetMonthsNum <= MAX_SUBSCRIPTION_DURATION_MONTHS &&
    /^\d{4}-\d{2}-\d{2}$/.test(presetStartRaw)
      ? { months: presetMonthsNum, start: presetStartRaw }
      : null;
  const planLinkSuffix = widgetPreset
    ? `?months=${widgetPreset.months}&start=${encodeURIComponent(widgetPreset.start)}`
    : "";
  const listUrl = (targetPage: number) => {
    const u = new URLSearchParams();
    u.set("page", String(targetPage));
    if (widgetPreset) {
      u.set("months", String(widgetPreset.months));
      u.set("start", widgetPreset.start);
    }
    return `/subscriptions?${u.toString()}`;
  };
  const limit = 9;
  const skip = (page - 1) * limit;

  const [total, plans] = await prisma.$transaction([
    prisma.subscriptionPlan.count({ where: { isActive: true } }),
    prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      skip,
      take: limit,
      include: {
        carModel: { include: { brand: true, category: true } },
      },
    }),
  ]);

  return (
    <>
      <SiteNav active="subscriptions" />
      <div className="min-h-screen bg-[#f4f4f5] pb-20 pt-[5.75rem] sm:pt-[6.75rem]">
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6">
        {widgetPreset ? (
          <div
            className="mb-6 rounded-2xl border border-[#dbb878]/40 bg-[#fffdf8] px-4 py-3 text-center shadow-sm sm:px-6"
            role="status"
          >
            <p className="text-[13px] font-extrabold text-[#003749]">
              تم تمرير اختيارك من شريط البحث
            </p>
            <p className="mt-1 text-[12px] font-semibold text-on-surface-variant">
              مدة{" "}
              <span className="tabular-nums text-[#ea580c]" dir="ltr">
                {widgetPreset.months} أشهر
              </span>
              {" · "}
              يوم بدء الباقة:{" "}
              <span className="tabular-nums font-bold text-[#003749]" dir="ltr">
                {widgetPreset.start}
              </span>
              {" — "}
              اختر سيارة أدناه؛ ستُطبَّق القيم عند فتح صفحة الباقة.
            </p>
          </div>
        ) : null}
        <header className="py-10 text-center sm:py-14">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#775927]/90 whitespace-nowrap">
            اشتراك شهري
          </p>
          <h1 className="mt-3 text-3xl font-extrabold text-[#003749] sm:text-4xl">
            باقات السيارات شهرية مرنة
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-on-surface-variant sm:text-[15px]">
            ادفع شهرياً، اختر مدة الباقة (من {MIN_SUBSCRIPTION_DURATION_MONTHS} إلى{" "}
            {MAX_SUBSCRIPTION_DURATION_MONTHS} شهراً)، وحدّد يوم بدء الباقة فقط — تُحسب نهاية المدة
            تلقائياً، مع شفافية في البدلات والعربون.
          </p>
        </header>

        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => {
            const carLabel = `${p.carModel.brand.name} ${p.carModel.name}`.trim();
            const title = p.marketingTitleAr ?? carLabel;
            const imgSrc = (p.carModel.image?.trim() || PLACEHOLDER) as string;
            const durations = parseDurationOptionsCsv(p.durationOptionsCsv);
            const vatPct = p.carModel.vatRatePercent ?? 15;
            const lowBase = subscriptionSubtotalExclVat(
              p.monthlyPriceSar,
              Math.min(...durations),
              p.depositAmountSar,
            );
            const highBase = subscriptionSubtotalExclVat(
              p.monthlyPriceSar,
              Math.max(...durations),
              p.depositAmountSar,
            );
            const lowTotal = lowBase + vatFromSubtotal(lowBase, vatPct);
            const highTotal = highBase + vatFromSubtotal(highBase, vatPct);

            return (
              <article
                key={p.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-lg"
              >
                <Link href={`/subscriptions/${encodeURIComponent(p.slug)}${planLinkSuffix}`} className="relative block aspect-[16/10] bg-neutral-100">
                  <Image src={imgSrc} alt={p.carModel.alt?.trim() || title} fill className="object-cover" sizes="(max-width:768px) 100vw, 33vw" />
                </Link>
                <div className="flex flex-1 flex-col gap-4 p-5">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#ea580c]">
                      {p.carModel.category.title}
                    </p>
                    <h2 className="mt-1 text-lg font-extrabold leading-snug text-[#003749]">{title}</h2>
                    <p className="mt-1 text-xs leading-relaxed text-on-surface-variant line-clamp-2">
                      {p.descriptionAr ?? `اشتراك ${carLabel}: قيادة شهرية بتكلفة شهرية واحدة وفق بدلاتكم.`}
                    </p>
                  </div>

                  <ul className="space-y-1.5 border-t border-neutral-100 pt-3 text-[12px] text-on-surface">
                    <li className="flex justify-between gap-2 font-semibold">
                      <span>السعر الشهري (بدون ضريبة)</span>
                      <span dir="ltr">
                        <SarAmountWithSymbol amountClassName="font-semibold">{p.monthlyPriceSar}</SarAmountWithSymbol>
                      </span>
                    </li>
                    <li className="flex justify-between gap-2">
                      <span>بدلات شهرة</span>
                      <span dir="ltr">{p.mileageKmPerMonth.toLocaleString("ar-SA")} كم</span>
                    </li>
                    <li className="flex justify-between gap-2 text-xs">
                      <span>تأمين</span>
                      <span>{p.insuranceIncluded ? "مُضمَّن" : "حسب الوثائق"}</span>
                    </li>
                    <li className="flex justify-between gap-2 text-xs">
                      <span>صيانة دورية</span>
                      <span>{p.maintenanceIncluded ? "مُضمَّن ضمن سياسة الاشتراك" : "—"}</span>
                    </li>
                    <li className="flex justify-between gap-2 font-bold text-[#003749]">
                      <span>عربون مسترد تقريبي</span>
                      <span dir="ltr">
                        <SarAmountWithSymbol amountClassName="font-semibold">{p.depositAmountSar}</SarAmountWithSymbol>
                      </span>
                    </li>
                    <li className="flex justify-between gap-2 text-[11px] text-on-surface-variant">
                      <span>إجمالي تقريبي (ضريبي)</span>
                      <span dir="ltr" className="inline-flex flex-row flex-wrap items-baseline gap-x-1">
                        <span className="tabular-nums">{Math.min(lowTotal, highTotal).toLocaleString("ar-SA")}</span>
                        <span>–</span>
                        <SarAmountWithSymbol amountClassName="tabular-nums text-[11px]">
                          {Math.max(lowTotal, highTotal).toLocaleString("ar-SA")}
                        </SarAmountWithSymbol>
                      </span>
                    </li>
                  </ul>

                  <div className="mt-auto pt-2">
                    <Link
                      href={`/subscriptions/${encodeURIComponent(p.slug)}${planLinkSuffix}`}
                      className="inline-flex w-full items-center justify-center rounded-xl bg-[#003749] py-3 text-sm font-extrabold text-white shadow-sm transition-opacity hover:opacity-95"
                    >
                      اشترك الآن
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        {plans.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center text-sm text-on-surface-variant">
            لا توجد باقات اشتراك مفعّلة. أضف خططًا من لوحة الإدارة.
          </p>
        ) : null}

        <div className="mt-10 flex justify-center gap-3 text-xs font-bold">
          {page > 1 ? (
            <Link href={listUrl(page - 1)} className="text-[#003749] underline">
              السابق
            </Link>
          ) : null}
          <span dir="ltr" className="text-on-surface-variant">
            {skip + 1}–{Math.min(skip + limit, total)} / {total}
          </span>
          {skip + limit < total ? (
            <Link href={listUrl(page + 1)} className="text-[#003749] underline">
              التالي
            </Link>
          ) : null}
        </div>
      </div>
    </div>
      <SiteFooter />
    </>
  );
}
