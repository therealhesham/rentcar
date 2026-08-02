"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import { isKnownAdminPermission } from "@/lib/admin-permissions";
import { prisma } from "@/lib/prisma";

export type JobRoleActionState = { ok: boolean; error?: string };

/** slug مشتق من الاسم: لاتيني/أرقام فقط، وإلا مُعرّف زمني (الأسماء عربية غالباً). */
function slugFromName(name: string): string {
  const ascii = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return ascii || `role-${Date.now().toString(36)}`;
}

function readPermissions(formData: FormData): string[] {
  return [...new Set(formData.getAll("permissions").map(String))].filter(
    isKnownAdminPermission,
  );
}

export async function createAdminJobRole(
  _prev: JobRoleActionState | null,
  formData: FormData,
): Promise<JobRoleActionState> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "أدخل اسم الوظيفة." };

  const permissions = readPermissions(formData);

  try {
    await prisma.adminJobRole.create({
      data: {
        slug: slugFromName(name),
        name,
        permissionsJson: JSON.stringify(permissions),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "يوجد وظيفة بنفس المعرّف — غيّر الاسم قليلاً." };
    }
    throw err;
  }

  revalidatePath("/admin/job-roles");
  revalidatePath("/admin/employees");
  return { ok: true };
}

export async function updateAdminJobRole(
  _prev: JobRoleActionState | null,
  formData: FormData,
): Promise<JobRoleActionState> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const id = Number(formData.get("jobRoleId"));
  if (!Number.isInteger(id) || id < 1) {
    return { ok: false, error: "معرّف الوظيفة غير صالح." };
  }
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "أدخل اسم الوظيفة." };

  const row = await prisma.adminJobRole.findUnique({ where: { id }, select: { id: true } });
  if (!row) return { ok: false, error: "الوظيفة غير موجودة." };

  await prisma.adminJobRole.update({
    where: { id },
    data: { name, permissionsJson: JSON.stringify(readPermissions(formData)) },
  });

  revalidatePath("/admin/job-roles");
  revalidatePath("/admin/employees");
  return { ok: true };
}

export async function setAdminJobRoleActive(
  _prev: JobRoleActionState | null,
  formData: FormData,
): Promise<JobRoleActionState> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const id = Number(formData.get("jobRoleId"));
  const isActive = String(formData.get("isActive")) === "true";
  if (!Number.isInteger(id) || id < 1) {
    return { ok: false, error: "معرّف الوظيفة غير صالح." };
  }

  const row = await prisma.adminJobRole.findUnique({ where: { id }, select: { id: true } });
  if (!row) return { ok: false, error: "الوظيفة غير موجودة." };

  await prisma.adminJobRole.update({ where: { id }, data: { isActive } });

  revalidatePath("/admin/job-roles");
  revalidatePath("/admin/employees");
  return { ok: true };
}
