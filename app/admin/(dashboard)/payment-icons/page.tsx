import { redirect } from "next/navigation";
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
      <header className="mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight">أيقونات وسائل الدفع</h1>
        <p className="mt-2 max-w-2xl text-on-surface-variant">
          تعديل شعارات تابي وتمارا والبطاقة ومدى وإمكان المعروضة في صفحة إتمام الدفع.
        </p>
      </header>

      <PaymentIconsEditForm current={icons} />
    </>
  );
}
