import Link from "next/link";
import { BranchReturnsCalendar } from "@/components/admin/branch-returns/BranchReturnsCalendar";
import { BranchReturnsMonthList } from "@/components/admin/branch-returns/BranchReturnsMonthList";
import { BranchReturnsTable } from "@/components/admin/branch-returns/BranchReturnsTable";
import { adminBranchDisplayName } from "@/lib/admin-access";
import {
  loadBranchReturnCountsForMonth,
  loadBranchReturnsForDay,
  loadBranchReturnsForMonth,
} from "@/lib/admin-branch-returns";
import { requireAdminPage } from "@/lib/admin-page";
import { formatMonthTitleAr, yearMonthFromYmd } from "@/lib/calendar-month-grid";
import { formatReturnDateAr } from "@/lib/booking-return-schedule";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function parseYmd(raw: string | undefined, fallback: string): string {
  const t = raw?.trim();
  if (t && /^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return fallback;
}

function parseYearMonth(raw: string | undefined, fromDate: string): string {
  const t = raw?.trim();
  if (t && /^\d{4}-\d{2}$/.test(t)) return t;
  return yearMonthFromYmd(fromDate);
}

export default async function BranchReturnsPage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string; month?: string; view?: string; branch?: string }>;
}) {
  const session = await requireAdminPage();
  const sp = searchParams ? await searchParams : {};
  const todayYmd = new Date().toISOString().slice(0, 10);
  const viewYmd = parseYmd(sp.date, todayYmd);
  const yearMonth = parseYearMonth(sp.month, viewYmd);
  const viewMode = sp.view === "month" ? "month" : "day";

  const branchFilter =
    session.isSuperAdmin && sp.branch?.trim()
      ? sp.branch.trim().toLowerCase()
      : session.isSuperAdmin
        ? null
        : session.branchSlug;

  const branchQuery = branchFilter ?? "";

  const [returnCounts, returns, allBranches, branchRow] = await Promise.all([
    loadBranchReturnCountsForMonth({ yearMonth, returnBranchSlug: branchFilter }),
    viewMode === "month"
      ? loadBranchReturnsForMonth({ yearMonth, returnBranchSlug: branchFilter })
      : loadBranchReturnsForDay({ viewYmd, returnBranchSlug: branchFilter }),
    session.isSuperAdmin
      ? prisma.branch.findMany({
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { slug: true, name: true },
        })
      : Promise.resolve([]),
    branchFilter
      ? prisma.branch.findFirst({
          where: { slug: branchFilter },
          select: { name: true },
        })
      : Promise.resolve(null),
  ]);

  const showBranchColumn = session.isSuperAdmin && !branchFilter;

  const pageTitle = session.isSuperAdmin
    ? "التسليم الى الفروع"
    : `التسليم الى فرع ${adminBranchDisplayName(session)}`;

  const listTitle =
    viewMode === "month"
      ? `تسليمات ${formatMonthTitleAr(yearMonth)}`
      : formatReturnDateAr(viewYmd);

  return (
    <>
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight">{pageTitle}</h1>
        <p className="mt-2 max-w-3xl text-on-surface-variant">
          {session.isSuperAdmin ? (
            <>
              اختر يوماً من التقويم لعرض السيارات المسلمة بالساعة، أو اضغط «الشهر» لعرض كل تسليمات الشهر.
            </>
          ) : (
            <>
              التقويم يوضح عدد السيارات المسلمة كل يوم. إذا استلم العميل من فرع آخر، يظهر فرع
              الاستلام وزر «موافق — استلام» لتحديث المخزون.
            </>
          )}
        </p>
        <p className="mt-3 text-sm text-on-surface-variant">
          <Link href="/admin" className="font-bold text-primary hover:underline">
            لوحة التحكم
          </Link>
          <span className="mx-2">·</span>
          <Link href="/admin/car-bookings" className="font-bold text-primary hover:underline">
            حجوزات السيارات
          </Link>
        </p>
      </header>

      <div className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr] xl:grid-cols-[minmax(0,24rem)_1fr]">
        <BranchReturnsCalendar
          yearMonth={yearMonth}
          selectedYmd={viewYmd}
          todayYmd={todayYmd}
          viewMode={viewMode}
          returnCounts={returnCounts}
          branchQuery={branchQuery}
        />

        <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 md:p-6">
          {session.isSuperAdmin && allBranches.length > 0 ? (
            <form method="get" className="mb-5 flex flex-wrap items-end gap-3 border-b border-outline-variant/20 pb-5">
              <input type="hidden" name="view" value={viewMode} />
              <input type="hidden" name="date" value={viewYmd} />
              <input type="hidden" name="month" value={yearMonth} />
              <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm font-medium">
                فرع التسليم
                <select
                  name="branch"
                  defaultValue={branchFilter ?? ""}
                  className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">كل الفروع</option>
                  {allBranches.map((b) => (
                    <option key={b.slug} value={b.slug}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-on-primary hover:opacity-95"
              >
                تطبيق
              </button>
            </form>
          ) : null}

          {branchRow ? (
            <p className="mb-3 text-sm text-on-surface">
              فرع التسليم: <span className="font-bold">{branchRow.name}</span>
            </p>
          ) : null}

          <h2 className="text-lg font-extrabold tracking-tight text-primary">{listTitle}</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            <span className="font-bold tabular-nums text-on-surface">{returns.length}</span>{" "}
            {viewMode === "month" ? "سيارة مسلمة في الشهر" : "مركبة متوقّع تسليمها في هذا اليوم"}
          </p>
        </section>
      </div>

      {returns.length === 0 ? (
        <p className="rounded-2xl border border-outline-variant/30 bg-surface-container-low px-5 py-6 text-sm text-on-surface-variant">
          {viewMode === "month"
            ? "لا توجد تسليمات في هذا الشهر."
            : "لا توجد تسليمات مجدولة لهذا اليوم."}
        </p>
      ) : viewMode === "month" ? (
        <BranchReturnsMonthList
          returns={returns}
          showReturnBranchColumn={showBranchColumn}
          branchQuery={branchQuery}
        />
      ) : (
        <BranchReturnsTable
          returns={returns}
          showReturnBranchColumn={showBranchColumn}
        />
      )}
    </>
  );
}
