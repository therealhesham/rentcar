"use server";

import { revalidatePath } from "next/cache";
import { requireAdminForAction } from "@/lib/admin-access";
import { upsertBranchFleetQuantity } from "@/lib/fleet-branch-stock";
import { prisma } from "@/lib/prisma";

export async function updateBranchFleetQuantity(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const modelId = Number(formData.get("modelId"));
  const quantity = Number(formData.get("quantity"));

  if (!Number.isInteger(modelId) || modelId < 1) {
    return { ok: false, error: "معرّف المركبة غير صالح." };
  }
  if (!Number.isFinite(quantity) || quantity < 0 || quantity > 500) {
    return { ok: false, error: "الكمية يجب أن تكون بين 0 و 500." };
  }

  let branchId: number | null = null;
  if (auth.session.isSuperAdmin) {
    const raw = Number(formData.get("branchId"));
    if (Number.isInteger(raw) && raw > 0) branchId = raw;
  } else if (auth.session.branchId) {
    branchId = auth.session.branchId;
  }

  if (!branchId) {
    return { ok: false, error: "حسابك غير مرتبط بفرع." };
  }

  const model = await prisma.carModel.findUnique({
    where: { id: modelId },
    select: { id: true },
  });
  if (!model) {
    return { ok: false, error: "المركبة غير موجودة." };
  }

  await upsertBranchFleetQuantity({
    branchId,
    modelId,
    quantity: Math.round(quantity),
  });

  revalidatePath("/admin/vehicles");
  revalidatePath("/admin/fleet-availability");
  revalidatePath("/admin/direct-booking");
  revalidatePath("/fleet");
  revalidatePath("/");

  return { ok: true };
}
