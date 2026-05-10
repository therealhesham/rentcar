import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RentalAddonEditForm } from "@/app/admin/(dashboard)/rental-addons/[id]/edit/RentalAddonEditForm";
import { verifyAdminSession } from "@/lib/admin-auth";
import { getRentalAddonById } from "@/lib/rental-addon-admin-data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditRentalAddonPage({ params }: Props) {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id) || id < 1) {
    notFound();
  }

  const addon = await getRentalAddonById(id);
  if (!addon) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <Link
          href="/admin/rental-addons"
          className="mb-3 inline-block text-sm font-bold text-primary hover:underline"
        >
          ← إضافات التأجير
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight">تعديل: {addon.titleAr}</h1>
        <p className="mt-2 text-sm text-on-surface-variant" dir="ltr">
          slug: <span className="font-mono">{addon.slug}</span>
        </p>
      </header>

      <RentalAddonEditForm addon={addon} />
    </div>
  );
}
