import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const KIND_LABELS: Record<string, string> = {
  CUSTOMER_LOGIN: "دخول عميل",
  ADMIN_LOGIN: "دخول موظف",
  PAGE_VIEW: "مشاهدة صفحة",
  CAR_VIEW: "مشاهدة سيارة",
};

const KIND_BADGE_CLASSES: Record<string, string> = {
  CUSTOMER_LOGIN: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ADMIN_LOGIN: "bg-amber-50 text-amber-700 border-amber-200",
  PAGE_VIEW: "bg-sky-50 text-sky-700 border-sky-200",
  CAR_VIEW: "bg-violet-50 text-violet-700 border-violet-200",
};

const FILTERS: Array<{ key: string; label: string; kinds: string[] | null }> = [
  { key: "all", label: "الكل", kinds: null },
  { key: "logins", label: "تسجيلات الدخول", kinds: ["CUSTOMER_LOGIN", "ADMIN_LOGIN"] },
  { key: "customer-logins", label: "دخول العملاء", kinds: ["CUSTOMER_LOGIN"] },
  { key: "admin-logins", label: "دخول الموظفين", kinds: ["ADMIN_LOGIN"] },
  { key: "views", label: "مشاهدات الصفحات", kinds: ["PAGE_VIEW"] },
  { key: "car-views", label: "مشاهدات السيارات", kinds: ["CAR_VIEW"] },
];

