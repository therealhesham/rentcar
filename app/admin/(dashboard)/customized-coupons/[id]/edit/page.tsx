import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CustomizedCouponEditForm } from "@/app/admin/(dashboard)/customized-coupons/[id]/edit/CustomizedCouponEditForm";
import { verifyAdminSession } from "@/lib/admin-auth";
import { getCustomizedCouponForAdminEdit } from "@/lib/customized-coupon-admin-data";

export const dynamic = "force-dynamic";

export default async function AdminCustomizedCouponEditPage({
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

  const coupon = await getCustomizedCouponForAdminEdit(id);
  if (!coupon) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <Link
          href="/admin/customized-coupons"
          className="mb-3 inline-block text-sm font-bold text-primary hover:underline"
        >
          ← أكواد الخصم المخصَّصة
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight">تعديل: {coupon.code}</h1>
      </header>
      <CustomizedCouponEditForm coupon={coupon} />
    </div>
  );
}
