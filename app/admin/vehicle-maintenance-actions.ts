"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdminForAction } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { isMaintenanceKind, isMaintenanceStatus } from "@/lib/vehicle-maintenance-labels";
import { vehicleUnitStatusLabelAr } from "@/lib/vehicle-unit-labels";

export type MaintenanceActionResult = {
  ok: boolean;
  error?: string;
  /** رسالة إرشادية تُعرض بعد نجاح العملية (مثل تعذّر تغيير حالة مركبة مؤجرة). */
  warning?: string;
};

/** تحويل قيمة `<input type="date">` إلى تاريخ UTC عند منتصف الليل (بلا انزلاق منطقة زمنية). */
function parseDateInput(raw: FormDataEntryValue | null): Date | null {
  const value = String(raw ?? "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseOptionalNumber(raw: FormDataEntryValue | null): number | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseOptionalInt(raw: FormDataEntryValue | null): number | null {
  const n = parseOptionalNumber(raw);
  return n === null ? null : Math.round(n);
}

function optionalText(raw: FormDataEntryValue | null): string | null {
  return String(raw ?? "").trim() || null;
}

function revalidateUnit(unitId: number) {
  revalidatePath("/admin/vehicle-units");
  revalidatePath(`/admin/vehicle-units/${unitId}`);
}

/**
 * مزامنة حالة المركبة مع سجلات صيانتها:
 * وجود عملية جارية ⇒ «في الصيانة»، وانتهاء آخر عملية ⇒ رجوعها «متاحة».
 * لا نلمس المركبات المؤجرة أو غير المفعّلة حتى لا نكسر دورة حياة حجز قائم.
 */
async function syncUnitStatusWithMaintenance(
  tx: Prisma.TransactionClient,
  unitId: number,
): Promise<string | undefined> {
  const unit = await tx.vehicleUnit.findUnique({
    where: { id: unitId },
    select: { status: true },
  });
  if (!unit) return undefined;

  const openCount = await tx.vehicleMaintenanceLog.count({
    where: { vehicleUnitId: unitId, status: "IN_PROGRESS" },
  });

  if (openCount > 0) {
    if (unit.status === "MAINTENANCE") return undefined;
    if (unit.status !== "AVAILABLE") {
      return `تم حفظ سجل الصيانة، لكن حالة المركبة بقيت «${vehicleUnitStatusLabelAr(unit.status)}» — غيّرها يدوياً عند الحاجة.`;
    }
    await tx.vehicleUnit.update({ where: { id: unitId }, data: { status: "MAINTENANCE" } });
    return undefined;
  }

  if (unit.status === "MAINTENANCE") {
    await tx.vehicleUnit.update({ where: { id: unitId }, data: { status: "AVAILABLE" } });
  }
  return undefined;
}

/** قراءة حقول نموذج الصيانة المشتركة بين الإنشاء والتعديل. */
function readMaintenanceForm(formData: FormData) {
  const kind = String(formData.get("kind") ?? "").trim().toUpperCase();
  const status = String(formData.get("status") ?? "IN_PROGRESS").trim().toUpperCase();
  const description = String(formData.get("description") ?? "").trim();
  const startedAt = parseDateInput(formData.get("startedAt"));
  const completedAt = parseDateInput(formData.get("completedAt"));
  const branchId = parseOptionalInt(formData.get("branchId"));

  if (!isMaintenanceKind(kind)) return { error: "يرجى اختيار نوع الصيانة." } as const;
  if (!isMaintenanceStatus(status)) return { error: "حالة الصيانة غير صالحة." } as const;
  if (!description) return { error: "يرجى كتابة وصف العمل المنفَّذ." } as const;
  if (!startedAt) return { error: "يرجى تحديد تاريخ دخول المركبة للصيانة." } as const;
  if (completedAt && completedAt.getTime() < startedAt.getTime()) {
    return { error: "تاريخ الانتهاء لا يمكن أن يسبق تاريخ الدخول." } as const;
  }
  if (status === "COMPLETED" && !completedAt) {
    return { error: "يرجى تحديد تاريخ الانتهاء عند إغلاق عملية الصيانة." } as const;
  }

  return {
    data: {
      kind,
      status,
      description,
      startedAt,
      // العملية الجارية لا يكون لها تاريخ انتهاء حتى لو أُدخل بالخطأ.
      completedAt: status === "IN_PROGRESS" ? null : completedAt,
      costSar: parseOptionalNumber(formData.get("costSar")),
      vendorName: optionalText(formData.get("vendorName")),
      invoiceRef: optionalText(formData.get("invoiceRef")),
      odometerKm: parseOptionalInt(formData.get("odometerKm")),
      nextDueDate: parseDateInput(formData.get("nextDueDate")),
      nextDueOdometerKm: parseOptionalInt(formData.get("nextDueOdometerKm")),
      branchId: branchId && branchId > 0 ? branchId : null,
    },
  } as const;
}

export async function createMaintenanceLogAction(
  _prev: MaintenanceActionResult | null,
  formData: FormData,
): Promise<MaintenanceActionResult> {
  const auth = await requireAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const unitId = Number(formData.get("vehicleUnitId"));
  if (!Number.isInteger(unitId) || unitId < 1) {
    return { ok: false, error: "معرّف المركبة غير صالح." };
  }

  const parsed = readMaintenanceForm(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  try {
    const warning = await prisma.$transaction(async (tx) => {
      await tx.vehicleMaintenanceLog.create({
        data: {
          ...parsed.data,
          vehicleUnitId: unitId,
          createdBy: auth.session.displayName,
        },
      });
      return syncUnitStatusWithMaintenance(tx, unitId);
    });

    revalidateUnit(unitId);
    return { ok: true, warning };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "حدث خطأ غير متوقع.";
    return { ok: false, error: msg };
  }
}

export async function updateMaintenanceLogAction(
  _prev: MaintenanceActionResult | null,
  formData: FormData,
): Promise<MaintenanceActionResult> {
  const auth = await requireAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const logId = Number(formData.get("logId"));
  if (!Number.isInteger(logId) || logId < 1) {
    return { ok: false, error: "معرّف سجل الصيانة غير صالح." };
  }

  const parsed = readMaintenanceForm(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  try {
    const existing = await prisma.vehicleMaintenanceLog.findUnique({
      where: { id: logId },
      select: { vehicleUnitId: true },
    });
    if (!existing) return { ok: false, error: "سجل الصيانة غير موجود." };

    const warning = await prisma.$transaction(async (tx) => {
      await tx.vehicleMaintenanceLog.update({ where: { id: logId }, data: parsed.data });
      return syncUnitStatusWithMaintenance(tx, existing.vehicleUnitId);
    });

    revalidateUnit(existing.vehicleUnitId);
    return { ok: true, warning };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "حدث خطأ غير متوقع.";
    return { ok: false, error: msg };
  }
}

/** إغلاق عملية صيانة جارية بتاريخ اليوم (اختصار من سجل السيارة). */
export async function completeMaintenanceLogAction(
  logId: number,
): Promise<MaintenanceActionResult> {
  const auth = await requireAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  try {
    const existing = await prisma.vehicleMaintenanceLog.findUnique({
      where: { id: logId },
      select: { vehicleUnitId: true, status: true, startedAt: true },
    });
    if (!existing) return { ok: false, error: "سجل الصيانة غير موجود." };
    if (existing.status !== "IN_PROGRESS") {
      return { ok: false, error: "هذه العملية مغلقة بالفعل." };
    }

    const now = new Date();
    const warning = await prisma.$transaction(async (tx) => {
      await tx.vehicleMaintenanceLog.update({
        where: { id: logId },
        data: {
          status: "COMPLETED",
          // لا نسمح بتاريخ انتهاء يسبق تاريخ الدخول (سجل مؤرَّخ في المستقبل).
          completedAt: now.getTime() < existing.startedAt.getTime() ? existing.startedAt : now,
        },
      });
      return syncUnitStatusWithMaintenance(tx, existing.vehicleUnitId);
    });

    revalidateUnit(existing.vehicleUnitId);
    return { ok: true, warning };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "حدث خطأ غير متوقع.";
    return { ok: false, error: msg };
  }
}

export async function deleteMaintenanceLogAction(
  logId: number,
): Promise<MaintenanceActionResult> {
  const auth = await requireAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  try {
    const existing = await prisma.vehicleMaintenanceLog.findUnique({
      where: { id: logId },
      select: { vehicleUnitId: true },
    });
    if (!existing) return { ok: false, error: "سجل الصيانة غير موجود." };

    const warning = await prisma.$transaction(async (tx) => {
      await tx.vehicleMaintenanceLog.delete({ where: { id: logId } });
      return syncUnitStatusWithMaintenance(tx, existing.vehicleUnitId);
    });

    revalidateUnit(existing.vehicleUnitId);
    return { ok: true, warning };
  } catch {
    return { ok: false, error: "تعذّر حذف سجل الصيانة." };
  }
}
