import { redirect } from "next/navigation";
import { AdminStatisticsNav } from "@/components/admin/stats/AdminStatisticsNav";
import { verifyAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminStatisticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  return (
    <div className="pb-10">
      <AdminStatisticsNav />
      {children}
    </div>
  );
}
