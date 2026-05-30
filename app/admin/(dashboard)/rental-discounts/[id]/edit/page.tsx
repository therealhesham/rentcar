import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RentalDiscountEditForm } from "@/app/admin/(dashboard)/rental-discounts/[id]/edit/RentalDiscountEditForm";
import { verifyAdminSession } from "@/lib/admin-auth";
import { getBrandsForAdminSelect } from "@/lib/brand-data";
import {
  getBranchesForDiscountSelect,
  getCarModelsForDiscountSelect,
  getRentalDiscountForAdminEdit,
} from "@/lib/rental-discount-admin-data";

export const dynamic = "force-dynamic";

export default async function AdminRentalDiscountEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id < 1) notFound();

  const [discount, brands, models, branches] = await Promise.all([
    getRentalDiscountForAdminEdit(id),
    getBrandsForAdminSelect(),
    getCarModelsForDiscountSelect(),
    getBranchesForDiscountSelect(),
  ]);

  if (!discount) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <Link
          href="/admin/rental-discounts"
          className="mb-3 inline-block text-sm font-bold text-primary hover:underline"
        >
          ← خصومات التأجير
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight">تعديل: {discount.labelAr}</h1>
      </header>
      <RentalDiscountEditForm discount={discount} brands={brands} models={models} branches={branches} />
    </div>
  );
}
