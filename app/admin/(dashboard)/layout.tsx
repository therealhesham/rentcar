import { AdminLayoutClient } from "@/components/admin/AdminLayoutClient";
import { getAdminNavGroupsForSession } from "@/lib/admin-access";
import { requireAdminPage } from "@/lib/admin-page";

export default async function AdminDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireAdminPage();
  const navGroups = getAdminNavGroupsForSession(session);

  return (
    <AdminLayoutClient session={session} navGroups={navGroups}>
      {children}
    </AdminLayoutClient>
  );
}
