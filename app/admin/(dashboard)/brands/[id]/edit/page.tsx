import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin-auth";
import { BrandEditForm } from "./BrandEditForm";
import { getBrandForAdminEdit } from "@/lib/brand-data";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminBrandEditPage({ params }: Props) {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isFinite(id) || id < 1) {
    notFound();
  }

  const brand = await getBrandForAdminEdit(id);
  if (!brand) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl" dir="rtl">
      <header className="mb-8">
        <Link
          href="/admin/brands"
          className="mb-3 inline-block text-sm font-bold text-primary hover:underline"
        >
          ← البراندات
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight">تعديل البراند: {brand.name}</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          المركبات المرتبطة بهذا البراند: {brand._count.models} سيارات.
        </p>
      </header>

      <BrandEditForm brand={brand} />
    </div>
  );
}
