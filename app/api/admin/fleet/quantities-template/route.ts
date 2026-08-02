import type { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { getAdminSession } from "@/lib/admin-auth";
import { adminScope, fleetWhereForScope, scopedBranchIds } from "@/lib/admin-scope";
import { FLEET_QUANTITY_COLUMNS, fleetRowKey } from "@/lib/fleet-quantity-import";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TemplateRow = {
  modelId: number;
  branchId: number;
  branchName: string;
  brandName: string;
  modelName: string;
  year: number;
  quantity: number;
};

/**
 * قالب تحديث الكميات. بدون `branch` = سجلات الأسطول الحالية فقط؛ مع `branch` = كل
 * الموديلات لذلك الفرع (الغائب بكمية 0) حتى يمكن إضافة موديل للفرع من الملف نفسه.
 */
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!session.isSuperAdmin && !session.permissions.includes("/admin/vehicles")) {
    return new Response("Forbidden", { status: 403 });
  }

  // الفروع المسموحة للحساب: null = كل الفروع.
  const scope = adminScope(session);
  const allowedBranchIds = await scopedBranchIds(scope);
  if (allowedBranchIds != null && allowedBranchIds.length === 0) {
    return new Response("حسابك غير مرتبط بأي فرع.", { status: 403 });
  }

  // فرع واحد مسموح ⇒ القالب مقفول عليه؛ غير ذلك يُقبل الفرع المطلوب إن كان ضمن النطاق.
  let branchId: number | null =
    allowedBranchIds?.length === 1 ? allowedBranchIds[0]! : null;
  if (branchId == null) {
    const raw = Number(req.nextUrl.searchParams.get("branch"));
    if (Number.isInteger(raw) && raw > 0) {
      if (allowedBranchIds != null && !allowedBranchIds.includes(raw)) {
        return new Response("الفرع خارج نطاق حسابك.", { status: 403 });
      }
      branchId = raw;
    }
  }

  const rows: TemplateRow[] = [];

  if (branchId == null) {
    const fleet = await prisma.fleet.findMany({
      where: fleetWhereForScope(scope),
      select: {
        modelId: true,
        branchId: true,
        quantity: true,
        branch: { select: { name: true } },
        model: {
          select: { name: true, year: true, brand: { select: { name: true } } },
        },
      },
      orderBy: [{ branchId: "asc" }, { modelId: "asc" }],
    });
    for (const f of fleet) {
      rows.push({
        modelId: f.modelId,
        branchId: f.branchId,
        branchName: f.branch.name,
        brandName: f.model.brand?.name ?? "",
        modelName: f.model.name,
        year: f.model.year,
        quantity: f.quantity,
      });
    }
  } else {
    const [branch, models, fleet] = await Promise.all([
      prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }),
      prisma.carModel.findMany({
        select: { id: true, name: true, year: true, brand: { select: { name: true } } },
        orderBy: [{ brandId: "asc" }, { name: "asc" }, { year: "asc" }],
      }),
      prisma.fleet.findMany({
        where: { branchId },
        select: { modelId: true, quantity: true },
      }),
    ]);
    if (!branch) return new Response("الفرع غير موجود.", { status: 404 });

    const qtyByModel = new Map(fleet.map((f) => [f.modelId, f.quantity]));
    for (const m of models) {
      rows.push({
        modelId: m.id,
        branchId,
        branchName: branch.name,
        brandName: m.brand?.name ?? "",
        modelName: m.name,
        year: m.year,
        quantity: qtyByModel.get(m.id) ?? 0,
      });
    }
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("كميات الأسطول");
  ws.views = [{ rightToLeft: true, state: "frozen", ySplit: 1 }];
  // «رقم النظام» آخر عمود ومخفي: يضمن مطابقة دقيقة دون أن يشوّش على من يملأ الملف.
  // حذفه أو تجاهله لا يكسر الرفع — الواجهة ترجع للمطابقة بالماركة والموديل والسنة.
  ws.columns = [
    { header: FLEET_QUANTITY_COLUMNS.branch, key: "branch", width: 22 },
    { header: FLEET_QUANTITY_COLUMNS.brand, key: "brand", width: 18 },
    { header: FLEET_QUANTITY_COLUMNS.model, key: "model", width: 22 },
    { header: FLEET_QUANTITY_COLUMNS.year, key: "year", width: 10 },
    { header: FLEET_QUANTITY_COLUMNS.quantity, key: "quantity", width: 12 },
    { header: FLEET_QUANTITY_COLUMNS.key, key: "key", width: 14, hidden: true },
  ];
  ws.getRow(1).font = { bold: true };

  for (const r of rows) {
    ws.addRow({
      branch: r.branchName,
      brand: r.brandName,
      model: r.modelName,
      year: r.year,
      quantity: r.quantity,
      key: fleetRowKey(r.modelId, r.branchId),
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  const fname = `fleet-quantities-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fname}"`,
      "Cache-Control": "no-store",
    },
  });
}
