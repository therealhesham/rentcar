import { buildBranchResolver, normalizeBranchName } from "@/lib/branch-name-resolver";
import { prisma } from "@/lib/prisma";
import type { ImportRow } from "@/lib/vehicle-import-excel";

export type { ImportRow } from "@/lib/vehicle-import-excel";

/** كل الحقول اختيارية عدا اللوحة — يُستخدم فقط ما ربطه المستخدم في الواجهة. */
export type UnitFieldMapping = {
  plateNumber?: string;
  chassisNumber?: string;
  color?: string;
  /** أعمدة تحديد الموديل؛ عند غيابها يُستخدم الموديل الافتراضي من الإعدادات. */
  brand?: string;
  modelName?: string;
  year?: string;
  /** عمود اسم الفرع لكل صف؛ عند غيابه يُستخدم الفرع الافتراضي. */
  branch?: string;
  status?: string;
  notes?: string;
};

export type UnitImportResult = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

const MAX_ERRORS = 200;
const VALID_STATUSES = ["AVAILABLE", "RENTED", "MAINTENANCE", "INACTIVE"] as const;
type UnitStatus = (typeof VALID_STATUSES)[number];

function cell(row: ImportRow, col?: string): string {
  if (!col) return "";
  return (row[col] ?? "").trim();
}

/** توحيد رقم اللوحة: مسافات مفردة وحذف علامات التنسيق (لا يغيّر الأحرف نفسها). */
function normalizePlate(raw: string): string {
  return raw.replace(/[‎‏]/g, "").replace(/\s+/g, " ").trim();
}

/** مفتاح مقارنة اللوحات: بدون مسافات ولا فواصل حتى لا تتكرر نفس اللوحة بصيغتين. */
function plateKey(plate: string): string {
  return plate.replace(/[\s\-_/]/g, "").toLowerCase();
}

function normalizeModelKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

function parseStatus(raw: string, fallback: UnitStatus): UnitStatus {
  const v = raw.trim().toLowerCase();
  if (!v) return fallback;
  if (v === "rented" || v.includes("مؤجر") || v.includes("مؤجّر") || v.includes("محجوز")) {
    return "RENTED";
  }
  // حادث/تصليح = خارج الخدمة مؤقتاً؛ لا تظهر في اختيار اللوحة عند الحجز
  if (v === "maintenance" || v.includes("صيان") || v.includes("ورش") || v.includes("حادث")) {
    return "MAINTENANCE";
  }
  if (
    v === "inactive" ||
    v.includes("موقوف") ||
    v.includes("معطل") ||
    v.includes("خارج") ||
    v.includes("للبيع") ||
    v.includes("اصدار") ||
    v.includes("إصدار")
  ) {
    return "INACTIVE";
  }
  // «خارج الخدمة» أُمسك في الفرع أعلاه؛ «خدمة» وحدها = جاهزة للتأجير
  if (
    v === "available" ||
    v.includes("متاح") ||
    v.includes("متوفر") ||
    v.includes("جاهز") ||
    v.includes("خدمة")
  ) {
    return "AVAILABLE";
  }
  return fallback;
}

type ModelIndex = {
  /** ماركة|موديل|سنة → id */
  exact: Map<string, number>;
  /** ماركة|موديل → كل المعرفات (لمطابقة بدون سنة) */
  byBrandModel: Map<string, number[]>;
  /** موديل فقط → كل المعرفات (لملف بدون عمود ماركة) */
  byModel: Map<string, number[]>;
};

async function buildModelIndex(): Promise<ModelIndex> {
  const models = await prisma.carModel.findMany({
    select: { id: true, name: true, year: true, brand: { select: { name: true } } },
  });

  const index: ModelIndex = { exact: new Map(), byBrandModel: new Map(), byModel: new Map() };
  for (const m of models) {
    const brand = normalizeModelKey(m.brand.name);
    const name = normalizeModelKey(m.name);
    index.exact.set(`${brand}|${name}|${m.year}`, m.id);
    const bm = `${brand}|${name}`;
    index.byBrandModel.set(bm, [...(index.byBrandModel.get(bm) ?? []), m.id]);
    index.byModel.set(name, [...(index.byModel.get(name) ?? []), m.id]);
  }
  return index;
}

