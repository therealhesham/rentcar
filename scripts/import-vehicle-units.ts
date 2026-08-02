/**
 * استيراد لوحات المركبات (VehicleUnit) من ملف الأسطول:
 *   npx tsx scripts/import-vehicle-units.ts "<xlsx-path>" [--apply]
 *
 * بدون --apply يطبع تقرير معاينة فقط ولا يكتب أي شيء في قاعدة البيانات.
 *
 * يستخدم نفس منطق صفحة /admin/vehicle-units/import (lib/vehicle-unit-import.ts)
 * حتى لا يتفرّع السلوك بين السكربت والواجهة.
 *
 * أعمدة ملف «الاسطول»: الطراز = الماركة، النوع = اسم الموديل، الموديل = سنة الصنع.
 */
import readXlsxFile from "read-excel-file/node";
import { prisma } from "../lib/prisma";
import { importVehicleUnits, type UnitFieldMapping } from "../lib/vehicle-unit-import";

const MAPPING: UnitFieldMapping = {
  plateNumber: "رقم اللوحة",
  brand: "الطراز",
  modelName: "النوع",
  year: "الموديل",
  branch: "اسم الفرع",
  color: "اللون",
  status: "حالة السيارة",
};

async function readRows(path: string): Promise<Record<string, string>[]> {
  const raw = (await (readXlsxFile as unknown as (p: string) => Promise<unknown>)(path)) as
    | unknown[][]
    | { data: unknown[][] }[];
  const matrix = (Array.isArray(raw[0]) ? raw : (raw as { data: unknown[][] }[])[0]!.data) as unknown[][];

  const seen = new Set<string>();
  const headers = (matrix[0] ?? []).map((c, i) => {
    const base = c == null ? `عمود_${i + 1}` : String(c).trim() || `عمود_${i + 1}`;
    let name = base;
    for (let n = 2; seen.has(name); n++) name = `${base} (${n})`;
    seen.add(name);
    return name;
  });

  const rows: Record<string, string>[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r] ?? [];
    const obj: Record<string, string> = {};
    let empty = true;
    for (let c = 0; c < headers.length; c++) {
      const v = line[c];
      const s = v == null ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim();
      obj[headers[c]!] = s;
      if (s) empty = false;
    }
    if (!empty) rows.push(obj);
  }
  return rows;
}

async function main() {
  const path = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!path) {
    console.error('الاستخدام: npx tsx scripts/import-vehicle-units.ts "<xlsx-path>" [--apply]');
    process.exit(1);
  }

  const rows = await readRows(path);
  const before = await prisma.vehicleUnit.count();
  console.log(`الملف: ${path}`);
  console.log(`صفوف بيانات: ${rows.length} · لوحات في القاعدة الآن: ${before}`);

  const missing = Object.values(MAPPING).filter((col) => !(col! in (rows[0] ?? {})));
  if (missing.length) {
    console.error(`أعمدة مفقودة في الملف: ${missing.join("، ")}`);
    process.exit(1);
  }

  if (!apply) {
    console.log("\n— معاينة فقط (بدون --apply): لن تُكتب أي بيانات —");
    console.log("الربط المستخدم:", MAPPING);
    process.exit(0);
  }

  const result = await importVehicleUnits({ rows, mapping: MAPPING, onDuplicate: "update" });

  console.log("\n=== النتيجة ===");
  console.log(`إجمالي الصفوف : ${result.total}`);
  console.log(`لوحات جديدة   : ${result.created}`);
  console.log(`لوحات محدّثة  : ${result.updated}`);
  console.log(`تم تخطيه      : ${result.skipped}`);
  if (result.errors.length) {
    console.log(`\nتنبيهات/أخطاء (${result.errors.length}):`);
    for (const e of result.errors) console.log(`  ${e.row > 0 ? `صف ${e.row}` : "عام"}: ${e.message}`);
  }
  console.log(`\nلوحات في القاعدة بعد التنفيذ: ${await prisma.vehicleUnit.count()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
