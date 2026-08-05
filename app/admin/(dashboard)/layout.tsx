import { AdminLayoutClient } from "@/components/admin/AdminLayoutClient";
import { getAdminNavGroupsForSession } from "@/lib/admin-access";
import { requireAdminPage } from "@/lib/admin-page";
import { getSiteBranding } from "@/lib/site-settings";

export default async function AdminDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireAdminPage();
  const navGroups = getAdminNavGroupsForSession(session);
  const branding = await getSiteBranding();

  return (
    <AdminLayoutClient session={session} navGroups={navGroups} branding={branding}>
      {children}
    </AdminLayoutClient>
  );
}
