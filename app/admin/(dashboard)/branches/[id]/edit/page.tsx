import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { BranchEditForm } from "@/app/admin/(dashboard)/branches/[id]/edit/BranchEditForm";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AdminBranchEditPage({ params }: Props) {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isFinite(id) || id < 1) {
    notFound();
  }

  const branch = await prisma.branch.findUnique({ where: { id } }).catch(() => null);
  if (!branch) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-10">
        <Link
          href="/admin/branches"
          className="mb-3 inline-block text-sm font-bold text-primary hover:underline"
        >
          ← الفروع
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight">تعديل فرع</h1>
        <p className="mt-2 text-on-surface-variant">{branch.name}</p>
      </header>

      <BranchEditForm branch={branch} />
    </div>
  );
}