/** يحلّ الموديل من أعمدة الماركة/الموديل/السنة؛ يرمي خطأً عند التعذّر. */
function resolveModelId(
  index: ModelIndex,
  brandRaw: string,
  modelRaw: string,
  yearRaw: string,
): number {
  const brand = normalizeModelKey(brandRaw);
  const name = normalizeModelKey(modelRaw);
  const year = parseInt(yearRaw.replace(/[^\d]/g, ""), 10);

  if (brand && name && Number.isFinite(year)) {
    const hit = index.exact.get(`${brand}|${name}|${year}`);
    if (hit !== undefined) return hit;
  }

  const candidates = brand
    ? index.byBrandModel.get(`${brand}|${name}`)
    : index.byModel.get(name);

  if (!candidates || candidates.length === 0) {
    throw new Error(
      `لا يوجد موديل مطابق لـ "${[brandRaw, modelRaw, yearRaw].filter(Boolean).join(" ")}" — أضف الموديل أولاً من استيراد المركبات`,
    );
  }
  if (candidates.length > 1) {
    throw new Error(
      `"${[brandRaw, modelRaw].filter(Boolean).join(" ")}" يطابق أكثر من موديل — اربط عمود سنة الصنع للتمييز`,
    );
  }
  return candidates[0]!;
}

type ParsedUnit = {
  rowNum: number;
  plateNumber: string;
  chassisNumber: string | null;
  color: string | null;
  carModelId: number;
  branchId: number | null;
  status: UnitStatus;
  notes: string | null;
};

