"use server";

import { revalidatePath } from "next/cache";
import { requireAdminForAction } from "@/lib/admin-access";
import { buildBranchResolver } from "@/lib/branch-name-resolver";
import {
  MAX_FLEET_QUANTITY,
  parseFleetRowKey,
  toAsciiDigits,
} from "@/lib/fleet-quantity-import";
import { prisma } from "@/lib/prisma";
import type { ImportRow } from "@/lib/vehicle-import-excel";

export type { ImportRow } from "@/lib/vehicle-import-excel";

/** أعمدة الملف المربوطة بحقول المطابقة — كلها اختيارية عدا الكمية. */
export type QuantityMapping = {
  /** عمود المعرّف في القالب (`modelId-branchId`) — أدق طريق للمطابقة. */
  key?: string;
  branch?: string;
  brand?: string;
  model?: string;
  year?: string;
  quantity?: string;
};

export type QuantityChange = {
  /** رقم الصف في الملف (أول صف بيانات = 2)؛ عند دمج مكرّرات = أول صف. */
  row: number;
  modelId: number;
  branchId: number;
  branchName: string;
  carLabel: string;
  currentQuantity: number;
  newQuantity: number;
  /** لا يوجد سجل للموديل في هذا الفرع بعد — سيُنشأ. */
  isNew: boolean;
  /** عدد صفوف الملف التي جُمعت في هذا السطر (>1 = تكرار في الملف). */
  mergedRows: number;
};

export type QuantityPreview = {
  totalRows: number;
  changes: QuantityChange[];
  /** صفوف طوبقت لكن كميتها مطابقة للحالية. */
  unchanged: number;
  /** صفوف بلا كمية أو فارغة — تُتجاهل بلا خطأ. */
  ignored: number;
  errors: { row: number; message: string }[];
};

export type QuantityApplyResult = {
  updated: number;
  created: number;
  errors: { row: number; message: string }[];
};

function cell(row: ImportRow, col?: string): string {
  if (!col) return "";
  return (row[col] ?? "").trim();
}

/** توحيد أسماء الماركات/الموديلات للمطابقة: تصغير + حذف الفواصل والمسافات. */
function normalizeName(s: string): string {
  return toAsciiDigits(s)
    .trim()
    .toLowerCase()
    .replace(/[\s_\-.]/g, "");
}

/** يضيف مفتاحاً؛ عند تعارض معرّفين مختلفين يصير المفتاح ملتبساً (null). */
function putUnique(map: Map<string, number | null>, key: string, id: number) {
  if (!key) return;
  if (!map.has(key)) {
    map.set(key, id);
    return;
  }
  if (map.get(key) !== id) map.set(key, null);
}

type ModelIndex = {
  /** id → التسمية المعروضة */
  labels: Map<number, string>;
  brandModelYear: Map<string, number | null>;
  brandModel: Map<string, number | null>;
  modelYear: Map<string, number | null>;
  modelOnly: Map<string, number | null>;
};

async function buildModelIndex(): Promise<ModelIndex> {
  const models = await prisma.carModel.findMany({
    select: {
      id: true,
      name: true,
      year: true,
      brand: { select: { name: true } },
    },
  });

  const index: ModelIndex = {
    labels: new Map(),
    brandModelYear: new Map(),
    brandModel: new Map(),
    modelYear: new Map(),
    modelOnly: new Map(),
  };

  for (const m of models) {
    const brand = normalizeName(m.brand?.name ?? "");
    const name = normalizeName(m.name);
    index.labels.set(m.id, `${m.brand?.name ?? ""} ${m.name} ${m.year}`.trim());
    putUnique(index.brandModelYear, `${brand}|${name}|${m.year}`, m.id);
    putUnique(index.brandModel, `${brand}|${name}`, m.id);
    putUnique(index.modelYear, `${name}|${m.year}`, m.id);
    putUnique(index.modelOnly, name, m.id);
  }

  return index;
}

/** نتيجة مطابقة موديل: id، أو التباس، أو عدم وجود. */
function lookupModel(
  index: ModelIndex,
  brandRaw: string,
  modelRaw: string,
  yearRaw: string,
): { modelId: number } | { error: string } {
  const model = normalizeName(modelRaw);
  if (!model) return { error: "لم يُربط عمود الموديل أو القيمة فارغة" };

  const brand = normalizeName(brandRaw);
  const yearDigits = toAsciiDigits(yearRaw).replace(/[^\d]/g, "");
  const year = yearDigits ? parseInt(yearDigits, 10) : null;

  const candidates: (number | null | undefined)[] = [];
  if (brand && year) candidates.push(index.brandModelYear.get(`${brand}|${model}|${year}`));
  if (brand) candidates.push(index.brandModel.get(`${brand}|${model}`));
  if (year) candidates.push(index.modelYear.get(`${model}|${year}`));
  candidates.push(index.modelOnly.get(model));

  for (const c of candidates) {
    if (typeof c === "number") return { modelId: c };
    if (c === null) {
      return {
        error: `أكثر من موديل يطابق «${[brandRaw, modelRaw, yearRaw].filter(Boolean).join(" ")}» — أضف عمود السنة أو استخدم القالب`,
      };
    }
  }

  return {
    error: `لا يوجد موديل مطابق لـ «${[brandRaw, modelRaw, yearRaw].filter(Boolean).join(" ")}»`,
  };
}

