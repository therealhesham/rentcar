import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin-auth";
import {
  getCustomerCancellationPolicyAr,
  getCustomerCancelMinHoursBeforePickup,
  getCustomerCancellationDeductTiers,
} from "@/lib/site-settings";
import { CancellationPolicyForm } from "./CancellationPolicyForm";

export const dynamic = "force-dynamic";

export default async function AdminCancellationPolicyPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const [policyAr, minHours, deductTiers] = await Promise.all([
    getCustomerCancellationPolicyAr(),
    getCustomerCancelMinHoursBeforePickup(),
    getCustomerCancellationDeductTiers(),
  ]);

  return (
    <>
      <header className="mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight">سياسات إلغاء الحجز للعملاء</h1>
        <p className="mt-2 max-w-2xl text-on-surface-variant">
          حدّد المهلة الزمنية التي يُسمح بموجبها للعميل بإلغاء حجزه من صفحة «حسابي» قبل موعد
          الاستلام، وشرائح خصم الأيام عند الإلغاء، واكتب نص السياسة الذي يظهر له عند التأكيد.
          خارج مهلة الإلغاء الذاتي يُرفض الإلغاء آلياً ويُرشد للتواصل معكم.
        </p>
      </header>

      <CancellationPolicyForm
        policyAr={policyAr}
        minHoursBeforePickup={minHours}
        deductTiers={deductTiers}
      />
    </>
  );
}
