import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin-auth";
import { AdminEditCarForm } from "@/app/admin/AdminEditCarForm";
import { getFleetVehicleForAdminEdit } from "@/lib/fleet-vehicle-admin-data";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ modelId: string }>;
};

export default async function AdminVehicleEditPage({ params }: PageProps) {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const { modelId: raw } = await params;
  const id = Number(raw);
  if (!Number.isFinite(id) || id < 1) {
    notFound();
  }

  const vehicle = await getFleetVehicleForAdminEdit(id);
  if (!vehicle) {
    notFound();
  }

  return (
    <>
      <header className="mb-8">
        <Link
          href="/admin/vehicles"
          className="mb-3 inline-block text-sm font-bold text-primary hover:underline"
        >
          ← المركبات والأسطول
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight">تعديل مركبة</h1>
        <p className="mt-2 text-on-surface-variant">
          التغييرات تنعكس مباشرة على{" "}
          <Link href="/fleet" className="font-bold text-primary hover:underline">
            صفحة الأسطول
          </Link>
          .
        </p>
      </header>

      <AdminEditCarForm vehicle={vehicle} />
    </>
  );
}