export async function importVehicleUnits(payload: {
  rows: ImportRow[];
  mapping: UnitFieldMapping;
  /** الموديل المستخدم للصفوف التي لا تحدد موديلاً (أو للملف كله عند عدم ربط أعمدة الموديل). */
  defaultCarModelId?: number | null;
  /** الفرع المستخدم عند عدم ربط عمود الفرع أو تعذّر مطابقة اسمه. */
  defaultBranchId?: number | null;
  defaultStatus?: string;
  /** اللوحة الموجودة مسبقاً: تحديثها أم تخطّيها. */
  onDuplicate?: "update" | "skip";
}): Promise<UnitImportResult> {
  const { rows, mapping } = payload;
  const defaultCarModelId = payload.defaultCarModelId ?? null;
  const defaultBranchId = payload.defaultBranchId ?? null;
  const defaultStatus = parseStatus(payload.defaultStatus ?? "", "AVAILABLE");
  const onDuplicate = payload.onDuplicate ?? "update";

  const result: UnitImportResult = {
    total: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  const addError = (row: number, message: string) => {
    if (result.errors.length < MAX_ERRORS) result.errors.push({ row, message });
  };

  if (!mapping.plateNumber) {
    addError(0, "يجب ربط عمود رقم اللوحة قبل الاستيراد.");
    return result;
  }
  const usesModelColumns = Boolean(mapping.brand || mapping.modelName);
  if (!usesModelColumns && defaultCarModelId === null) {
    addError(0, "اربط عمود الموديل أو اختر موديلاً افتراضياً في الإعدادات.");
    return result;
  }

  const [modelIndex, resolveBranch] = await Promise.all([
    usesModelColumns ? buildModelIndex() : Promise.resolve(null),
    mapping.branch ? buildBranchResolver() : Promise.resolve(null),
  ]);

  // ── 1) تحليل الصفوف وتجميعها (مع إسقاط اللوحات المكررة داخل الملف نفسه) ──────
  const parsedByKey = new Map<string, ParsedUnit>();
  const unknownBranches = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNum = i + 2;
    try {
      const plateNumber = normalizePlate(cell(row, mapping.plateNumber));
      if (!plateNumber) {
        result.skipped++;
        continue;
      }

      let carModelId = defaultCarModelId;
      if (modelIndex) {
        const brandRaw = cell(row, mapping.brand);
        const modelRaw = cell(row, mapping.modelName);
        if (brandRaw || modelRaw) {
          carModelId = resolveModelId(modelIndex, brandRaw, modelRaw, cell(row, mapping.year));
        }
      }
      if (carModelId === null) {
        throw new Error("لا يوجد موديل لهذا الصف ولا موديل افتراضي مختار");
      }

      let branchId = defaultBranchId;
      if (resolveBranch) {
        const branchRaw = cell(row, mapping.branch);
        if (branchRaw) {
          const hit = resolveBranch(branchRaw);
          if (hit === null && normalizeBranchName(branchRaw)) unknownBranches.add(branchRaw);
          branchId = hit ?? defaultBranchId;
        }
      }

      const key = plateKey(plateNumber);
      if (parsedByKey.has(key)) {
        addError(rowNum, `رقم اللوحة "${plateNumber}" مكرر داخل الملف — استُخدم أول ظهور له`);
        result.skipped++;
        continue;
      }

      parsedByKey.set(key, {
        rowNum,
        plateNumber,
        chassisNumber: cell(row, mapping.chassisNumber) || null,
        color: cell(row, mapping.color) || null,
        carModelId,
        branchId,
        status: parseStatus(cell(row, mapping.status), defaultStatus),
        notes: cell(row, mapping.notes) || null,
      });
    } catch (err) {
      addError(rowNum, err instanceof Error ? err.message : "خطأ غير متوقع");
      result.skipped++;
    }
  }

  for (const name of unknownBranches) {
    addError(0, `فرع غير معروف: "${name}" — استُخدم الفرع الافتراضي بدلاً منه`);
  }

  // ── 2) جلب اللوحات الموجودة مسبقاً للتفريق بين الإضافة والتحديث ──────────────
  const parsedUnits = [...parsedByKey.values()];
  const existingByKey = new Map<string, number>();
  const CHUNK = 500;
  for (let i = 0; i < parsedUnits.length; i += CHUNK) {
    const slice = parsedUnits.slice(i, i + CHUNK);
    const found = await prisma.vehicleUnit.findMany({
      where: { plateNumber: { in: slice.map((u) => u.plateNumber) } },
      select: { id: true, plateNumber: true },
    });
    for (const f of found) existingByKey.set(plateKey(f.plateNumber), f.id);
  }

  // ── 3) الكتابة ───────────────────────────────────────────────────────────────
  const toCreate: ParsedUnit[] = [];
  for (const unit of parsedUnits) {
    const existingId = existingByKey.get(plateKey(unit.plateNumber));
    if (existingId === undefined) {
      toCreate.push(unit);
      continue;
    }
    if (onDuplicate === "skip") {
      result.skipped++;
      continue;
    }
    try {
      await prisma.vehicleUnit.update({
        where: { id: existingId },
        data: {
          plateNumber: unit.plateNumber,
          carModelId: unit.carModelId,
          branchId: unit.branchId,
          status: unit.status,
          ...(unit.chassisNumber !== null && { chassisNumber: unit.chassisNumber }),
          ...(unit.color !== null && { color: unit.color }),
          ...(unit.notes !== null && { notes: unit.notes }),
        },
      });
      result.updated++;
    } catch (err) {
      addError(unit.rowNum, err instanceof Error ? err.message : "تعذّر تحديث اللوحة");
      result.skipped++;
    }
  }

  for (let i = 0; i < toCreate.length; i += CHUNK) {
    const slice = toCreate.slice(i, i + CHUNK);
    try {
      const res = await prisma.vehicleUnit.createMany({
        data: slice.map((u) => ({
          plateNumber: u.plateNumber,
          chassisNumber: u.chassisNumber,
          color: u.color,
          carModelId: u.carModelId,
          branchId: u.branchId,
          status: u.status,
          notes: u.notes,
        })),
        skipDuplicates: true,
      });
      result.created += res.count;
      result.skipped += slice.length - res.count;
    } catch (err) {
      addError(slice[0]!.rowNum, err instanceof Error ? err.message : "تعذّرت إضافة دفعة اللوحات");
      result.skipped += slice.length;
    }
  }

  return result;
}
