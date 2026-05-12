import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminCorporateLeadsPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const rows = await prisma.corporateBookingLead.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <>
      <header className="mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight">طلبات حجز الشركات</h1>
        <p className="mt-2 max-w-2xl text-on-surface-variant">
          طلبات التواصل المرسلة من الصفحة الرئيسية (نموذج الشركات). تواصل مع العميل عبر الجوال أو
          البريد المذكورين.
        </p>
        <p className="mt-3 text-sm text-on-surface-variant">
          <Link href="/admin" className="font-bold text-primary hover:underline">
            العودة للوحة التحكم
          </Link>
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-outline-variant/30 bg-surface-container-low px-5 py-6 text-sm text-on-surface-variant">
          لا توجد طلبات بعد.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4 md:p-5">
          <table className="w-full min-w-[720px] text-start text-sm">
            <thead>
              <tr className="border-b border-outline-variant/30 text-on-surface-variant">
                <th className="px-3 py-2">التاريخ</th>
                <th className="px-3 py-2">الشركة</th>
                <th className="px-3 py-2">البريد</th>
                <th className="px-3 py-2">الرقم الضريبي</th>
                <th className="px-3 py-2">الجوال</th>
                <th className="px-3 py-2">التفاصيل</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-outline-variant/15 align-top">
                  <td className="px-3 py-3 whitespace-nowrap tabular-nums text-on-surface-variant" dir="ltr">
                    {r.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  </td>
                  <td className="px-3 py-3 font-medium">{r.companyName}</td>
                  <td className="px-3 py-3" dir="ltr">
                    <a
                      href={`mailto:${encodeURIComponent(r.companyEmail)}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {r.companyEmail}
                    </a>
                  </td>
                  <td className="px-3 py-3 tabular-nums" dir="ltr">
                    {r.taxNumber}
                  </td>
                  <td className="px-3 py-3 tabular-nums" dir="ltr">
                    <a href={`tel:${r.phone.replace(/\s/g, "")}`} className="text-primary hover:underline">
                      {r.phone}
                    </a>
                  </td>
                  <td className="max-w-md px-3 py-3 text-on-surface-variant whitespace-pre-wrap">
                    {r.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
