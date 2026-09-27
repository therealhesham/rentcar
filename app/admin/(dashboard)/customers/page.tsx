import Link from "next/link";
import type { ReactNode } from "react";
import type { Prisma } from "@prisma/client";
import { Ban, Mail, Phone, Repeat, Search, UserRound, Users, X } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { BlacklistBadge, CustomerBlacklistToggle } from "@/components/admin/CustomerBlacklistToggle";
import { bookingBranchWhere, sessionHasPermission } from "@/lib/admin-access";
import { requireAdminPage } from "@/lib/admin-page";
import { adminScope } from "@/lib/admin-scope";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const BOOKING_ROWS_LIMIT = 3000;

type BookingClientRow = {
  phone: string;
  fullName: string;
  lastAt: Date;
  requestCount: number;
  lastKind: string;
  /** أحدث حجز لهذا الجوال — يُستخدم هدفاً لزر الحظر (يُنشئ حساباً إن لم يوجد). */
  lastBookingId: number;
  /** محظور بالجوال أو بالحساب المربوط بأيّ من طلباته — نفس منطق `findBlacklistedMatch`. */
  isBlacklisted: boolean;
};

function aggregateClientsFromBookings(
  rows: Array<{
    id: number;
    phone: string;
    fullName: string;
    createdAt: Date;
    kind: string;
    customerId: number | null;
  }>,
  blacklisted: { phones: Set<string>; userIds: Set<number> },
): BookingClientRow[] {
  const map = new Map<string, Omit<BookingClientRow, "phone">>();

  for (const r of rows) {
    const hit =
      blacklisted.phones.has(r.phone) ||
      (r.customerId != null && blacklisted.userIds.has(r.customerId));
    const cur = map.get(r.phone);
    if (!cur) {
      map.set(r.phone, {
        fullName: r.fullName,
        lastAt: r.createdAt,
        requestCount: 1,
        lastKind: r.kind,
        lastBookingId: r.id,
        isBlacklisted: hit,
      });
    } else {
      cur.requestCount += 1;
      if (hit) cur.isBlacklisted = true;
    }
  }

  return [...map.entries()]
    .map(([phone, v]) => ({ phone, ...v }))
    .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
}

/** «05xxxxxxxx» أو «5xxxxxxxx» أو «+9665…» → الأرقام المحلية للبحث داخل الجوال المخزّن (+9665…). */
function phoneSearchDigits(q: string): string | null {
  const digits = q.replace(/\D/g, "");
  if (digits.length < 3) return null;
  return digits.replace(/^(00966|966|0)/, "");
}

function formatWhen(d: Date): string {
  return d.toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" });
}