type ResolveContext = {
  /** null = مدير نظام (كل الفروع)؛ رقم = موظف محصور بفرعه. */
  scopedBranchId: number | null;
};

async function resolveAuth(): Promise<
  { ok: true; ctx: ResolveContext } | { ok: false; error: string }
> {
  const auth = await requireAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };
  if (auth.session.isSuperAdmin) return { ok: true, ctx: { scopedBranchId: null } };
  if (!auth.session.branchId) {
    return { ok: false, error: "حسابك غير مرتبط بفرع." };
  }
  return { ok: true, ctx: { scopedBranchId: auth.session.branchId } };
}

/**
 * يحوّل صفوف الملف إلى تغييرات كمية جاهزة للتطبيق. لا يكتب شيئاً — تستخدمه المعاينة
 * والتطبيق معاً حتى لا يتفرّع المنطق بينهما.
 */
async function resolveQuantityRows(
  rows: ImportRow[],
  mapping: QuantityMapping,
  fallbackBranchId: number | null,
  ctx: ResolveContext,
): Promise<QuantityPreview> {
  const result: QuantityPreview = {
    totalRows: rows.length,
    changes: [],
    unchanged: 0,
    ignored: 0,
    errors: [],
  };

  const [resolveBranch, modelIndex, branches] = await Promise.all([
    buildBranchResolver(
      ctx.scopedBranchId ? { allowedBranchIds: [ctx.scopedBranchId] } : undefined,
    ),
    buildModelIndex(),
    prisma.branch.findMany({ select: { id: true, name: true } }),
  ]);
  const branchNames = new Map(branches.map((b) => [b.id, b.name]));

  const defaultBranchId =
    ctx.scopedBranchId ?? (fallbackBranchId && branchNames.has(fallbackBranchId) ? fallbackBranchId : null);

  // تجميع حسب (موديل، فرع): ملف فيه صف لكل سيارة يُجمَع بدل أن يتغلّب آخر صف بصمت.
  type Agg = { modelId: number; branchId: number; quantity: number; firstRow: number; mergedRows: number };
  const agg = new Map<string, Agg>();

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const row = rows[i]!;

    const qtyRaw = cell(row, mapping.quantity);
    const isRowEmpty = Object.values(row).every((v) => v.trim() === "");
    if (isRowEmpty || qtyRaw === "") {
      result.ignored++;
      continue;
    }

    const qtyDigits = toAsciiDigits(qtyRaw).replace(/[^\d]/g, "");
    const quantity = parseInt(qtyDigits, 10);
    if (!Number.isFinite(quantity)) {
      result.errors.push({ row: rowNum, message: `كمية غير صالحة: «${qtyRaw}»` });
      continue;
    }
    if (quantity > MAX_FLEET_QUANTITY) {
      result.errors.push({
        row: rowNum,
        message: `الكمية ${quantity} تتجاوز الحد الأقصى ${MAX_FLEET_QUANTITY}`,
      });
      continue;
    }

    // 1) المعرّف من القالب — الأدق
    let modelId: number | null = null;
    let branchId: number | null = null;
    const keyRaw = cell(row, mapping.key);
    if (keyRaw) {
      const parsed = parseFleetRowKey(keyRaw);
      if (!parsed) {
        result.errors.push({ row: rowNum, message: `معرّف غير صالح: «${keyRaw}»` });
        continue;
      }
      if (!modelIndex.labels.has(parsed.modelId)) {
        result.errors.push({ row: rowNum, message: `الموديل ${parsed.modelId} غير موجود` });
        continue;
      }
      if (!branchNames.has(parsed.branchId)) {
        result.errors.push({ row: rowNum, message: `الفرع ${parsed.branchId} غير موجود` });
        continue;
      }
      modelId = parsed.modelId;
      branchId = parsed.branchId;
    } else {
      // 2) مطابقة بالاسم
      branchId = defaultBranchId;
      const branchRaw = cell(row, mapping.branch);
      if (branchRaw) {
        const matched = resolveBranch(branchRaw);
        if (matched == null) {
          result.errors.push({ row: rowNum, message: `فرع غير معروف: «${branchRaw}»` });
          continue;
        }
        branchId = matched;
      }
      if (branchId == null) {
        result.errors.push({ row: rowNum, message: "لم يُحدَّد الفرع (اربط عمود الفرع أو اختر فرعاً)" });
        continue;
      }

      const found = lookupModel(
        modelIndex,
        cell(row, mapping.brand),
        cell(row, mapping.model),
        cell(row, mapping.year),
      );
      if ("error" in found) {
        result.errors.push({ row: rowNum, message: found.error });
        continue;
      }
      modelId = found.modelId;
    }

    if (ctx.scopedBranchId != null && branchId !== ctx.scopedBranchId) {
      result.errors.push({
        row: rowNum,
        message: `لا تملك صلاحية تعديل كميات فرع «${branchNames.get(branchId) ?? branchId}»`,
      });
      continue;
    }

    const key = `${modelId}-${branchId}`;
    const existing = agg.get(key);
    if (existing) {
      existing.quantity = Math.min(MAX_FLEET_QUANTITY, existing.quantity + quantity);
      existing.mergedRows++;
    } else {
      agg.set(key, { modelId, branchId, quantity, firstRow: rowNum, mergedRows: 1 });
    }
  }

  if (agg.size === 0) return result;

  const fleetRows = await prisma.fleet.findMany({
    where: { OR: [...agg.values()].map((a) => ({ modelId: a.modelId, branchId: a.branchId })) },
    select: { modelId: true, branchId: true, quantity: true },
  });
  const currentByKey = new Map(
    fleetRows.map((f) => [`${f.modelId}-${f.branchId}`, f.quantity]),
  );

  for (const [key, a] of agg) {
    const current = currentByKey.get(key);
    if (current === a.quantity) {
      result.unchanged++;
      continue;
    }
    result.changes.push({
      row: a.firstRow,
      modelId: a.modelId,
      branchId: a.branchId,
      branchName: branchNames.get(a.branchId) ?? `#${a.branchId}`,
      carLabel: modelIndex.labels.get(a.modelId) ?? `#${a.modelId}`,
      currentQuantity: current ?? 0,
      newQuantity: a.quantity,
      isNew: current === undefined,
      mergedRows: a.mergedRows,
    });
  }

  result.changes.sort(
    (x, y) => x.branchName.localeCompare(y.branchName, "ar") || x.carLabel.localeCompare(y.carLabel, "ar"),
  );

  return result;
}

