import Link from "next/link";
import { redirect } from "next/navigation";
import { CouponCodeCreateForm } from "@/app/admin/(dashboard)/coupon-codes/CouponCodeCreateForm";
import { CouponCodeDeleteForm } from "@/app/admin/(dashboard)/coupon-codes/CouponCodeDeleteForm";
import { verifyAdminSession } from "@/lib/admin-auth";
import { getCouponCodesForAdmin, type CouponCodeAdminRow } from "@/lib/coupon-code-admin-data";

export const dynamic = "force-dynamic";

function formatValue(kind: string, value: number): string {
  return kind === "PERCENT" ? `${value}%` : `${value} ر.س`;
}

function formatScope(scope: string): string {
  return scope === "RENTAL_ONLY" ? "الإيجار فقط" : "الإجمالي كامل";
}

function formatPeriod(row: Pick<CouponCodeAdminRow, "startsAt" | "endsAt">): string {
  if (!row.startsAt && !row.endsAt) return "بدون تقييد زمني";
  const from = row.startsAt ? row.startsAt.toISOString().slice(0, 10) : "—";
  const to = row.endsAt ? row.endsAt.toISOString().slice(0, 10) : "—";
  return `${from} → ${to}`;
}

function couponStatusLabel(row: CouponCodeAdminRow, now: Date): { text: string; cls: string } {
  if (!row.isActive) {
    return { text: "معطّل", cls: "bg-outline-variant/40 text-on-surface-variant" };
  }
  if (row.startsAt && now.getTime() < row.startsAt.getTime()) {
    return { text: "لم يبدأ بعد", cls: "bg-primary-container/30 text-on-primary-container" };
  }
  if (row.endsAt && now.getTime() > row.endsAt.getTime()) {
    return { text: "منتهي", cls: "bg-error/10 text-error" };
  }
  if (row.maxUses != null && row.usesCount >= row.maxUses) {
    return { text: "نفد الاستخدام", cls: "bg-error/10 text-error" };
  }
  return { text: "نشط", cls: "bg-primary-container/50 text-on-primary-container" };
}

export default async function AdminCouponCodesPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const coupons = await getCouponCodesForAdmin();
  const now = new Date();

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-10">
        <Link href="/admin" className="mb-3 inline-block text-sm font-bold text-primary hover:underline">
          ← لوحة التحكم
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight">أكواد الخصم</h1>
        <p className="mt-2 text-on-surface-variant">
          أكواد يدخلها العميل بنفسه في صفحة الدفع. عند استخدام كود صالح يحلّ محلّ أي خصم تلقائي على
          السيارة. تحكّم في الفترة وعدد الاستخدامات من هنا، وتابع مين استخدم كل كود من صفحة الاستخدامات.
        </p>
      </header>

      <CouponCodeCreateForm />

      <div className="overflow-x-auto rounded-2xl border border-outline-variant/30 bg-surface-container-low">
        <table className="w-full min-w-[920px] text-start text-sm">
          <thead>
            <tr className="border-b border-outline-variant/40 bg-surface-container/80">
              <th className="px-4 py-3 font-bold">الكود</th>
              <th className="px-4 py-3 font-bold">الخصم</th>
              <th className="px-4 py-3 font-bold">النطاق</th>
              <th className="px-4 py-3 font-bold">الفترة</th>
              <th className="px-4 py-3 font-bold">الاستخدام</th>
              <th className="px-4 py-3 font-bold">الحالة</th>
              <th className="px-4 py-3 font-bold">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {coupons.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-on-surface-variant">
                  لا توجد أكواد بعد.
                </td>
              </tr>
            ) : (
              coupons.map((c) => {
                const status = couponStatusLabel(c, now);
                return (
                  <tr key={c.id} className="border-b border-outline-variant/20 last:border-0">
                    <td className="px-4 py-3 font-mono font-bold tabular-nums" dir="ltr">
                      {c.code}
                    </td>
                    <td className="px-4 py-3 tabular-nums" dir="ltr">
                      {formatValue(c.kind, c.value)}
                    </td>
                    <td className="px-4 py-3 text-xs text-on-surface-variant">{formatScope(c.scope)}</td>
                    <td className="px-4 py-3 text-xs text-on-surface-variant">{formatPeriod(c)}</td>
                    <td className="px-4 py-3 tabular-nums" dir="ltr">
                      {c.usesCount}
                      {c.maxUses != null ? ` / ${c.maxUses}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${status.cls}`}>
                        {status.text}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <Link
                          href={`/admin/coupon-codes/${c.id}/edit`}
                          className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-container"
                        >
                          تعديل
                        </Link>
                        <Link
                          href={`/admin/coupon-codes/${c.id}/redemptions`}
                          className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-container"
                        >
                          الاستخدامات
                        </Link>
                        <CouponCodeDeleteForm id={c.id} code={c.code} />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