function initialOf(name: string | null | undefined): string {
  return name?.trim().charAt(0) || "؟";
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
  icon: typeof Ban;
  accent: string;
}) {
  return (
    <div className="flex gap-4 rounded-2xl border border-outline-variant/25 bg-white p-5 shadow-[0_4px_24px_-10px_rgba(28,27,27,0.1)]">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-on-surface-variant">{label}</p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight text-[#003749]">
          {typeof value === "number" ? value.toLocaleString("ar-SA") : value}
        </p>
        {hint ? <p className="mt-0.5 text-[11px] text-on-surface-variant">{hint}</p> : null}
      </div>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  description,
  count,
  children,
}: {
  icon: typeof Ban;
  title: string;
  description: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-outline-variant/25 bg-white shadow-[0_4px_24px_-12px_rgba(28,27,27,0.12)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-outline-variant/20 bg-surface-container-low/60 px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-[#003749]">{title}</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-on-surface-variant sm:text-sm">
              {description}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold tabular-nums text-on-surface ring-1 ring-outline-variant/30 ring-inset">
          {count.toLocaleString("ar-SA")} نتيجة
        </span>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ hasFilter, emptyLabel }: { hasFilter: boolean; emptyLabel: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-container-low text-on-surface-variant">
        {hasFilter ? <Search className="h-6 w-6" aria-hidden /> : <Users className="h-6 w-6" aria-hidden />}
      </div>
      <p className="mt-3 font-extrabold text-on-surface">
        {hasFilter ? "لا نتائج مطابقة" : emptyLabel}
      </p>
      {hasFilter ? (
        <p className="mt-1 text-sm text-on-surface-variant">جرّب كلمة بحث أخرى أو أزل عامل التصفية.</p>
      ) : null}
    </div>
  );
}

const thClass =
  "px-4 py-3 text-start text-[11px] font-bold uppercase tracking-wide text-on-surface-variant first:ps-5 last:pe-5 sm:first:ps-6 sm:last:pe-6";
const tdClass = "px-4 py-3.5 first:ps-5 last:pe-5 sm:first:ps-6 sm:last:pe-6";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; blacklisted?: string }>;
}) {
  const session = await requireAdminPage();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const onlyBlacklisted = sp.blacklisted === "1";
  const hasFilter = Boolean(q) || onlyBlacklisted;
  const canManageBlacklist = sessionHasPermission(session, "/admin/customers");
  const showUsers = adminScope(session).kind === "all";
  const phoneDigits = q ? phoneSearchDigits(q) : null;

  const userWhere: Prisma.UserWhereInput = {
    ...(onlyBlacklisted ? { isBlacklisted: true } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            ...(phoneDigits ? [{ phone: { contains: phoneDigits } }] : []),
          ],
        }
      : {}),
  };

  const blacklistedUsers = await prisma.user.findMany({
    where: { isBlacklisted: true },
    select: { id: true, phone: true },
  });
  const blacklisted = {
    phones: new Set(blacklistedUsers.map((u) => u.phone).filter((p): p is string => Boolean(p))),
    userIds: new Set(blacklistedUsers.map((u) => u.id)),
  };

  const bookingFilters: Prisma.BookingRequestWhereInput[] = [];
  if (q) {
    bookingFilters.push({
      OR: [
        { fullName: { contains: q } },
        ...(phoneDigits ? [{ phone: { contains: phoneDigits } }] : []),
      ],
    });
  }
  if (onlyBlacklisted) {
    // التصفية في القاعدة لا بعد الجلب — كي لا يسقط محظور خارج حدّ آخر 3000 طلب.
    bookingFilters.push({
      OR: [
        { phone: { in: [...blacklisted.phones] } },
        { customerId: { in: [...blacklisted.userIds] } },
      ],
    });
  }
  const bookingSearch: Prisma.BookingRequestWhereInput | undefined =
    bookingFilters.length === 0
      ? undefined
      : bookingFilters.length === 1
        ? bookingFilters[0]
        : { AND: bookingFilters };

  // حسابات الموقع غير مرتبطة بفرع — تُعرض لمن نطاقه كل الفروع فقط.
  const [users, bookingRows] = await Promise.all([
    showUsers
      ? prisma.user.findMany({
          where: userWhere,
          orderBy: { createdAt: "desc" },
          take: 200,
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            createdAt: true,
            isBlacklisted: true,
            blacklistReason: true,
            blacklistedAt: true,
          },
        })
      : Promise.resolve([]),
    prisma.bookingRequest.findMany({
      where: bookingBranchWhere(session, bookingSearch),
      orderBy: { createdAt: "desc" },
      take: BOOKING_ROWS_LIMIT,
      select: {
        id: true,
        phone: true,
        fullName: true,
        createdAt: true,
        kind: true,
        customerId: true,
      },
    }),
  ]);

  const clientsFromBookings = aggregateClientsFromBookings(bookingRows, blacklisted);
  const repeatCount = clientsFromBookings.filter((c) => c.requestCount > 1).length;
  const scopeHint = hasFilter ? "ضمن نتائج التصفية" : `من آخر ${BOOKING_ROWS_LIMIT.toLocaleString("ar-SA")} طلب`;

  /** رابط يحافظ على البحث الحالي ويبدّل تصفية القائمة السوداء فوراً (بلا زر «بحث»). */
  const filterHref = (blacklistedOnly: boolean) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (blacklistedOnly) params.set("blacklisted", "1");
    const qs = params.toString();
    return qs ? `/admin/customers?${qs}` : "/admin/customers";
  };

  return (
    <>
      <AdminPageHeader
        title="العملاء"
        description={
          <>
            قائمة مُشتقة من <span className="font-bold text-on-surface">طلبات الحجز</span> مجمّعة
            برقم الجوال (أحدث اسم يظهر لكل رقم)، إلى جانب الحسابات المسجّلة في النظام — مع إدارة
            القائمة السوداء.
          </>
        }
        backHref="/admin"
        backLabel="لوحة التحكم"
      />

      <div className={`mb-8 grid gap-4 sm:grid-cols-2 ${showUsers ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
        <StatTile
          label="أرقام جوال مميّزة"
          value={clientsFromBookings.length}
          hint={scopeHint}
          icon={Users}
          accent="bg-[#eff6ff] text-[#1d4ed8]"
        />
        <StatTile
          label="عملاء متكررون"
          value={repeatCount}
          hint="أكثر من طلب واحد"
          icon={Repeat}
          accent="bg-[#ecfdf5] text-[#047857]"
        />
        <StatTile
          label="في القائمة السوداء"
          value={blacklistedUsers.length}
          hint="إجمالي العملاء المحظورين"
          icon={Ban}
          accent="bg-zinc-100 text-zinc-900"
        />
        {showUsers ? (
          <StatTile
            label="حسابات مسجّلة"
            value={users.length}
            hint={hasFilter ? "ضمن نتائج التصفية" : `أحدث ${(200).toLocaleString("ar-SA")} حساب`}
            icon={UserRound}
            accent="bg-[#fff7ed] text-[#9a3412]"
          />
        ) : null}
      </div>

      <form
        method="get"
        className="mb-8 flex flex-col gap-3 rounded-2xl border border-outline-variant/25 bg-surface-container-low/50 p-4 sm:flex-row sm:items-center sm:p-5"
      >
        <label className="relative flex-1">
          <span className="sr-only">بحث بالاسم أو الجوال أو البريد</span>
          <Search
            className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
            aria-hidden
          />
          <input
            name="q"
            defaultValue={q}
            placeholder="ابحث بالاسم أو الجوال أو البريد — مثال: محمد أو 05xxxxxxxx"
            className="w-full rounded-xl border border-outline-variant/40 bg-white py-2.5 ps-10 pe-3 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>

        {onlyBlacklisted ? <input type="hidden" name="blacklisted" value="1" /> : null}

        <nav
          aria-label="تصفية العملاء"
          className="inline-flex shrink-0 rounded-xl border border-outline-variant/40 bg-white p-1 shadow-sm"
        >
          <Link
            href={filterHref(false)}
            aria-current={!onlyBlacklisted ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-bold transition ${
              !onlyBlacklisted
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
            }`}
          >
            <Users className="h-4 w-4" aria-hidden />
            الكل
          </Link>
          <Link
            href={filterHref(true)}
            aria-current={onlyBlacklisted ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-bold transition ${
              onlyBlacklisted
                ? "bg-zinc-900 text-white"
                : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
            }`}
          >
            <Ban className="h-4 w-4" aria-hidden />
            القائمة السوداء
            <span
              className={`rounded-full px-1.5 text-[11px] tabular-nums ${
                onlyBlacklisted ? "bg-white/20" : "bg-surface-container-low"
              }`}
            >
              {blacklistedUsers.length.toLocaleString("ar-SA")}
            </span>
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary shadow-sm transition hover:opacity-95 sm:flex-none"
          >
            <Search className="h-4 w-4" aria-hidden />
            بحث
          </button>
          {hasFilter ? (
            <Link
              href="/admin/customers"
              className="inline-flex items-center gap-1 rounded-xl px-3 py-2.5 text-sm font-bold text-on-surface-variant transition hover:bg-white hover:text-on-surface"
            >
              <X className="h-4 w-4" aria-hidden />
              مسح
            </Link>
          ) : null}
        </div>
      </form>

      <div className="space-y-8">
        <SectionCard
          icon={Phone}
          title="من طلبات الحجز"
          description="رقم جوال مميّز لكل صف — أحدث طلب لكل رقم يُستخدم للاسم المعروض."
          count={clientsFromBookings.length}
        >
          {clientsFromBookings.length === 0 ? (
            <EmptyState hasFilter={hasFilter} emptyLabel="لا توجد طلبات حجز بعد" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-surface-container-low/40">
                  <tr className="border-b border-outline-variant/20">
                    <th className={thClass}>العميل</th>
                    <th className={thClass}>الجوال</th>
                    <th className={thClass}>الطلبات</th>
                    <th className={thClass}>آخر نوع</th>
                    <th className={thClass}>آخر نشاط</th>
                    <th className={thClass}>القائمة السوداء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/15">
                  {clientsFromBookings.map((c) => {
                    const isBlacklisted = c.isBlacklisted;
                    return (
                      <tr
                        key={c.phone}
                        className={`transition-colors hover:bg-surface-container-low/60 ${
                          isBlacklisted ? "bg-zinc-50" : ""
                        }`}
                      >
                        <td className={tdClass}>
                          <div className="flex items-center gap-3">
                            <span
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
                                isBlacklisted
                                  ? "bg-zinc-900 text-white"
                                  : "bg-primary-container text-on-primary-container"
                              }`}
                              aria-hidden
                            >
                              {initialOf(c.fullName)}
                            </span>
                            <span className="font-bold text-on-surface">{c.fullName}</span>
                          </div>
                        </td>
                        <td className={tdClass}>
                          <a
                            href={`tel:${c.phone.replace(/\s/g, "")}`}
                            dir="ltr"
                            className="font-mono text-[13px] font-bold tabular-nums text-primary hover:underline"
                          >
                            {c.phone}
                          </a>
                        </td>
                        <td className={tdClass}>
                          <span
                            className={`inline-flex min-w-8 justify-center rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                              c.requestCount > 1
                                ? "bg-[#ecfdf5] text-[#047857] ring-1 ring-[#6ee7b7]/40 ring-inset"
                                : "bg-surface-container-low text-on-surface-variant"
                            }`}
                          >
                            {c.requestCount.toLocaleString("ar-SA")}
                          </span>
                        </td>
                        <td className={tdClass}>
                          {c.lastKind === "DIRECT" ? (
                            <span className="rounded-lg bg-[#eff6ff] px-2.5 py-1 text-xs font-bold text-[#1d4ed8]">
                              حجز مباشر
                            </span>
                          ) : (
                            <span className="rounded-lg bg-surface-container-low px-2.5 py-1 text-xs font-bold text-on-surface">
                              طلب حجز
                            </span>
                          )}
                        </td>
                        <td className={`${tdClass} whitespace-nowrap text-xs text-on-surface-variant`}>
                          {formatWhen(c.lastAt)}
                        </td>
                        <td className={tdClass}>
                          {canManageBlacklist ? (
                            <CustomerBlacklistToggle
                              compact
                              target={{ kind: "booking", bookingId: c.lastBookingId }}
                              isBlacklisted={isBlacklisted}
                            />
                          ) : isBlacklisted ? (
                            <BlacklistBadge />
                          ) : (
                            <span className="text-on-surface-variant">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {showUsers ? (
          <SectionCard
            icon={Mail}
            title="حسابات مسجّلة"
            description="حسابات البريد في جدول المستخدمين — قد تكون فارغة إن لم يُفعّل تسجيل العملاء بعد."
            count={users.length}
          >
            {users.length === 0 ? (
              <EmptyState hasFilter={hasFilter} emptyLabel="لا يوجد مستخدمون مسجّلون" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-surface-container-low/40">
                    <tr className="border-b border-outline-variant/20">
                      <th className={thClass}>العميل</th>
                      <th className={thClass}>الجوال</th>
                      <th className={thClass}>تاريخ الإنشاء</th>
                      <th className={thClass}>القائمة السوداء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/15">
                    {users.map((u) => (
                      <tr
                        key={u.id}
                        className={`align-top transition-colors hover:bg-surface-container-low/60 ${
                          u.isBlacklisted ? "bg-zinc-50" : ""
                        }`}
                      >
                        <td className={tdClass}>
                          <div className="flex items-center gap-3">
                            <span
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
                                u.isBlacklisted
                                  ? "bg-zinc-900 text-white"
                                  : "bg-[#fff7ed] text-[#9a3412]"
                              }`}
                              aria-hidden
                            >
                              {initialOf(u.name ?? u.email)}
                            </span>
                            <div className="min-w-0">
                              <p className="font-bold text-on-surface">{u.name ?? "—"}</p>
                              <p className="truncate font-mono text-xs text-on-surface-variant" dir="ltr">
                                {u.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className={tdClass}>
                          {u.phone ? (
                            <a
                              href={`tel:${u.phone.replace(/\s/g, "")}`}
                              dir="ltr"
                              className="font-mono text-[13px] font-bold tabular-nums text-primary hover:underline"
                            >
                              {u.phone}
                            </a>
                          ) : (
                            <span className="text-on-surface-variant">—</span>
                          )}
                        </td>
                        <td className={`${tdClass} whitespace-nowrap text-xs text-on-surface-variant`}>
                          {formatWhen(u.createdAt)}
                        </td>
                        <td className={tdClass}>
                          {canManageBlacklist ? (
                            <CustomerBlacklistToggle
                              target={{ kind: "user", userId: u.id }}
                              isBlacklisted={u.isBlacklisted}
                              reason={u.blacklistReason}
                              blacklistedAt={u.blacklistedAt?.toISOString() ?? null}
                            />
                          ) : u.isBlacklisted ? (
                            <BlacklistBadge />
                          ) : (
                            <span className="text-on-surface-variant">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        ) : null}
      </div>
    </>
  );
}
