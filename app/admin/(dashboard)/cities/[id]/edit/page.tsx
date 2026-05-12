import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { CityEditForm } from "@/app/admin/(dashboard)/cities/[id]/edit/CityEditForm";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AdminCityEditPage({ params }: Props) {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isFinite(id) || id < 1) {
    notFound();
  }

  const city = await prisma.city.findUnique({ where: { id } }).catch(() => null);
  if (!city) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-10">
        <Link
          href="/admin/cities"
          className="mb-3 inline-block text-sm font-bold text-primary hover:underline"
        >
          ← المدن
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight">تعديل مدينة</h1>
        <p className="mt-2 text-on-surface-variant">{city.name}</p>
      </header>

      <CityEditForm city={city} />
    </div>
  );
}
