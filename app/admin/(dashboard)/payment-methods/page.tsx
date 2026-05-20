import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { verifyAdminSession } from "@/lib/admin-auth";
import { getCheckoutPaymentMethodFlags } from "@/lib/site-settings";
import { CheckoutPaymentMethodsForm } from "./CheckoutPaymentMethodsForm";

export const dynamic = "force-dynamic";

export default async function AdminCheckoutPaymentMethodsPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const flags = await getCheckoutPaymentMethodFlags();

  return (
    <>
      <AdminPageHeader
        title="طرق دفع العميل"
        description="اختر ما يظهر في صفحة إتمام الدفع بعد الحجز. الطرق المعطّلة لا تُعرض للزائر — دون إشعار مزعج."
        backHref="/admin"
        backLabel="لوحة التحكم"
      />

      <CheckoutPaymentMethodsForm key={JSON.stringify(flags)} flags={flags} />
    </>
  );
}
