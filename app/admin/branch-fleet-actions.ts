"use server";

import { revalidatePath } from "next/cache";
import { requireAdminForAction } from "@/lib/admin-access";
import { adminScope, scopedBranchIds } from "@/lib/admin-scope";
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
    return { ok: false, error: "معرّف السيارة غير صالح." };
  }
  if (!Number.isFinite(quantity) || quantity < 0 || quantity > 500) {
    return { ok: false, error: "الكمية يجب أن تكون بين 0 و 500." };
  }

  // سعر الفرع اليومي (دون ضريبة): حقل اختياري — فارغ = مسح التجاوز والرجوع لسعر الموديل.
  const priceRaw = formData.get("branchPrice");
  let pricePerDayExclTax: number | null | undefined = undefined;
  if (priceRaw != null) {
    const trimmed = String(priceRaw).trim();
    if (trimmed === "") {
      pricePerDayExclTax = null;
    } else {
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100000) {
        return { ok: false, error: "سعر الفرع اليومي غير صالح." };
      }
      pricePerDayExclTax = parsed;
    }
  }

  // سعر الفرع الشهري (دون ضريبة): حقل اختياري — فارغ = مسح التجاوز والرجوع للسعر الشهري الأساسي.
  const monthlyPriceRaw = formData.get("branchMonthlyPrice");
  let priceMonthlyExclTax: number | null | undefined = undefined;
  if (monthlyPriceRaw != null) {
    const trimmed = String(monthlyPriceRaw).trim();
    if (trimmed === "") {
      priceMonthlyExclTax = null;
    } else {
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1000000) {
        return { ok: false, error: "سعر الفرع الشهري غير صالح." };
      }
      priceMonthlyExclTax = parsed;
    }
  }

  // فرع واحد في النطاق ⇒ مقفول عليه؛ نطاق أوسع ⇒ الفرع يأتي من الفورم ويُتحقق منه.
  const scope = adminScope(auth.session);
  const allowedBranchIds = await scopedBranchIds(scope);
  let branchId: number | null =
    allowedBranchIds?.length === 1 ? allowedBranchIds[0]! : null;
  if (branchId == null) {
    const raw = Number(formData.get("branchId"));
    if (Number.isInteger(raw) && raw > 0) branchId = raw;
  }

  if (!branchId) {
    return { ok: false, error: "اختر الفرع." };
  }
  if (allowedBranchIds != null && !allowedBranchIds.includes(branchId)) {
    return { ok: false, error: "الفرع خارج نطاق حسابك." };
  }

  const model = await prisma.carModel.findUnique({
    where: { id: modelId },
    select: { id: true },
  });
  if (!model) {
    return { ok: false, error: "السيارة غير موجودة." };
  }

  await upsertBranchFleetQuantity({
    branchId,
    modelId,
    quantity: Math.round(quantity),
    pricePerDayExclTax,
    priceMonthlyExclTax,
  });

  revalidatePath("/admin/vehicles");
  revalidatePath("/admin/fleet-availability");
  revalidatePath("/admin/direct-booking");
  revalidatePath("/fleet");
  revalidatePath("/");

  return { ok: true };
}
