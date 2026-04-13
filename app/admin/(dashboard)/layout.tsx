import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default function AdminDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col bg-surface text-on-surface md:flex-row">
      <AdminSidebar />
      <div className="flex min-h-screen flex-1 flex-col px-4 py-8 md:px-8 md:py-12">
        <div className="mx-auto w-full max-w-5xl flex-1">{children}</div>
      </div>
    </div>
  );
}
