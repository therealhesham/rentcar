import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/home/SiteFooter";
import { SiteNav } from "@/components/shared/SiteNav";
import { CustomerAccountView } from "@/components/account/CustomerAccountView";
import { getCustomerProfile } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

/**
 * محتوى الصفحة كله في `CustomerAccountView` — نفس المكوّن تعرضه معاينة الموظف
 * `/admin/clientaccount/[userId]` للعرض فقط، فأي تعديل هنا يظهر هناك تلقائياً.
 */
export default async function AccountDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const profile = await getCustomerProfile();
  if (!profile) redirect("/account/login");

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f4f5] text-on-surface" dir="rtl">
      <SiteNav active="home" />
      <main className="mx-auto w-full max-w-screen-xl flex-1 px-4 pb-16 pt-28 sm:px-6">
        <CustomerAccountView profile={profile} locale={locale} />
      </main>
      <SiteFooter />
    </div>
  );
}
