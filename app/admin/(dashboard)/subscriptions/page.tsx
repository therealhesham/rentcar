import { redirect } from "next/navigation";
import {
  approveUserSubscription,
  rejectUserSubscription,
  setUserSubscriptionStatus,
} from "@/app/admin/subscription-admin-actions";
import { verifyAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsDashboardPage(props: {
  searchParams?: Promise<{ status?: string }>;
}) {
  if (!(await verifyAdminSession())) redirect("/admin/login");
  const sp = props.searchParams ? await props.searchParams : {};
  const statusFilterRaw = String(sp.status ?? "").trim();

  const allowed = new Set(["PENDING", "ACTIVE", "SUSPENDED", "EXPIRED", "CANCELLED", "REJECTED"]);
  const statusFilter =
    statusFilterRaw && allowed.has(statusFilterRaw) ? statusFilterRaw : undefined;

  const rows = await prisma.userSubscription.findMany({
    ...(statusFilter ? { where: { status: statusFilter as never } } : {}),
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      user: true,
      plan: { include: { carModel: { include: { brand: true } } } },
      payments: true,
      documents: true,
    },
  });

  async function approve(formData: FormData) {
    "use server";
    await approveUserSubscription(Number(formData.get("subscriptionId")));
  }

  async function reject(formData: FormData) {
    "use server";
    await rejectUserSubscription(Number(formData.get("subscriptionId")), String(formData.get("reason") ?? ""));
  }

  async function suspend(formData: FormData) {
    "use server";
    await setUserSubscriptionStatus({
      subscriptionId: Number(formData.get("subscriptionId")),
      status: "SUSPENDED",
      suspendedReasonAr: String(formData.get("reason") ?? ""),
    });
  }

  async function revive(formData: FormData) {
    "use server";
    await setUserSubscriptionStatus({
      subscriptionId: Number(formData.get("subscriptionId")),
      status: "ACTIVE",
    });
  }

  async function expireNow(formData: FormData) {
    "use server";
    await setUserSubscriptionStatus({
      subscriptionId: Number(formData.get("subscriptionId")),
      status: "EXPIRED",
    });
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">اشتراكات العملاء</h1>
          <p className="mt-2 max-w-xl text-sm text-on-surface-variant">
            الموافقة تتطلّب دفعة تجريبية ورخصة وهوية. التغيير بين الحالات يُسجل ليعكس حالة البطاقات في حساب الزائر.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 text-xs font-black uppercase tracking-wide">
          <a href="/admin/subscriptions" className={`rounded-xl px-3 py-1 ${!statusFilter ? "bg-primary-container text-on-primary-container" : "border opacity-65"}`}>
            كل
          </a>
          {(["PENDING", "ACTIVE", "SUSPENDED", "EXPIRED"] as const).map((code) => (
            <a
              key={code}
              href={`/admin/subscriptions?status=${code}`}
              className={`rounded-xl px-3 py-1 ${statusFilter === code ? "bg-primary-container text-on-primary-container" : "border opacity-65"}`}
            >
              {code}
            </a>
          ))}
        </nav>
      </header>

      <div className="space-y-4">
        {rows.map((row) => {
          const hasInitialPaid = row.payments.some(
            (p) => p.paymentKind === "INITIAL" && p.status === "PAID",
          );
          const hasDocs =
            row.documents.some((d) => d.kind === "DRIVERS_LICENSE") &&
            row.documents.some((d) => d.kind === "NATIONAL_ID");
          const approveReady = row.status === "PENDING" && hasInitialPaid && hasDocs;

          return (
            <article key={row.id} className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm">
              <div className="flex flex-wrap gap-6">
                <div className="min-w-[160px]">
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">طلب #{row.id}</p>
                  <p className="mt-2 text-xl font-black text-[#003749]">{row.status}</p>
                  <p className="mt-2 text-[11px] font-bold">{row.plan.marketingTitleAr ?? `${row.plan.carModel.brand.name} ${row.plan.carModel.name}`}</p>
                </div>
                <dl className="grid flex-1 gap-3 text-[12px] sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="font-black text-on-surface-variant">البريد</dt>
                    <dd dir="ltr" className="font-bold">{row.user.email}</dd>
                  </div>
                  <div>
                    <dt className="font-black text-on-surface-variant">المدّة</dt>
                    <dd dir="ltr">{row.durationMonths} شهر</dd>
                  </div>
                  <div>
                    <dt className="font-black text-on-surface-variant">بداية/نهاية</dt>
                    <dd dir="ltr">
                      {row.startAt ? row.startAt.toLocaleDateString("ar-SA") : "—"} ⇢{" "}
                      {row.endAt ? row.endAt.toLocaleDateString("ar-SA") : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-black text-on-surface-variant">البدلات</dt>
                    <dd dir="ltr">
                      {row.mileageUsedKm} مستخدم ← {row.mileageAllowanceKm} مجموعاً
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="mt-4 flex flex-wrap gap-3 border-t border-outline-variant/20 pt-4 text-[11px] font-bold uppercase tracking-wide">
                <span>{hasDocs ? "وثائق مكتملة" : "بحاجة لمستندات"}</span>
                <span className={hasInitialPaid ? "text-emerald-900" : "text-amber-900"}>
                  الدفع الأولى: {hasInitialPaid ? "مسدَّد تعريبي" : "بانتظار"}
                </span>
              </div>

              <div className="mt-4 grid gap-4 sm:flex sm:flex-wrap sm:items-end">
                <form action={approve} className={`flex gap-3 ${approveReady ? "" : "opacity-55"}`}>
                  <input type="hidden" name="subscriptionId" value={row.id} />
                  <button
                    disabled={!approveReady}
                    className="rounded-xl bg-emerald-600 px-5 py-2 text-[12px] font-black text-white disabled:opacity-40"
                  >
                    توثيق الموافقة
                  </button>
                </form>
                <form action={reject} className="flex flex-wrap gap-3">
                  <input type="hidden" name="subscriptionId" value={row.id} />
                  <input
                    placeholder="سبب الرفض"
                    name="reason"
                    className="min-w-[220px] flex-1 rounded-xl border px-3 py-2 text-[13px]"
                    required
                  />
                  <button type="submit" className="rounded-xl border border-red-300 px-4 py-2 text-[12px] font-black text-red-900">
                    رفض
                  </button>
                </form>
                <form action={suspend} className="flex flex-wrap gap-3">
                  <input type="hidden" name="subscriptionId" value={row.id} />
                  <input name="reason" placeholder="سبب التعليق" className="min-w-[200px] rounded-xl border px-3 py-2 text-[13px]" required />
                  <button type="submit" className="rounded-xl bg-amber-700 px-4 py-2 text-[11px] font-black text-white">تعليق</button>
                </form>
                <form action={revive}>
                  <input type="hidden" name="subscriptionId" value={row.id} />
                  <button type="submit" className="rounded-xl border px-4 py-2 text-[11px] font-black">رفع الإيقاف (نشط)</button>
                </form>
                <form action={expireNow}>
                  <input type="hidden" name="subscriptionId" value={row.id} />
                  <button type="submit" className="rounded-xl border px-4 py-2 text-[11px] font-black text-on-surface-variant">فرض الانتهاء</button>
                </form>
              </div>
            </article>
          );
        })}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-on-surface-variant">لا اشتراك مطابق لفلترة الحالية.</p>
      ) : null}
    </div>
  );
}
