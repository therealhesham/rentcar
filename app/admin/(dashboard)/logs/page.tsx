import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const KIND_LABELS: Record<string, string> = {
  CUSTOMER_LOGIN: "دخول عميل",
  ADMIN_LOGIN: "دخول موظف",
  PAGE_VIEW: "مشاهدة صفحة",
};

const KIND_BADGE_CLASSES: Record<string, string> = {
  CUSTOMER_LOGIN: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ADMIN_LOGIN: "bg-amber-50 text-amber-700 border-amber-200",
  PAGE_VIEW: "bg-sky-50 text-sky-700 border-sky-200",
};

const FILTERS: Array<{ key: string; label: string; kinds: string[] | null }> = [
  { key: "all", label: "الكل", kinds: null },
  { key: "logins", label: "تسجيلات الدخول", kinds: ["CUSTOMER_LOGIN", "ADMIN_LOGIN"] },
  { key: "customer-logins", label: "دخول العملاء", kinds: ["CUSTOMER_LOGIN"] },
  { key: "admin-logins", label: "دخول الموظفين", kinds: ["ADMIN_LOGIN"] },
  { key: "views", label: "مشاهدات الصفحات", kinds: ["PAGE_VIEW"] },
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

  const [rows, total, todayCustomerLogins, todayAdminLogins, todayViews] =
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
    ]);

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

      <section className="mb-8 grid gap-4 sm:grid-cols-3">
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
      </section>

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
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-start text-sm">
              <thead>
                <tr className="border-b border-outline-variant/30 text-on-surface-variant">
                  <th className="px-3 py-2">الوقت</th>
                  <th className="px-3 py-2">النوع</th>
                  <th className="px-3 py-2">بواسطة</th>
                  <th className="px-3 py-2">الصفحة</th>
                  <th className="px-3 py-2">IP</th>
                  <th className="px-3 py-2">المتصفح</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-outline-variant/15 align-top">
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-on-surface-variant">
                      {r.createdAt.toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                          KIND_BADGE_CLASSES[r.kind] ?? "bg-surface text-on-surface-variant border-outline-variant/40"
                        }`}
                      >
                        {KIND_LABELS[r.kind] ?? r.kind}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium" dir="ltr">
                      {r.actorLabel ?? "—"}
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2" dir="ltr" title={r.path ?? undefined}>
                      {r.path ? (
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
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums" dir="ltr">
                      {r.ip ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-on-surface-variant" dir="ltr" title={r.userAgent ?? undefined}>
                      {shortBrowser(r.userAgent) ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
