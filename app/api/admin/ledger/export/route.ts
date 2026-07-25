import type { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { getAdminSession } from "@/lib/admin-auth";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";
import {
  getPaymentTransactions,
  ledgerFiltersFromParams,
} from "@/lib/payment-transaction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  INITIAL_PAYMENT: "دفعة أولى",
  BALANCE_PAYMENT: "سداد فرق",
  LATE_PENALTY: "غرامة تأخير",
  REFUND: "استرداد",
  REFUND_REVERSAL: "عكس استرداد",
  CUSTOMER_SETTLEMENT: "تسوية للعميل",
};

const ACTOR_LABEL: Record<string, string> = {
  CUSTOMER: "العميل",
  ADMIN: "موظف",
  GATEWAY: "بوابة الدفع",
  SYSTEM: "النظام",
};

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!session.isSuperAdmin && !session.permissions.includes("FINANCIALS")) {
    return new Response("Forbidden", { status: 403 });
  }

  const scope = { isSuperAdmin: session.isSuperAdmin, branchId: session.branchId };
  const p = req.nextUrl.searchParams;
  const { filter, from, to, branchId } = ledgerFiltersFromParams({
    dir: p.get("dir") ?? undefined,
    period: p.get("period") ?? undefined,
    from: p.get("from") ?? undefined,
    to: p.get("to") ?? undefined,
    branch: p.get("branch") ?? undefined,
  });

  const rows = await getPaymentTransactions(scope, {
    filter,
    from,
    to,
    branchId,
    limit: 5000,
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("دفتر الحركات");
  ws.views = [{ rightToLeft: true }];
  ws.columns = [
    { header: "الحجز", key: "booking", width: 10 },
    { header: "العميل", key: "customer", width: 26 },
    { header: "الجوال", key: "phone", width: 16 },
    { header: "النوع", key: "kind", width: 16 },
    { header: "الاتجاه", key: "direction", width: 10 },
    { header: "المبلغ (ر.س)", key: "amount", width: 14 },
    { header: "الوسيلة", key: "method", width: 14 },
    { header: "المنفّذ", key: "actor", width: 24 },
    { header: "المرجع", key: "ref", width: 30 },
    { header: "التاريخ", key: "date", width: 22 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const t of rows) {
    ws.addRow({
      booking: t.bookingId,
      customer: t.booking?.fullName ?? "—",
      phone: t.booking?.phone ?? "",
      kind: KIND_LABEL[t.kind] ?? t.kind,
      direction: t.direction === "DEBIT" ? "مسترد" : "مقبوض",
      // مبلغ موقّع: سالب للمسترد ليصحّ الجمع في Excel.
      amount: (t.direction === "DEBIT" ? -1 : 1) * t.amountSar,
      method: bookingPaymentMethodLabelAr(t.method),
      actor: [ACTOR_LABEL[t.actorKind] ?? t.actorKind, t.actorName]
        .filter(Boolean)
        .join(" — "),
      ref: t.externalRef || t.gatewayRef || "—",
      date: t.createdAt.toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" }),
    });
  }

  // صف الصافي أسفل الجدول
  const net = rows.reduce(
    (s, t) => s + (t.direction === "DEBIT" ? -1 : 1) * t.amountSar,
    0,
  );
  const totalRow = ws.addRow({ kind: "الصافي", amount: Math.round(net * 100) / 100 });
  totalRow.font = { bold: true };

  const buf = await wb.xlsx.writeBuffer();
  const fname = `ledger-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fname}"`,
      "Cache-Control": "no-store",
    },
  });
}
