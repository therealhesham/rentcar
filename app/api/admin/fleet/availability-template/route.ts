import ExcelJS from "exceljs";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** عدد الصفوف الجاهزة بقوائم الاختيار في ورقة الإدخال. */
const INPUT_ROWS = 500;

/**
 * قالب «تحديث الاتاحة»: ورقة إدخال فارغة بنفس أسماء الأعمدة التي يكتشفها `autoDetect`
 * في الواجهة، وأعمدة الفرع/الماركة/الموديل بقائمة منسدلة من ورقة «القوائم» — تقلّل الأخطاء
 * الإملائية من المصدر. القائمة تحذيرية فقط (لا تمنع الكتابة الحرة) لأن الرفع نفسه يعرض
 * مراجعة للقيم غير المطابقة.
 */
export async function GET() {
  const session = await getAdminSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!session.isSuperAdmin && !session.permissions.includes("/admin/fleet-availability/import")) {
    return new Response("Forbidden", { status: 403 });
  }

  const [branches, models] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
    prisma.carModel.findMany({
      select: { name: true, year: true, brand: { select: { name: true } } },
      orderBy: [{ brand: { name: "asc" } }, { name: "asc" }, { year: "asc" }],
    }),
  ]);

  const branchNames = branches.map((b) => b.name);
  const brandNames = [...new Set(models.map((m) => m.brand.name))];
  const modelNames = [...new Set(models.map((m) => m.name))];

  const wb = new ExcelJS.Workbook();

  // ── ورقة الإدخال ────────────────────────────────────────────────────────────
  const ws = wb.addWorksheet("تحديث الاتاحة");
  ws.views = [{ rightToLeft: true, state: "frozen", ySplit: 1 }];
  ws.columns = [
    { header: "الماركة", key: "brand", width: 16 },
    { header: "الموديل", key: "model", width: 20 },
    { header: "سنة الصنع", key: "year", width: 11 },
    { header: "الفرع", key: "branch", width: 22 },
    { header: "تاريخ الاستلام", key: "pickupDate", width: 15, style: { numFmt: "yyyy-mm-dd" } },
    { header: "توقيت الاستلام", key: "pickupTime", width: 14, style: { numFmt: "hh:mm" } },
    { header: "تاريخ الإرجاع", key: "returnDate", width: 15, style: { numFmt: "yyyy-mm-dd" } },
    { header: "توقيت الإرجاع", key: "returnTime", width: 14, style: { numFmt: "hh:mm" } },
    { header: "السبب", key: "reason", width: 22 },
    { header: "اسم العميل", key: "fullName", width: 20 },
    { header: "جوال العميل", key: "phone", width: 15, style: { numFmt: "@" } },
  ];
  const header = ws.getRow(1);
  header.font = { bold: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFE6D6" } };

  // ── ورقة القوائم (مرجع القوائم المنسدلة) ─────────────────────────────────────
  const lists = wb.addWorksheet("القوائم");
  lists.views = [{ rightToLeft: true }];
  lists.columns = [
    { header: "الفروع", key: "branch", width: 24 },
    { header: "الماركات", key: "brand", width: 18 },
    { header: "الموديلات", key: "model", width: 22 },
    { header: "", key: "gap", width: 4 },
    { header: "ماركة", key: "fBrand", width: 18 },
    { header: "موديل", key: "fModel", width: 22 },
    { header: "سنة", key: "fYear", width: 8 },
  ];
  lists.getRow(1).font = { bold: true };
  const listRows = Math.max(branchNames.length, brandNames.length, modelNames.length, models.length);
  for (let i = 0; i < listRows; i++) {
    const m = models[i];
    lists.addRow({
      branch: branchNames[i] ?? null,
      brand: brandNames[i] ?? null,
      model: modelNames[i] ?? null,
      fBrand: m?.brand.name ?? null,
      fModel: m?.name ?? null,
      fYear: m?.year ?? null,
    });
  }

  const listRef = (col: string, count: number) =>
    count > 0 ? [`'القوائم'!$${col}$2:$${col}$${count + 1}`] : null;
  const validations: [string, string[] | null][] = [
    ["A", listRef("B", brandNames.length)],
    ["B", listRef("C", modelNames.length)],
    ["D", listRef("A", branchNames.length)],
  ];
  for (let r = 2; r <= INPUT_ROWS + 1; r++) {
    for (const [col, formulae] of validations) {
      if (!formulae) continue;
      ws.getCell(`${col}${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae,
        showErrorMessage: true,
        errorStyle: "warning",
        errorTitle: "قيمة غير موجودة",
        error: "القيمة ليست في القائمة — اختر من القائمة أو تأكد من الكتابة.",
      };
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  const fname = `availability-template-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fname}"`,
      "Cache-Control": "no-store",
    },
  });
}
