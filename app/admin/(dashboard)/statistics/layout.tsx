import { AdminStatisticsNav } from "@/components/admin/stats/AdminStatisticsNav";
import { requireAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminStatisticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdminPage();

  return (
    <div className="pb-10">
      <AdminStatisticsNav isSuperAdmin={session.isSuperAdmin} />
      {children}
    </div>
  );
}