/** اختصار الـ User-Agent إلى «متصفح — نظام» مثل: Chrome — Android */
function shortBrowser(ua: string | null): string | null {
  if (!ua) return null;

  let browser: string;
  if (/edg(a|ios)?\//i.test(ua)) browser = "Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/samsungbrowser\//i.test(ua)) browser = "Samsung Internet";
  else if (/firefox\/|fxios\//i.test(ua)) browser = "Firefox";
  else if (/chrome\/|crios\//i.test(ua)) browser = "Chrome";
  else if (/safari\//i.test(ua) && /version\//i.test(ua)) browser = "Safari";
  else if (/whatsapp/i.test(ua)) browser = "WhatsApp";
  else if (/curl|wget|postman/i.test(ua)) browser = "أداة برمجية";
  else browser = ua.split(/[\s/]/)[0]?.slice(0, 24) || "غير معروف";

  let os: string | null = null;
  if (/windows/i.test(ua)) os = "Windows";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/mac os x|macintosh/i.test(ua)) os = "macOS";
  else if (/linux/i.test(ua)) os = "Linux";

  return os ? `${browser} — ${os}` : browser;
}

function startOfTodayRiyadh(): Date {
  const now = new Date();
  const riyadhYmd = now.toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
  return new Date(`${riyadhYmd}T00:00:00+03:00`);
}

export default async function AdminActivityLogsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage();

  const sp = searchParams ? await searchParams : {};
  const filterKey = typeof sp.kind === "string" ? sp.kind : "all";
  const filter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];
  const pageRaw = Number(typeof sp.page === "string" ? sp.page : "1");
  const page = Number.isInteger(pageRaw) && pageRaw >= 1 ? pageRaw : 1;

  const where = filter.kinds ? { kind: { in: filter.kinds } } : {};
  const todayStart = startOfTodayRiyadh();

  const [rows, total, todayCustomerLogins, todayAdminLogins, todayViews, todayCarViews, topCarGroups] =
    await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.activityLog.count({ where }),
      prisma.activityLog.count({
        where: { kind: "CUSTOMER_LOGIN", createdAt: { gte: todayStart } },
      }),
      prisma.activityLog.count({
        where: { kind: "ADMIN_LOGIN", createdAt: { gte: todayStart } },
      }),
      prisma.activityLog.count({
        where: { kind: "PAGE_VIEW", createdAt: { gte: todayStart } },
      }),
      prisma.activityLog.count({
        where: { kind: "CAR_VIEW", createdAt: { gte: todayStart } },
      }),
      prisma.activityLog.groupBy({
        by: ["carModelId"],
        where: { kind: "CAR_VIEW", carModelId: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { carModelId: "desc" } },
        take: 10,
      }),
    ]);

  // أسماء السيارات: للأكثر مشاهدة + للصفوف المعروضة في الجدول
  const carIds = new Set<number>();
  for (const g of topCarGroups) if (g.carModelId != null) carIds.add(g.carModelId);
  for (const r of rows) if (r.carModelId != null) carIds.add(r.carModelId);
  const carModels = carIds.size
    ? await prisma.carModel.findMany({
        where: { id: { in: [...carIds] } },
        select: { id: true, name: true, year: true, brand: { select: { name: true } } },
      })
    : [];
  const carNameById = new Map(
    carModels.map((m) => [m.id, `${m.brand.name} ${m.name} ${m.year}`]),
  );
  const topCars = topCarGroups
    .filter((g) => g.carModelId != null)
    .map((g) => ({
      carModelId: g.carModelId as number,
      views: g._count._all,
      name: carNameById.get(g.carModelId as number) ?? `موديل #${g.carModelId}`,
    }));
  const maxTopViews = Math.max(1, ...topCars.map((c) => c.views));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => `/admin/logs?kind=${filter.key}&page=${p}`;

  return (
    <>
      <header className="mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight">سجل النشاط</h1>
        <p className="mt-2 max-w-2xl text-on-surface-variant">
          مراقبة تسجيلات دخول <span className="font-bold text-on-surface">العملاء والموظفين</span>{" "}
          ومشاهدات صفحات الموقع العام.
        </p>
        <p className="mt-3 text-sm text-on-surface-variant">
          <Link href="/admin" className="font-bold text-primary hover:underline">
            لوحة التحكم
          </Link>
        </p>
      </header>

      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
          <p className="text-sm font-bold text-on-surface-variant">دخول العملاء اليوم</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">{todayCustomerLogins}</p>
        </div>
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
          <p className="text-sm font-bold text-on-surface-variant">دخول الموظفين اليوم</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">{todayAdminLogins}</p>
        </div>
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
          <p className="text-sm font-bold text-on-surface-variant">مشاهدات الصفحات اليوم</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">{todayViews}</p>
        </div>
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
          <p className="text-sm font-bold text-on-surface-variant">مشاهدات السيارات اليوم</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">{todayCarViews}</p>
        </div>
      </section>

      {topCars.length > 0 && (
        <details className="group mb-8 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
          <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">السيارات الأكثر زيارة</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                عدد مرات فتح صفحة الحجز لكل سيارة (منذ بدء التسجيل).
              </p>
            </div>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="ms-auto size-5 shrink-0 text-on-surface-variant transition-transform group-open:rotate-180"
              aria-hidden
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <ol className="mt-4 space-y-3">
            {topCars.map((c, i) => (
              <li key={c.carModelId} className="flex items-center gap-3">
                <span className="w-6 shrink-0 text-center text-sm font-extrabold text-on-surface-variant tabular-nums">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link
                      href={`/fleet/checkout?modelId=${c.carModelId}`}
                      target="_blank"
                      className="truncate font-bold hover:text-primary hover:underline"
                    >
                      {c.name}
                    </Link>
                    <span className="shrink-0 text-sm font-extrabold tabular-nums">
                      {c.views} <span className="font-medium text-on-surface-variant">مشاهدة</span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-outline-variant/20">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(4, Math.round((c.views / maxTopViews) * 100))}%` }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </details>
      )}

      <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={`/admin/logs?kind=${f.key}`}
              className={`rounded-full border px-4 py-1.5 text-sm font-bold transition-colors ${
                f.key === filter.key
                  ? "border-primary bg-primary text-on-primary"
                  : "border-outline-variant/40 text-on-surface-variant hover:border-primary/40 hover:text-on-surface"
              }`}
            >
              {f.label}
            </Link>
          ))}
          <span className="ms-auto text-sm text-on-surface-variant">
            {total} سجل — صفحة {page} من {totalPages}
          </span>
        </div>

        {rows.length === 0 ? (
          <p className="mt-6 text-sm text-on-surface-variant">لا توجد سجلات بعد.</p>
        ) : (
          <div className="mt-5 overflow-hidden rounded-xl border border-outline-variant/25">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-center text-sm">
              <thead>
                <tr className="bg-surface-container text-xs font-extrabold uppercase tracking-wide text-on-surface-variant">
                  <th className="px-4 py-3">الوقت</th>
                  <th className="px-4 py-3">النوع</th>
                  <th className="px-4 py-3">بواسطة</th>
                  <th className="px-4 py-3">الصفحة</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">المتصفح</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.id}
                    className={`border-t border-outline-variant/15 align-middle transition-colors hover:bg-primary/[0.04] ${
                      i % 2 === 1 ? "bg-surface-container/40" : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-on-surface-variant">
                      {r.createdAt.toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                          KIND_BADGE_CLASSES[r.kind] ?? "bg-surface text-on-surface-variant border-outline-variant/40"
                        }`}
                      >
                        {KIND_LABELS[r.kind] ?? r.kind}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium" dir={r.actorLabel ? "ltr" : undefined}>
                      {r.actorLabel ?? <span className="text-on-surface-variant">زائر</span>}
                    </td>
                    <td
                      className="max-w-[220px] truncate px-4 py-3"
                      dir={r.carModelId != null ? undefined : "ltr"}
                      title={r.path ?? undefined}
                    >
                      {r.carModelId != null ? (
                        <a
                          href={`/fleet/checkout?modelId=${r.carModelId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {carNameById.get(r.carModelId) ?? `موديل #${r.carModelId}`}
                        </a>
                      ) : r.path ? (
                        <a
                          href={r.path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {r.path}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums" dir="ltr">
                      {r.ip ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-on-surface-variant" dir="ltr" title={r.userAgent ?? undefined}>
                      {shortBrowser(r.userAgent) ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-3">
            {page > 1 && (
              <Link
                href={pageHref(page - 1)}
                className="rounded-xl border border-outline-variant/40 px-4 py-2 text-sm font-bold hover:border-primary/40"
              >
                الأحدث
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={pageHref(page + 1)}
                className="rounded-xl border border-outline-variant/40 px-4 py-2 text-sm font-bold hover:border-primary/40"
              >
                الأقدم
              </Link>
            )}
          </div>
        )}
      </section>
    </>
  );
}
