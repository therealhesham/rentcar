import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/home/SiteFooter";
import { SiteNav } from "@/components/shared/SiteNav";
import {
  SerializedSubscription,
  SubscriptionManageClient,
} from "@/components/subscriptions/SubscriptionManageClient";
import { getCustomerProfile } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AccountSubscriptionPage(props: {
  searchParams?: Promise<{ created?: string }>;
}) {
  const profile = await getCustomerProfile();
  if (!profile) redirect("/account/login");
  const qs = props.searchParams ? await props.searchParams : {};
  const created = qs.created ? Number(qs.created) : null;

  const rows = await prisma.userSubscription.findMany({
    where: { userId: profile.id },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      plan: { include: { carModel: { include: { brand: true } } } },
      documents: true,
      payments: true,
    },
  });

  const serialized: SerializedSubscription[] = rows.map((s) => {
    const pend = s.payments.some((p) => p.status === "PENDING");
    return {
      id: s.id,
      status: s.status,
      durationMonths: s.durationMonths,
      autoRenew: s.autoRenew,
      mileageUsedKm: s.mileageUsedKm,
      mileageAllowanceKm: s.mileageAllowanceKm,
      depositSnapshotSar: s.depositSnapshotSar,
      monthlyPriceSnapshotSar: s.monthlyPriceSnapshotSar,
      createdAtIso: s.createdAt.toISOString(),
      startAtIso: s.startAt?.toISOString() ?? null,
      endAtIso: s.endAt?.toISOString() ?? null,
      planTitle:
        s.plan.marketingTitleAr ??
        `${s.plan.carModel.brand.name} ${s.plan.carModel.name}`.trim(),
      planSlug: s.plan.slug,
      hasLicense: s.documents.some((d) => d.kind === "DRIVERS_LICENSE"),
      hasNationalId: s.documents.some((d) => d.kind === "NATIONAL_ID"),
      pendingPayment: pend,
      plannedStartDateIso: s.plannedStartDate?.toISOString() ?? null,
    };
  });

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f4f5] text-on-surface">
      <SiteNav active="home" />
      <main className="mx-auto w-full max-w-screen-xl flex-1 px-4 pb-16 pt-28 sm:px-6">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/account" className="text-xs font-bold text-[#003749] underline">
              ← حسابي
            </Link>
            <h1 className="mt-2 text-3xl font-extrabold text-[#003749]">اشتراكي الشهري</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-on-surface-variant">
              تابع المدفوعات، ارفع الوثائق، وتحكّم في التجديد والإلغاء — يتكامل مع موافقة الإدارة ووضع
              الخدمة.
            </p>
          </div>
          <Link
            href="/subscriptions"
            className="inline-flex items-center justify-center rounded-xl bg-[#ea580c] px-5 py-2.5 text-sm font-black text-white shadow-sm"
          >
            استكشاف باقات أخرى
          </Link>
        </header>

        <SubscriptionManageClient rows={serialized} highlightedId={created} />
      </main>
      <SiteFooter />
    </div>
  );
}
