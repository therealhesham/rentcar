import Link from "next/link";
import { Prisma } from "@prisma/client";
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

/** الأنواع التي تُحتسب «زيارة» للموقع العام. */
const VIEW_KINDS = ["PAGE_VIEW", "CAR_VIEW"];

/** فترات جاهزة — `days` بعدد الأيام شاملةً اليوم الحالي، و`null` = كل الفترة. */
const RANGES: Array<{ key: string; label: string; days: number | null }> = [
  { key: "today", label: "اليوم", days: 1 },
  { key: "7d", label: "آخر ٧ أيام", days: 7 },
  { key: "30d", label: "آخر ٣٠ يوم", days: 30 },
  { key: "all", label: "كل الفترة", days: null },
];

const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** أنواع تسجيل الدخول — عدّادها يقيس الأشخاص لا العناوين. */
const LOGIN_KINDS = ["CUSTOMER_LOGIN", "ADMIN_LOGIN"];

/**
 * `countBy` يحدد وحدة عدّاد التبويب: `actor` = عدد الأشخاص المختلفين (من `actorLabel`)
 * وهو المعنى المفيد لتبويبات الدخول، و`ip` = عدد الزوّار المنفردين للمشاهدات.
 */
const FILTERS: Array<{
  key: string;
  label: string;
  kinds: string[] | null;
  countBy: "ip" | "actor";
}> = [
  { key: "all", label: "الكل", kinds: null, countBy: "ip" },
  { key: "logins", label: "تسجيلات الدخول", kinds: LOGIN_KINDS, countBy: "actor" },
  { key: "customer-logins", label: "دخول العملاء", kinds: ["CUSTOMER_LOGIN"], countBy: "actor" },
  { key: "admin-logins", label: "دخول الموظفين", kinds: ["ADMIN_LOGIN"], countBy: "actor" },
  { key: "views", label: "مشاهدات الصفحات", kinds: ["PAGE_VIEW"], countBy: "ip" },
  { key: "car-views", label: "مشاهدات السيارات", kinds: ["CAR_VIEW"], countBy: "ip" },
];

const COUNT_UNIT_LABEL: Record<"ip" | "actor", string> = {
  ip: "زائر منفرد (IP فريدة)",
  actor: "مستخدم مختلف",
};

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

/** بداية يوم YYYY-MM-DD بتوقيت الرياض. */
function riyadhDayStart(ymd: string): Date {
  return new Date(`${ymd}T00:00:00+03:00`);
}

function riyadhYmd(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
}

