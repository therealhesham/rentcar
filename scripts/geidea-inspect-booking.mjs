/**
 * فحص كل مراجع الدفع/الاسترداد على حجز — قراءة فقط، لا يلمس جيديا إطلاقاً.
 *
 *   node scripts/geidea-inspect-booking.mjs --prod --id 247 --id 237 --id 241
 *
 * الهدف: معرفة مصدر paymentGatewayRef وهل الاسترداد المسجَّل حقيقي أم بديل/محاكاة.
 */
import fs from "node:fs";
import path from "node:path";

const envText = fs.readFileSync(path.resolve(process.cwd(), ".env"), "utf8");
function envVar(key) {
  const m = new RegExp(`^\\s*${key}\\s*=\\s*"?([^"\\r\\n]*)"?`, "m").exec(envText);
  return m?.[1]?.trim() || undefined;
}

if (process.argv.includes("--prod")) {
  const url = envVar("DATABASE_URL");
  if (!url) throw new Error("DATABASE_URL غير موجود في .env");
  process.env.DATABASE_URL = url.replace(/\/car_rental_test(\?|$)/, "/car_rental$1");
} else if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = envVar("DATABASE_URL");
}

const ids = process.argv
  .map((a, i) => (a === "--id" ? Number(process.argv[i + 1]) : null))
  .filter((n) => Number.isInteger(n) && n > 0);
if (!ids.length) {
  console.error("❌ مرّر رقم حجز واحد على الأقل: --id 247");
  process.exit(1);
}

/** يصنّف المرجع: حقيقي من البوابة، أم بديل توليدناه نحن، أم محاكاة. */
function classifyRef(ref) {
  if (!ref) return "— لا يوجد";
  if (ref.startsWith("MOCK-")) return "🟠 محاكاة (البوابة لم تُستدعَ أصلاً)";
  if (ref.startsWith("GEIDEA-REFUND-")) return "🟡 بديل توليدنا (جيديا ردّت 000 بلا transactionId)";
  if (ref.startsWith("CASH-MANUAL-")) return "⚪ نقدي يدوي";
  if (ref.startsWith("NONE-")) return "⚪ لا مبلغ للاسترداد";
  if (ref.startsWith("booking-")) return "🔵 merchantReferenceId (مرجعنا نحن، ليس orderId)";
  return "🟢 معرّف من البوابة";
}

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  console.log("القاعدة:", process.env.DATABASE_URL?.split("/").pop()?.split("?")[0], "\n");

  for (const id of ids) {
    const b = await prisma.bookingRequest.findUnique({
      where: { id },
      select: {
        id: true,
        createdAt: true,
        paidAt: true,
        paymentMethod: true,
        paymentStatus: true,
        status: true,
        paidAmountSar: true,
        paymentGatewayRef: true,
        paymentSessionRef: true,
        paymentExternalRef: true,
        cancellationRefundAmountSar: true,
        cancellationRefundExternalRef: true,
      },
    });
    if (!b) {
      console.log(`#${id}: غير موجود\n`);
      continue;
    }

    console.log(`══════ الحجز #${b.id} ══════`);
    console.log(`الحالة        : ${b.paymentStatus} / ${b.status}`);
    console.log(`الوسيلة       : ${b.paymentMethod ?? "—"}`);
    console.log(`المدفوع       : ${b.paidAmountSar ?? "—"}   (paidAt: ${b.paidAt?.toISOString() ?? "—"})`);
    console.log(`gatewayRef    : ${b.paymentGatewayRef ?? "—"}`);
    console.log(`                ${classifyRef(b.paymentGatewayRef)}`);
    console.log(`sessionRef    : ${b.paymentSessionRef ?? "—"}`);
    console.log(`externalRef   : ${b.paymentExternalRef ?? "—"}`);
    console.log(`مبلغ الاسترداد : ${b.cancellationRefundAmountSar ?? "—"}`);
    console.log(`مرجع الاسترداد : ${b.cancellationRefundExternalRef ?? "—"}`);
    console.log(`                ${classifyRef(b.cancellationRefundExternalRef)}`);

    const txs = await prisma.paymentTransaction.findMany({
      where: { bookingId: b.id },
      orderBy: { id: "asc" },
    });
    console.log(`\nسجل الدفعات (${txs.length}):`);
    for (const t of txs) {
      console.log(
        `  ${String(t.id).padStart(5)} │ ${t.kind.padEnd(18)} │ ${t.direction.padEnd(6)} │ ${String(t.amountSar).padStart(9)} │ ${(t.method ?? "—").padEnd(10)} │ ${t.actorKind.padEnd(8)} │ ${t.actorName ?? "—"}`,
      );
      console.log(
        `        gatewayRef=${t.gatewayRef ?? "—"}  sessionRef=${t.sessionRef ?? "—"}  externalRef=${t.externalRef ?? "—"}`,
      );
    }
    console.log("");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("💥", e);
  process.exit(1);
});
