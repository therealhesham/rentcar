"use server";

import { revalidatePath } from "next/cache";
import { requireAdminForAction } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";

function revalidateAll() {
  revalidatePath("/admin/fleet-visibility");
  revalidatePath("/fleet");
  revalidatePath("/");
}

export async function updateFleetVisibility(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const fleetId = Number(formData.get("fleetId"));
  const isVisible = formData.get("isVisible") === "true";

  if (!Number.isInteger(fleetId) || fleetId < 1) {
    return { ok: false, error: "معرّف الأسطول غير صالح." };
  }

  const fleet = await prisma.fleet.findUnique({
    where: { id: fleetId },
    select: { id: true, branchId: true },
  });
  if (!fleet) return { ok: false, error: "السجل غير موجود." };

  if (!auth.session.isSuperAdmin && auth.session.branchId !== fleet.branchId) {
    return { ok: false, error: "لا تملك صلاحية تعديل هذا الفرع." };
  }

  await prisma.fleet.update({
    where: { id: fleetId },
    data: { isVisible },
  });

  revalidateAll();
  return { ok: true };
}

export async function updateFleetDisplayOrder(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const fleetId = Number(formData.get("fleetId"));
  const direction = formData.get("direction") as "up" | "down" | null;

  if (!Number.isInteger(fleetId) || fleetId < 1) {
    return { ok: false, error: "معرّف الأسطول غير صالح." };
  }
  if (direction !== "up" && direction !== "down") {
    return { ok: false, error: "اتجاه غير صالح." };
  }

  // الـ fleetId هنا يُستخدم لجلب modelId فقط
  const fleetRow = await prisma.fleet.findUnique({
    where: { id: fleetId },
    select: { modelId: true, branchId: true },
  });
  if (!fleetRow) return { ok: false, error: "السجل غير موجود." };

  if (!auth.session.isSuperAdmin && auth.session.branchId !== fleetRow.branchId) {
    return { ok: false, error: "لا تملك صلاحية تعديل هذا الفرع." };
  }

  const modelId = fleetRow.modelId;

  // جلب كل الموديلات المرتّبة بنفس ترتيب العميل (بدون تكرار)
  const allModels = await prisma.carModel.findMany({
    where: { fleetItems: { some: { quantity: { gt: 0 } } } },
    select: { id: true },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
  });

  const modelIds = allModels.map((m) => m.id);
  const pos = modelIds.indexOf(modelId);
  if (pos === -1) return { ok: false, error: "الموديل غير موجود في الترتيب." };

  const targetPos = direction === "up" ? pos - 1 : pos + 1;
  if (targetPos < 0 || targetPos >= modelIds.length) {
    return { ok: true };
  }

  // تبادل موضعَي الموديلَين ثم إعادة كتابة displayOrder بقيم 0,1,2,...
  [modelIds[pos], modelIds[targetPos]] = [modelIds[targetPos], modelIds[pos]];

  await prisma.$transaction(
    modelIds.map((id, idx) =>
      prisma.carModel.update({ where: { id }, data: { displayOrder: idx } }),
    ),
  );

  revalidateAll();
  return { ok: true };
}