/** إزاحة تاريخ YYYY-MM-DD بعدد أيام (بالسالب للخلف). */
function shiftYmd(ymd: string, days: number): string {
  const d = riyadhDayStart(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return riyadhYmd(d);
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

  // المدى المخصص (from/to) يتقدّم على الفترات الجاهزة إن وُجد أيٌّ منهما.
  const from = typeof sp.from === "string" && YMD_PATTERN.test(sp.from) ? sp.from : null;
  const to = typeof sp.to === "string" && YMD_PATTERN.test(sp.to) ? sp.to : null;
  const isCustomRange = from !== null || to !== null;
  const rangeKey = typeof sp.range === "string" ? sp.range : "all";
  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[3];

  let gte: Date | undefined;
  let lt: Date | undefined;
  if (isCustomRange) {
    if (from) gte = riyadhDayStart(from);
    // «إلى» شامل لليوم نفسه، فالحد الأعلى هو بداية اليوم التالي.
    if (to) lt = riyadhDayStart(shiftYmd(to, 1));
  } else if (range.days !== null) {
    gte = riyadhDayStart(shiftYmd(riyadhYmd(new Date()), -(range.days - 1)));
  }
  const dateWhere = gte || lt ? { createdAt: { ...(gte && { gte }), ...(lt && { lt }) } } : {};
  const rangeLabel = isCustomRange
    ? `${from ?? "البداية"} → ${to ?? "الآن"}`
    : range.label;

  const where = filter.kinds ? { ...dateWhere, kind: { in: filter.kinds } } : dateWhere;

  const dateSql =
    gte && lt
      ? Prisma.sql`AND createdAt >= ${gte} AND createdAt < ${lt}`
      : gte
        ? Prisma.sql`AND createdAt >= ${gte}`
        : lt
          ? Prisma.sql`AND createdAt < ${lt}`
          : Prisma.empty;

  const [
    rows,
    total,
    rangeCustomerLogins,
    rangeAdminLogins,
    rangeViews,
    rangeCarViews,
    topCarGroups,
    topVisitorGroups,
    kindIpPairs,
    kindActorPairs,
  ] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.activityLog.count({ where }),
    prisma.activityLog.count({ where: { ...dateWhere, kind: "CUSTOMER_LOGIN" } }),
    prisma.activityLog.count({ where: { ...dateWhere, kind: "ADMIN_LOGIN" } }),
    prisma.activityLog.count({ where: { ...dateWhere, kind: "PAGE_VIEW" } }),
    prisma.activityLog.count({ where: { ...dateWhere, kind: "CAR_VIEW" } }),
    prisma.activityLog.groupBy({
      by: ["carModelId"],
      where: { ...dateWhere, kind: "CAR_VIEW", carModelId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { carModelId: "desc" } },
      take: 10,
    }),
    prisma.activityLog.groupBy({
      by: ["userId"],
      where: { ...dateWhere, kind: { in: VIEW_KINDS }, userId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { userId: "desc" } },
      take: 10,
    }),
    // القيم المميّزة لكل نوع — نحسب منها عدّاد كل تبويب في الذاكرة، لأن اتحاد
    // نوعين ليس مجموع منفرديهما (نفس الـ IP أو الشخص قد يظهر في الاثنين).
    prisma.$queryRaw<Array<{ kind: string; ip: string }>>`
      SELECT DISTINCT kind, ip FROM ActivityLog WHERE ip IS NOT NULL ${dateSql}`,
    prisma.$queryRaw<Array<{ kind: string; actorLabel: string }>>`
      SELECT DISTINCT kind, actorLabel FROM ActivityLog
      WHERE actorLabel IS NOT NULL AND kind IN (${Prisma.join(LOGIN_KINDS)}) ${dateSql}`,
  ]);

  const groupValues = <T extends Record<string, string>>(
    pairs: T[],
    key: Exclude<keyof T & string, "kind">,
  ): Map<string, Set<string>> => {
    const byKind = new Map<string, Set<string>>();
    for (const pair of pairs) {
      const set = byKind.get(pair.kind) ?? new Set<string>();
      set.add(pair[key]);
      byKind.set(pair.kind, set);
    }
    return byKind;
  };
  const valuesByDimension = {
    ip: groupValues(kindIpPairs, "ip"),
    actor: groupValues(kindActorPairs, "actorLabel"),
  };

  /** عدّاد التبويب: عدد القيم المميّزة ضمن أنواعه — `kinds = null` يعني كل الأنواع. */
  const distinctCount = (kinds: string[] | null, countBy: "ip" | "actor"): number => {
    const union = new Set<string>();
    for (const [kind, values] of valuesByDimension[countBy]) {
      if (kinds && !kinds.includes(kind)) continue;
      for (const value of values) union.add(value);
    }
    return union.size;
  };

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

  // أسماء العملاء: للأكثر زيارة + للصفوف المعروضة (المشاهدات تُخزَّن بـ userId بلا اسم)
  const userIds = new Set<number>();
  for (const g of topVisitorGroups) if (g.userId != null) userIds.add(g.userId);
  for (const r of rows) if (r.userId != null && !r.actorLabel) userIds.add(r.userId);
  const users = userIds.size
    ? await prisma.user.findMany({
        where: { id: { in: [...userIds] } },
        select: { id: true, name: true, phone: true, email: true },
      })
    : [];
  const userLabelById = new Map(
    users.map((u) => [u.id, u.name?.trim() || u.phone || u.email]),
  );
  const topVisitors = topVisitorGroups
    .filter((g) => g.userId != null)
    .map((g) => ({
      userId: g.userId as number,
      visits: g._count._all,
      label: userLabelById.get(g.userId as number) ?? `عميل #${g.userId}`,
    }));
  const maxTopVisits = Math.max(1, ...topVisitors.map((v) => v.visits));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /** رابط يحافظ على باقي الفلاتر. تغيير التبويب أو الفترة يعيد الترقيم للصفحة الأولى. */
  const hrefWith = (patch: { kind?: string; range?: string; page?: number }) => {
    const p = new URLSearchParams();
    const kind = patch.kind ?? filter.key;
    if (kind !== "all") p.set("kind", kind);
    if (patch.range !== undefined) {
      if (patch.range !== "all") p.set("range", patch.range);
    } else if (isCustomRange) {
      if (from) p.set("from", from);
      if (to) p.set("to", to);
    } else if (range.key !== "all") {
      p.set("range", range.key);
    }
    if (patch.page && patch.page > 1) p.set("page", String(patch.page));
    const qs = p.toString();
    return qs ? `/admin/logs?${qs}` : "/admin/logs";
  };

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

      <section className="mb-8 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-on-surface-variant">الفترة</span>
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={hrefWith({ range: r.key })}
              className={`rounded-full border px-4 py-1.5 text-sm font-bold transition-colors ${
                !isCustomRange && r.key === range.key
                  ? "border-primary bg-primary text-on-primary"
                  : "border-outline-variant/40 text-on-surface-variant hover:border-primary/40 hover:text-on-surface"
              }`}
            >
              {r.label}
            </Link>
          ))}

          <form method="get" action="/admin/logs" className="ms-auto flex flex-wrap items-center gap-2">
            {filter.key !== "all" && <input type="hidden" name="kind" value={filter.key} />}
            <label className="flex items-center gap-1.5 text-sm font-bold text-on-surface-variant">
              من
              <input
                type="date"
                name="from"
                defaultValue={from ?? ""}
                className="rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-sm font-medium text-on-surface"
              />
            </label>
            <label className="flex items-center gap-1.5 text-sm font-bold text-on-surface-variant">
              إلى
              <input
                type="date"
                name="to"
                defaultValue={to ?? ""}
                className="rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-sm font-medium text-on-surface"
              />
            </label>
            <button
              type="submit"
              className="rounded-xl border border-primary bg-primary px-4 py-1.5 text-sm font-bold text-on-primary"
            >
              تطبيق
            </button>
          </form>
        </div>
      </section>

      <p className="mb-3 text-sm text-on-surface-variant">
        الأرقام التالية عن: <span className="font-bold text-on-surface">{rangeLabel}</span>
      </p>
      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
          <p className="text-sm font-bold text-on-surface-variant">دخول العملاء</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">{rangeCustomerLogins}</p>
        </div>
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
          <p className="text-sm font-bold text-on-surface-variant">دخول الموظفين</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">{rangeAdminLogins}</p>
        </div>
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
          <p className="text-sm font-bold text-on-surface-variant">مشاهدات الصفحات</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">{rangeViews}</p>
        </div>
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
          <p className="text-sm font-bold text-on-surface-variant">مشاهدات السيارات</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">{rangeCarViews}</p>
        </div>
      </section>

      {topVisitors.length > 0 && (
        <details className="group mb-8 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
          <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">العملاء الأكثر زيارة</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                عدد مشاهدات الصفحات والسيارات لكل عميل مسجّل دخول. الزيارات قبل تفعيل الربط
                تظهر كـ«زائر».
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
            {topVisitors.map((v, i) => (
              <li key={v.userId} className="flex items-center gap-3">
                <span className="w-6 shrink-0 text-center text-sm font-extrabold text-on-surface-variant tabular-nums">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-bold">{v.label}</span>
                    <span className="shrink-0 text-sm font-extrabold tabular-nums">
                      {v.visits} <span className="font-medium text-on-surface-variant">زيارة</span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-outline-variant/20">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${Math.max(4, Math.round((v.visits / maxTopVisits) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </details>
      )}

      {topCars.length > 0 && (
        <details className="group mb-8 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
          <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">السيارات الأكثر زيارة</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                عدد مرات فتح صفحة الحجز لكل سيارة خلال الفترة المحددة.
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
          {FILTERS.map((f) => {
            const isActive = f.key === filter.key;
            return (
              <Link
                key={f.key}
                href={hrefWith({ kind: f.key })}
                title={`عدد ${COUNT_UNIT_LABEL[f.countBy]} خلال: ${rangeLabel}`}
                className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-bold transition-colors ${
                  isActive
                    ? "border-primary bg-primary text-on-primary"
                    : "border-outline-variant/40 text-on-surface-variant hover:border-primary/40 hover:text-on-surface"
                }`}
              >
                {f.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-extrabold tabular-nums ${
                    isActive ? "bg-on-primary/20" : "bg-outline-variant/25"
                  }`}
                >
                  {distinctCount(f.kinds, f.countBy)}
                </span>
              </Link>
            );
          })}
          <span className="ms-auto text-sm text-on-surface-variant">
            {total} سجل — صفحة {page} من {totalPages}
          </span>
        </div>
        <p className="mt-2 text-xs text-on-surface-variant">
          الرقم داخل كل تبويب ليس عدد السجلات: تبويبات الدخول تعدّ{" "}
          <span className="font-bold">الأشخاص المختلفين</span>، وباقي التبويبات تعدّ{" "}
          <span className="font-bold">الزوّار المنفردين</span> (IP فريدة).
        </p>

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
                    <td
                      className="px-4 py-3 font-medium"
                      dir={r.actorLabel ? "ltr" : undefined}
                    >
                      {r.actorLabel ??
                        (r.userId != null ? userLabelById.get(r.userId) : null) ?? (
                          <span className="text-on-surface-variant">زائر</span>
                        )}
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
                href={hrefWith({ page: page - 1 })}
                className="rounded-xl border border-outline-variant/40 px-4 py-2 text-sm font-bold hover:border-primary/40"
              >
                الأحدث
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={hrefWith({ page: page + 1 })}
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
