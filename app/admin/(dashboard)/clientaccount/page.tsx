import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ChevronLeft, Eye, Mail, Phone, Search, UserSearch, X } from "lucide-react";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { requireAdminPage } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { customerIdsInSessionScope, sessionSeesAllCustomers } from "./client-account-scope";

export const dynamic = "force-dynamic";

const RESULTS_LIMIT = 50;

/** «05xxxxxxxx» أو «5xxxxxxxx» أو «+9665…» → الأرقام المحلية للبحث داخل الجوال المخزّن (+9665…). */
function phoneSearchDigits(q: string): string | null {
  const digits = q.replace(/\D/g, "");
  if (digits.length < 3) return null;
  return digits.replace(/^(00966|966|0)/, "");
}

function formatWhen(d: Date): string {
  return d.toLocaleDateString("ar-SA", { dateStyle: "medium" });
}

function initialOf(name: string | null | undefined): string {
  return name?.trim().charAt(0) || "؟";
}

export default async function AdminClientAccountSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireAdminPage();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const tooShort = q.length > 0 && q.length < 2;
  const phoneDigits = q ? phoneSearchDigits(q) : null;
  const seesAll = sessionSeesAllCustomers(session);

  let results: Array<{
    id: number;
    name: string | null;
    email: string;
    phone: string | null;
    createdAt: Date;
    isBlacklisted: boolean;
  }> = [];

  if (q && !tooShort) {
    const where: Prisma.UserWhereInput = {
      OR: [
        { name: { contains: q } },
        { email: { contains: q } },
        ...(phoneDigits ? [{ phone: { contains: phoneDigits } }] : []),
      ],
    };
    const found = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      // موظف الفرع: نجلب أكثر ثم نُبقي من له حجز في نطاقه.
      take: seesAll ? RESULTS_LIMIT : RESULTS_LIMIT * 4,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        isBlacklisted: true,
      },
    });
    const allowed = await customerIdsInSessionScope(session, found);
    results = found.filter((u) => allowed.has(u.id)).slice(0, RESULTS_LIMIT);
  }

  return (
    <>
      <AdminPageHeader
        title="معاينة حساب العميل"
        description={
          <>
            ابحث عن العميل ثم افتح حسابه لترى صفحته{" "}
            <span className="font-bold text-on-surface">كما يراها هو تماماً</span> — الحجوزات وحالاتها
            والمبالغ المستحقة والأزرار الظاهرة له. المعاينة للعرض فقط ولا تنفّذ أي إجراء نيابةً عنه.
          </>
        }
        backHref="/admin/customers"
        backLabel="العملاء"
      />

      <form
        method="get"
        className="mb-6 flex flex-col gap-3 rounded-2xl border border-outline-variant/25 bg-surface-container-low/50 p-4 sm:flex-row sm:items-center sm:p-5"
      >
        <label className="relative flex-1">
          <span className="sr-only">بحث باسم العميل أو جواله أو بريده</span>
          <Search
            className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
            aria-hidden
          />
          <input
            name="q"
            defaultValue={q}
            autoFocus
            autoComplete="off"
            placeholder="اسم العميل أو جواله أو بريده — مثال: محمد أو 05xxxxxxxx"
            className="w-full rounded-xl border border-outline-variant/40 bg-white py-2.5 ps-10 pe-3 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary shadow-sm transition hover:opacity-95 sm:flex-none"
          >
            <Search className="h-4 w-4" aria-hidden />
            بحث
          </button>
          {q ? (
            <Link
              href="/admin/clientaccount"
              className="inline-flex items-center gap-1 rounded-xl px-3 py-2.5 text-sm font-bold text-on-surface-variant transition hover:bg-white hover:text-on-surface"
            >
              <X className="h-4 w-4" aria-hidden />
              مسح
            </Link>
          ) : null}
        </div>
      </form>

      {!seesAll ? (
        <p className="mb-6 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold leading-relaxed text-sky-950">
          نطاقك محدود بفرع/مدينة: تظهر لك فقط حسابات العملاء الذين لهم حجز داخل نطاقك، وفي المعاينة
          تظهر حجوزات نطاقك فقط.
        </p>
      ) : null}

      <AdminCard noPadding>
        {!q || tooShort ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container">
              <UserSearch className="h-6 w-6" aria-hidden />
            </div>
            <p className="mt-3 font-extrabold text-on-surface">
              {tooShort ? "اكتب حرفين على الأقل" : "ابدأ بكتابة اسم العميل"}
            </p>
            <p className="mt-1 max-w-sm text-sm leading-relaxed text-on-surface-variant">
              يمكنك البحث بالاسم أو برقم الجوال (بأي صيغة: 05… أو 5… أو ‎+966…) أو بالبريد.
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-container-low text-on-surface-variant">
              <Search className="h-6 w-6" aria-hidden />
            </div>
            <p className="mt-3 font-extrabold text-on-surface">لا توجد حسابات مطابقة</p>
            <p className="mt-1 text-sm text-on-surface-variant">
              جرّب جزءاً من الاسم أو رقم الجوال. العملاء الذين حجزوا بلا حساب يظهرون في صفحة{" "}
              <Link href="/admin/customers" className="font-bold text-primary hover:underline">
                العملاء
              </Link>
              .
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-outline-variant/15 px-5 py-3 sm:px-6">
              <p className="text-sm font-bold text-on-surface">نتائج البحث</p>
              <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-bold tabular-nums text-on-surface-variant">
                {results.length.toLocaleString("ar-SA")}
                {results.length >= RESULTS_LIMIT ? "+" : ""} حساب
              </span>
            </div>
            <ul className="divide-y divide-outline-variant/15">
              {results.map((u) => {
                const placeholderEmail = u.email.endsWith(".invalid");
                return (
                  <li key={u.id}>
                    <Link
                      href={`/admin/clientaccount/${u.id}`}
                      className="group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-container-low/60 sm:gap-4 sm:px-6"
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
                          u.isBlacklisted ? "bg-zinc-900 text-white" : "bg-[#fff7ed] text-[#9a3412]"
                        }`}
                        aria-hidden
                      >
                        {initialOf(u.name ?? u.email)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-1.5 font-bold text-on-surface">
                          {u.name ?? "—"}
                          {placeholderEmail ? (
                            <span className="rounded-md bg-surface-container-low px-1.5 py-0.5 text-[10px] font-bold text-on-surface-variant">
                              بلا حساب دخول
                            </span>
                          ) : null}
                          {u.isBlacklisted ? (
                            <span className="rounded-md bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              محظور
                            </span>
                          ) : null}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant">
                          <span className="inline-flex items-center gap-1 font-mono font-bold tabular-nums" dir="ltr">
                            <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            {u.phone ?? "—"}
                          </span>
                          {placeholderEmail ? null : (
                            <span className="inline-flex min-w-0 items-center gap-1 break-all font-mono" dir="ltr">
                              <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              {u.email}
                            </span>
                          )}
                          <span className="whitespace-nowrap">سُجّل {formatWhen(u.createdAt)}</span>
                        </div>
                      </div>
                      <span className="hidden shrink-0 items-center gap-1 rounded-xl border border-outline-variant/40 bg-white px-3 py-2 text-xs font-bold text-primary shadow-sm transition group-hover:border-primary sm:inline-flex">
                        <Eye className="h-4 w-4" aria-hidden />
                        معاينة الحساب
                      </span>
                      <ChevronLeft className="h-5 w-5 shrink-0 text-on-surface-variant sm:hidden" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </AdminCard>
    </>
  );
}
