import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin-auth";
import { AdminAddCarForm } from "@/app/admin/AdminAddCarForm";
import { getFleetCategoriesForAdminSelect } from "@/lib/fleet-category-data";
import { getBrandsForAdminSelect } from "@/lib/brand-data";

export const dynamic = "force-dynamic";

export default async function AdminVehiclesNewPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const [categories, brands] = await Promise.all([
    getFleetCategoriesForAdminSelect().catch(() => []),
    getBrandsForAdminSelect().catch(() => []),
  ]);

  return (
    <>
      <header className="mb-8">
        <Link
          href="/admin/vehicles"
          className="mb-3 inline-block text-sm font-bold text-primary hover:underline"
        >
          ← المركبات والأسطول
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight">إضافة مركبة</h1>
        <p className="mt-2 text-on-surface-variant">
          أضف مركبة لتظهر في صفحة{" "}
          <Link href="/fleet" className="font-bold text-primary hover:underline">
            الأسطول
          </Link>
          .
        </p>
      </header>

      <AdminAddCarForm categories={categories} brands={brands} />
    </>
  );
}
