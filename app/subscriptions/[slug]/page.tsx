import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/home/SiteFooter";
import { SiteNav } from "@/components/shared/SiteNav";
import type { SubscribeFormPlan } from "@/components/subscriptions/SubscribeForm";
import { SubscribeForm } from "@/components/subscriptions/SubscribeForm";
import { prisma } from "@/lib/prisma";
import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";

export const dynamic = "force-dynamic";

const IMG_FALLBACK =
  "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200&q=80";

type Params = Promise<{ slug: string }>;

export async function generateMetadata(ctx: { params: Params }): Promise<Metadata> {
  const { slug } = await ctx.params;
  const plan = await prisma.subscriptionPlan.findFirst({
    where: { slug: slug.trim().toLowerCase(), isActive: true },
    include: { carModel: { include: { brand: true } } },
  });
  if (!plan) return { title: "باقات الاشتراك" };
  const title = plan.marketingTitleAr ?? `${plan.carModel.brand.name} ${plan.carModel.name}`;
  return {
    title: `${title} | اشتراك شهري`,
    description:
      plan.descriptionAr?.slice(0, 160) ??
      `اشترك شهرياً في ${plan.carModel.brand.name} ${plan.carModel.name}`,
  };
}

export default async function SubscriptionPlanDetailPage(ctx: {
  params: Params;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await ctx.params;
  const q = ctx.searchParams ? await ctx.searchParams : {};
  const monthsRaw = Array.isArray(q.months) ? q.months[0] : q.months;
  const startRaw = Array.isArray(q.start) ? q.start[0] : q.start;
  const pm = Number(monthsRaw);
  const initialDurationMonths = [1, 3, 6].includes(pm) ? pm : undefined;
  const initialStartDateYmd =
    typeof startRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(startRaw.trim())
      ? startRaw.trim()
      : undefined;
  const s = slug.trim().toLowerCase();
  const plan = await prisma.subscriptionPlan.findFirst({
    where: { slug: s, isActive: true },
    include: {
      carModel: { include: { brand: true, category: true } },
    },
  });

  if (!plan) notFound();

  const dto: SubscribeFormPlan = {
    slug: plan.slug,
    durationOptionsCsv: plan.durationOptionsCsv,
  };

  const carLabel = `${plan.carModel.brand.name} ${plan.carModel.name}`.trim();
  const heroImage = plan.carModel.image?.trim() || IMG_FALLBACK;

  return (
    <div className="min-h-screen bg-[#f4f4f5] text-on-surface">
      <SiteNav active="subscriptions" />
      <main className="mx-auto max-w-screen-xl px-4 pb-20 pt-[5.75rem] sm:px-6 sm:pt-[7rem] lg:pb-28">
        <nav className="mb-8 text-[12px] font-bold text-on-surface-variant">
          <Link href="/subscriptions" className="text-[#003749] hover:underline">
            باقات الاشتراك
          </Link>
          <span className="mx-2 opacity-50">/</span>
          <span className="font-extrabold text-[#003749]">{carLabel}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[1.1fr_minmax(280px,0.95fr)]">
          <article className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-xl">
            <div className="relative aspect-video bg-neutral-100">
              <Image
                src={heroImage}
                alt={plan.carModel.alt ?? carLabel}
                fill
                className="object-cover"
                priority
              />
              <span className="absolute start-5 top-5 rounded-full bg-black/65 px-3 py-1 text-[11px] font-black text-[#fde68a]">
                تقارن أفضل الأسعار
              </span>
            </div>
            <div className="space-y-4 p-6 sm:p-8">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#775927]/90">
                {plan.carModel.category.title}
              </p>
              <h1 className="text-3xl font-extrabold text-[#003749]">
                {plan.marketingTitleAr ?? carLabel}
              </h1>
              <p className="text-sm leading-relaxed text-on-surface-variant">
                {plan.descriptionAr ??
                  `اشترك في ${carLabel}: كيلومترات شهرية حقيقية، عربون واضح، وضريبة تُحسب وفق الأسعار الحالية.`}
              </p>

              <section aria-labelledby="compare-id" className="rounded-2xl border border-[#dbb878]/28 bg-[#fdfbf8] px-5 py-4">
                <h2 id="compare-id" className="text-sm font-extrabold text-[#003749]">
                  مقارنة سريعة
                </h2>
                <ul className="mt-3 grid gap-2 text-[13px] sm:grid-cols-2">
                  <li className="font-semibold">
                    تأمين:{" "}
                    <span className="text-emerald-800">
                      {plan.insuranceIncluded ? "مُضمَّن" : "بحسب الوثائق"}
                    </span>
                  </li>
                  <li className="font-semibold">
                    صيانة:{" "}
                    <span>{plan.maintenanceIncluded ? "مندرجة في الباقة" : "بحسب الشركة"}</span>
                  </li>
                  <li className="font-semibold">
                    بدلات شهرية{" "}
                    <span dir="ltr" className="tabular-nums text-[#ea580c]">
                      {plan.mileageKmPerMonth.toLocaleString("ar-SA")} كم
                    </span>
                  </li>
                  <li className="font-semibold">
                    رسوم الزيادة:{" "}
                    <span dir="ltr">{plan.extraKmFeeSarPerKm} <SarCurrencyGlyph /> / كم</span>
                  </li>
                  <li className="font-semibold sm:col-span-2">
                    عربون مقدّمی:{" "}
                    <span dir="ltr" className="text-[#003749]">{plan.depositAmountSar} <SarCurrencyGlyph /></span>
                  </li>
                </ul>
              </section>
            </div>
          </article>

          <aside className="space-y-5">
            <div className="rounded-3xl border border-neutral-100 bg-[#fdfbf6] px-5 py-4 shadow-lg">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-wide text-[#003749]/65">
                  سعر اشتراك شهري
                </p>
                <p className="text-xs text-on-surface-variant">
                  الأسعار خارج الضريبة تُحمَّل في الإجمالى
                </p>
              </div>
              <p className="mt-4 text-center text-4xl font-black text-[#003749]" dir="ltr">
                {plan.monthlyPriceSar}
                <span className="ms-2 text-lg font-semibold text-on-surface-variant">
                  <SarCurrencyGlyph /> / شهراً
                </span>
              </p>
            </div>
            <SubscribeForm
              plan={dto}
              initialDurationMonths={initialDurationMonths}
              initialStartDateYmd={initialStartDateYmd}
            />
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
