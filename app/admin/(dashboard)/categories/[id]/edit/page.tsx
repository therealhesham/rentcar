import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin-auth";
import { CategoryEditForm } from "@/app/admin/(dashboard)/categories/[id]/edit/CategoryEditForm";
import { getFleetCategoryById } from "@/lib/fleet-category-data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditCategoryPage({ params }: Props) {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id) || id < 1) {
    notFound();
  }

  const category = await getFleetCategoryById(id);
  if (!category) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <Link
          href="/admin/categories"
          className="mb-3 inline-block text-sm font-bold text-primary hover:underline"
        >
          ← فئات الأسطول
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight">تعديل: {category.title}</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          مرتبطة بـ {category._count.models} موديل سيارة
        </p>
      </header>

      <CategoryEditForm category={category} />
    </div>
  );
}
