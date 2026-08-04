import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { verifyAdminSession } from "@/lib/admin-auth";
import { getPaymentIconUrls } from "@/lib/site-settings";
import { PaymentIconsEditForm } from "./PaymentIconsEditForm";

export const dynamic = "force-dynamic";

export default async function AdminPaymentIconsPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const icons = await getPaymentIconUrls();

  return (
    <>
      <AdminPageHeader
        title="أيقونات وسائل الدفع"
        description="تعديل شعارات تابي وتمارا والبطاقة ومدى وإمكان المعروضة في صفحة إتمام الدفع."
        backHref="/admin"
      />

      <PaymentIconsEditForm current={icons} />
    </>
  );
}