/** معاينة بلا كتابة: ماذا سيتغيّر لو طُبِّق الملف. */
export async function previewFleetQuantityImport(payload: {
  rows: ImportRow[];
  mapping: QuantityMapping;
  fallbackBranchId?: number | null;
}): Promise<QuantityPreview> {
  const auth = await resolveAuth();
  if (!auth.ok) {
    return {
      totalRows: 0,
      changes: [],
      unchanged: 0,
      ignored: 0,
      errors: [{ row: 0, message: auth.error }],
    };
  }
  return resolveQuantityRows(
    payload.rows,
    payload.mapping,
    payload.fallbackBranchId ?? null,
    auth.ctx,
  );
}

/**
 * يطبّق الكميات: كل (موديل، فرع) في الملف تُستبدل كميته بالقيمة الجديدة. أي سجل لم
 * يُذكر في الملف يبقى كما هو. لا تُنشأ موديلات ولا فروع ولا تُمسّ الأسعار.
 */
export async function applyFleetQuantityImport(payload: {
  rows: ImportRow[];
  mapping: QuantityMapping;
  fallbackBranchId?: number | null;
}): Promise<QuantityApplyResult> {
  const auth = await resolveAuth();
  if (!auth.ok) {
    return { updated: 0, created: 0, errors: [{ row: 0, message: auth.error }] };
  }

  const preview = await resolveQuantityRows(
    payload.rows,
    payload.mapping,
    payload.fallbackBranchId ?? null,
    auth.ctx,
  );

  const result: QuantityApplyResult = {
    updated: 0,
    created: 0,
    errors: [...preview.errors],
  };

  for (const change of preview.changes) {
    try {
      await prisma.fleet.upsert({
        where: {
          modelId_branchId: { modelId: change.modelId, branchId: change.branchId },
        },
        create: {
          modelId: change.modelId,
          branchId: change.branchId,
          quantity: change.newQuantity,
        },
        update: { quantity: change.newQuantity },
      });
      if (change.isNew) result.created++;
      else result.updated++;
    } catch (err) {
      result.errors.push({
        row: change.row,
        message: `${change.carLabel} — ${change.branchName}: ${
          err instanceof Error ? err.message : "خطأ غير متوقع"
        }`,
      });
    }
  }

  if (result.updated + result.created > 0) {
    revalidatePath("/admin/vehicles");
    revalidatePath("/admin/fleet-availability");
    revalidatePath("/admin/direct-booking");
    revalidatePath("/fleet");
    revalidatePath("/");
  }

  return result;
}
