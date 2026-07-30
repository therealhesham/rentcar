import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CouponCodeEditForm } from "@/app/admin/(dashboard)/coupon-codes/[id]/edit/CouponCodeEditForm";
import { verifyAdminSession } from "@/lib/admin-auth";
import { getCouponCodeForAdminEdit } from "@/lib/coupon-code-admin-data";

export const dynamic = "force-dynamic";

export default async function AdminCouponCodeEditPage({
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

  const coupon = await getCouponCodeForAdminEdit(id);
  if (!coupon) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <Link
          href="/admin/coupon-codes"
          className="mb-3 inline-block text-sm font-bold text-primary hover:underline"
        >
          ← أكواد الخصم
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight">تعديل: {coupon.code}</h1>
      </header>
      <CouponCodeEditForm coupon={coupon} />
    </div>
  );
}
