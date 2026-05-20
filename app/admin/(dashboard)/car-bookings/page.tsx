import Link from "next/link";
import { CalendarDays, CalendarPlus, Car, MapPin, Truck } from "lucide-react";
import {
  AdminCarBookingsList,
  type CarBookingDayGroup,
  type CarBookingRow,
} from "@/components/admin/AdminCarBookingsList";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { adminBranchDisplayName, bookingBranchWhere } from "@/lib/admin-access";
import { requireAdminPage } from "@/lib/admin-page";
import { addDaysToYmd, NON_BLOCKING_BOOKING_STATUSES } from "@/lib/direct-booking";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const BRANCH_LABEL: Record<string, string> = {
  jeddah: "جدة",
  madinah: "المدينة المنورة",
  tabuk: "تبوك",
};

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatSectionDate(ymd: string): string {
  const [y, m, day] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  return dt.toLocaleDateString("ar-SA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function branchName(
  branch: { slug: string; name: string } | null | undefined,
): string {
  return branch?.name ?? BRANCH_LABEL[branch?.slug ?? ""] ?? "—";
}

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof Car;
  accent: string;
}) {
  return (
    <div className="flex gap-4 rounded-2xl border border-outline-variant/25 bg-white p-5 shadow-[0_4px_24px_-10px_rgba(28,27,27,0.1)]">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent}`}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-on-surface-variant">{label}</p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight text-[#003749]">
          {value}
        </p>
        {hint ? <p className="mt-0.5 text-[11px] text-on-surface-variant">{hint}</p> : null}
      </div>
    </div>
  );
}

export default async function AdminCarBookingsPage() {
  const session = await requireAdminPage();

  const rows = await prisma.bookingRequest.findMany({
    where: bookingBranchWhere(session, {
      kind: "DIRECT",
      carModelId: { not: null },
      NOT: { status: { in: [...NON_BLOCKING_BOOKING_STATUSES] } },
    }),
    include: {
      carModel: { include: { brand: true, category: true } },
      pickupBranch: { select: { slug: true, name: true } },
      returnBranch: { select: { slug: true, name: true } },
    },
    orderBy: [{ pickupDate: "asc" }, { id: "asc" }],
  });

  const todayYmd = dateKey(new Date());
  const deliveryCount = rows.filter((r) => r.pickupMode === "DELIVERY").length;
  const todayCount = rows.filter((r) => dateKey(r.pickupDate) === todayYmd).length;

  const groupsMap = new Map<string, CarBookingRow[]>();
  for (const b of rows) {
    const startYmd = dateKey(b.pickupDate);
    const endYmd = addDaysToYmd(startYmd, b.numberOfDays - 1);
    const row: CarBookingRow = {
      id: b.id,
      fullName: b.fullName,
      phone: b.phone,
      carLabel: b.carModel ? `${b.carModel.brand.name} ${b.carModel.name}` : "—",
      startYmd,
      endYmd,
      numberOfDays: b.numberOfDays,
      pickupBranchName: branchName(b.pickupBranch),
      returnBranchName: branchName(b.returnBranch),
      pickupMode: b.pickupMode,
      deliveryAddress: (b as { deliveryAddress?: string | null }).deliveryAddress ?? null,
      deliveryLat: b.deliveryLat,
      deliveryLng: b.deliveryLng,
      status: b.status,
      paymentStatus: b.paymentStatus ?? null,
    };
    const list = groupsMap.get(startYmd) ?? [];
    list.push(row);
    groupsMap.set(startYmd, list);
  }

  const groups: CarBookingDayGroup[] = [...groupsMap.keys()]
    .sort()
    .map((ymd) => ({
      ymd,
      sectionTitle: formatSectionDate(ymd),
      rows: groupsMap.get(ymd)!,
    }));

  const branchHint = session.isSuperAdmin
    ? "كل الفروع"
    : `فرع ${adminBranchDisplayName(session)}`;

  return (
    <>
      <AdminPageHeader
        title="حجوزات السيارات"
        description={
          <>
            الحجوزات المباشرة النشطة مرتبة حسب{" "}
            <span className="font-bold text-on-surface">تاريخ بداية الحجز</span>. النطاق:{" "}
            {branchHint}. الحجوزات الملغاة والمكتملة لا تظهر هنا.
          </>
        }
        backHref="/admin"
        backLabel="لوحة التحكم"
        actions={
          <Link
            href="/admin/direct-booking"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-on-primary shadow-sm transition-opacity hover:opacity-95"
          >
            <CalendarPlus className="size-4" aria-hidden />
            حجز جديد
          </Link>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="حجوزات نشطة"
          value={rows.length}
          hint="حجز مباشر مرتبط بموديل"
          icon={Car}
          accent="bg-[#ecfdf5] text-[#047857]"
        />
        <StatTile
          label="تبدأ اليوم"
          value={todayCount}
          hint={todayYmd}
          icon={CalendarDays}
          accent="bg-[#eff6ff] text-[#1d4ed8]"
        />
        <StatTile
          label="توصيل"
          value={deliveryCount}
          hint="استلام من موقع العميل"
          icon={Truck}
          accent="bg-[#f5f3ff] text-[#6d28d9]"
        />
        <StatTile
          label="أيام بها حجوزات"
          value={groups.length}
          hint="مجموعات حسب تاريخ الاستلام"
          icon={MapPin}
          accent="bg-[#fff7ed] text-[#9a3412]"
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-3 text-sm">
        <Link
          href="/admin/cancelled-bookings"
          className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/30 bg-white px-4 py-2 font-bold text-primary shadow-sm transition-colors hover:bg-surface-container-low"
        >
          الحجوزات الملغاة
        </Link>
        <Link
          href="/admin/branch-returns"
          className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/30 bg-white px-4 py-2 font-bold text-primary shadow-sm transition-colors hover:bg-surface-container-low"
        >
          مرتجعات الفرع
        </Link>
        <Link
          href="/admin/fleet-availability"
          className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/30 bg-white px-4 py-2 font-bold text-primary shadow-sm transition-colors hover:bg-surface-container-low"
        >
          توفر الأسطول
        </Link>
      </div>

      <AdminCarBookingsList groups={groups} />
    </>
  );
}
