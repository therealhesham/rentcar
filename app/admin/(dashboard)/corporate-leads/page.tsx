import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import {
  Building2,
  Mail,
  Phone,
  Hash,
  CalendarDays,
  FileText,
  ArrowRight,
  Inbox,
} from "lucide-react";
import { DetailsModal } from "./DetailsModal";

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
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header Section */}
      <header className="relative overflow-hidden rounded-3xl bg-surface-container p-8 shadow-sm border border-outline-variant/30">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-primary/10 text-primary rounded-xl">
                <Building2 className="w-6 h-6" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">
                طلبات حجز الشركات
              </h1>
            </div>
            <p className="mt-2 max-w-2xl text-on-surface-variant leading-relaxed">
              طلبات التواصل المرسلة من الصفحة الرئيسية (نموذج الشركات). تواصل مع العميل عبر الجوال أو
              البريد المذكورين.
            </p>
          </div>
          <Link
            href="/admin"
            className="group flex items-center gap-2 rounded-xl bg-surface-container-high px-5 py-3 text-sm font-semibold text-primary transition-all hover:bg-primary hover:text-on-primary hover:shadow-md"
          >
            العودة للوحة التحكم
            <ArrowRight className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          </Link>
        </div>
        
        {/* Decorative background elements */}
        <div className="absolute top-0 end-0 -translate-y-1/2 translate-x-1/3 opacity-10 pointer-events-none">
          <Building2 className="w-64 h-64" />
        </div>
      </header>

      {/* Main Content */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-outline-variant/30 bg-surface-container p-12 text-center shadow-sm">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-container-highest/50 mb-4 text-on-surface-variant/50">
            <Inbox className="h-10 w-10" />
          </div>
          <h3 className="text-lg font-bold text-on-surface mb-2">لا توجد طلبات بعد</h3>
          <p className="text-sm text-on-surface-variant max-w-sm">
            لم يقم أي عميل بإرسال طلب حجز شركات حتى الآن. ستظهر الطلبات الجديدة هنا فور وصولها.
          </p>
        </div>
      ) : (
        <div className="rounded-3xl border border-outline-variant/30 bg-surface-container shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead>
                <tr className="bg-surface-container-high text-on-surface-variant border-b border-outline-variant/20">
                  <th className="px-6 py-4 font-semibold whitespace-nowrap text-start">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 opacity-70" />
                      التاريخ
                    </div>
                  </th>
                  <th className="px-6 py-4 font-semibold whitespace-nowrap text-start">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 opacity-70" />
                      الشركة
                    </div>
                  </th>
                  <th className="px-6 py-4 font-semibold whitespace-nowrap text-start">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 opacity-70" />
                      البريد
                    </div>
                  </th>
                  <th className="px-6 py-4 font-semibold whitespace-nowrap text-start">
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 opacity-70" />
                      الرقم الضريبي
                    </div>
                  </th>
                  <th className="px-6 py-4 font-semibold whitespace-nowrap text-start">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 opacity-70" />
                      الجوال
                    </div>
                  </th>
                  <th className="px-6 py-4 font-semibold whitespace-nowrap text-start">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 opacity-70" />
                      التفاصيل
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {rows.map((r) => (
                  <tr 
                    key={r.id} 
                    className="group align-middle transition-all duration-200 hover:bg-surface-container-highest/30"
                  >
                    <td className="px-6 py-4 whitespace-nowrap tabular-nums text-on-surface-variant">
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-medium text-on-surface">
                          {r.createdAt.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-xs text-on-surface-variant/70" dir="ltr">
                          {r.createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute:'2-digit' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-on-surface">
                      {r.companyName}
                    </td>
                    <td className="px-6 py-4">
                      <a
                        href={`mailto:${encodeURIComponent(r.companyEmail)}`}
                        className="inline-flex items-center gap-2 font-medium text-primary hover:text-primary/90 transition-all bg-primary/5 hover:bg-primary/10 px-3 py-2 rounded-xl border border-primary/10 shadow-sm"
                        dir="ltr"
                      >
                        <Mail className="w-4 h-4" />
                        <span className="truncate max-w-[200px]">{r.companyEmail}</span>
                      </a>
                    </td>
                    <td className="px-6 py-4 font-medium text-on-surface-variant">
                      <span className="tabular-nums bg-surface-container-high px-2.5 py-1 rounded-md text-xs border border-outline-variant/20" dir="ltr">
                        {r.taxNumber || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <a 
                        href={`tel:${r.phone.replace(/\s/g, "")}`} 
                        className="inline-flex items-center gap-2 font-medium text-primary hover:text-primary/90 transition-all bg-primary/5 hover:bg-primary/10 px-3 py-2 rounded-xl border border-primary/10 shadow-sm"
                        dir="ltr"
                      >
                        <Phone className="w-4 h-4" />
                        <span className="tabular-nums">{r.phone}</span>
                      </a>
                    </td>
                    <td className="max-w-md px-6 py-4">
                      <DetailsModal details={r.details} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
