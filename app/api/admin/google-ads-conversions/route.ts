import type { NextRequest } from "next/server";
import { bookingBranchWhere } from "@/lib/admin-access";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * تصدير CSV بصيغة «استيراد الإحالات دون اتصال» في Google Ads: حجوزات **مؤكَّدة الدفع** فقط
 * (paymentStatus = PAID، ووقت التأكيد = paidAt) ولها معرّف نقرة (gclid / gbraid / wbraid).
 * الدفع النقدي يدخل عند تأكيد الإدارة له (لا عند إرسال العميل للطلب).
 *
 * المعلمات: `from` و`to` بصيغة YYYY-MM-DD بتوقيت الرياض (الافتراضي آخر 30 يوماً)،
 * و`name` = اسم إحالة الاستيراد في Google Ads بالحرف (لازم يطابقه وإلا ترفضه Google).
 */
const DEFAULT_CONVERSION_NAME = "Booking Paid";
const DEFAULT_DAYS = 30;
const MAX_ROWS = 5000;
const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000; // السعودية UTC+3 بلا توقيت صيفي
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseRiyadhDay(ymd: string | null, endOfDay: boolean): Date | null {
  if (!ymd || !YMD_RE.test(ymd)) return null;
  const d = new Date(`${ymd}T${endOfDay ? "23:59:59.999" : "00:00:00"}+03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** yyyy-MM-dd HH:mm:ss+03:00 — الصيغة التي تقبلها Google مع إزاحة التوقيت. */
function googleConversionTime(d: Date): string {
  const r = new Date(d.getTime() + RIYADH_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${r.getUTCFullYear()}-${pad(r.getUTCMonth() + 1)}-${pad(r.getUTCDate())} ` +
    `${pad(r.getUTCHours())}:${pad(r.getUTCMinutes())}:${pad(r.getUTCSeconds())}+03:00`
  );
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!session.isSuperAdmin && !session.permissions.includes("BOOKINGS")) {
    return new Response("Forbidden", { status: 403 });
  }

  const p = req.nextUrl.searchParams;
  const to = parseRiyadhDay(p.get("to"), true) ?? new Date();
  const from =
    parseRiyadhDay(p.get("from"), false) ??
    new Date(to.getTime() - DEFAULT_DAYS * 24 * 60 * 60 * 1000);
  const conversionName = (p.get("name") ?? "").trim() || DEFAULT_CONVERSION_NAME;

  const rows = await prisma.bookingRequest.findMany({
    where: bookingBranchWhere(session, {
      kind: "DIRECT",
      paymentStatus: "PAID",
      paidAt: { gte: from, lte: to },
      OR: [{ gclid: { not: null } }, { gbraid: { not: null } }, { wbraid: { not: null } }],
    }),
    select: {
      id: true,
      gclid: true,
      gbraid: true,
      wbraid: true,
      paidAt: true,
      paidAmountSar: true,
    },
    orderBy: [{ paidAt: "asc" }, { id: "asc" }],
    take: MAX_ROWS,
  });

  const header = [
    "Google Click ID",
    "GBRAID",
    "WBRAID",
    "Conversion Name",
    "Conversion Time",
    "Conversion Value",
    "Conversion Currency",
    "Order ID",
  ];
  const lines = [header.join(",")];
  for (const b of rows) {
    if (!b.paidAt) continue;
    lines.push(
      [
        b.gclid ?? "",
        b.gbraid ?? "",
        b.wbraid ?? "",
        conversionName,
        googleConversionTime(b.paidAt),
        (b.paidAmountSar ?? 0).toFixed(2),
        "SAR",
        b.id,
      ]
        .map(csvCell)
        .join(","),
    );
  }

  const day = (d: Date) => new Date(d.getTime() + RIYADH_OFFSET_MS).toISOString().slice(0, 10);
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="google-ads-conversions_${day(from)}_${day(to)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
