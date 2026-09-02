/**
 * جدول مصالحة بين حجوزاتنا وعمليات جيديا — قراءة فقط.
 *
 * لا يكتب أي شيء: لا في قاعدة البيانات ولا عند جيديا (SELECT + GET فقط).
 *
 *   node scripts/geidea-reconcile.mjs              # قاعدة .env كما هي
 *   node scripts/geidea-reconcile.mjs --prod       # يبدّل اسم القاعدة إلى car_rental
 *   node scripts/geidea-reconcile.mjs --limit 50   # عدد الحجوزات (افتراضي 40)
 *   node scripts/geidea-reconcile.mjs --json       # يطبّع الرد الخام لكل عملية
 */
import fs from "node:fs";
import path from "node:path";

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

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

const publicKey = envVar("GEIDEA_PUBLIC_KEY");
const apiPassword = envVar("GEIDEA_API_PASSWORD");
const apiBase = (envVar("GEIDEA_API_BASE") ?? "https://api.ksamerchant.geidea.net").replace(/\/$/, "");
if (!publicKey || !apiPassword) {
  console.error("❌ مفاتيح GEIDEA_* ناقصة في .env");
  process.exit(1);
}
const authHeader = `Basic ${Buffer.from(`${publicKey}:${apiPassword}`).toString("base64")}`;

/** GET خام على جيديا. ملاحظة: جيديا ترجّع HTTP 200 حتى عند الفشل — الحكم من responseCode. */
async function rawGet(pathAndQuery) {
  const url = `${apiBase}${pathAndQuery}`;
  let res;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
    });
  } catch (e) {
    return { url, error: `شبكة: ${e.message}` };
  }
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { url, error: `رد غير JSON (HTTP ${res.status}): ${text.slice(0, 120)}` };
  }
  if (json.responseCode !== "000") {
    return {
      url,
      error: `${json.responseCode ?? "?"}/${json.detailedResponseCode ?? "?"}: ${json.detailedResponseMessage ?? json.responseMessage ?? "-"}`,
      raw: json,
    };
  }
  return { url, json, raw: json };
}

/**
 * أشكال قراءة الطلب عند جيديا — نجرّبها بالترتيب لأن الحساب قد يدعم بعضها فقط.
 * `Reference` يستخدم paymentSessionRef (merchantReferenceId)، والباقي paymentGatewayRef.
 *
 * تحذير: جيديا تتجاهل `Reference` غير المطابق وترجّع القائمة كاملة بدل قائمة فارغة.
 * لذلك كل `pick` هنا **تتحقق من هوية الطلب صراحةً** ولا تأخذ أول عنصر أبداً —
 * وإلا نُسبت عملية حجز آخر إلى حجز لم يُدفع أصلاً.
 */
function orderReadVariants({ gatewayRef, sessionRef }) {
  const v = [];
  if (sessionRef) {
    v.push({
      label: "v1 ?Reference",
      pick: (j) => j.orders?.find((o) => o.merchantReferenceId === sessionRef),
      path: `/pgw/api/v1/direct/order?Reference=${encodeURIComponent(sessionRef)}&Take=50`,
    });
  }
  if (gatewayRef) {
    const byId = (j) =>
      [j.order, ...(j.orders ?? [])].find((o) => o?.orderId === gatewayRef);
    v.push({
      label: "v1 /{orderId}",
      pick: byId,
      path: `/pgw/api/v1/direct/order/${encodeURIComponent(gatewayRef)}`,
    });
    v.push({
      label: "v1 ?OrderId",
      pick: byId,
      path: `/pgw/api/v1/direct/order?OrderId=${encodeURIComponent(gatewayRef)}&Take=50`,
    });
  }
  return v;
}

/**
 * يجرّب كل الأشكال ويعيد أول طلب **مطابق للهوية**.
 * `notFound: true` تعني أن جيديا ردّت بنجاح ولا يوجد لديها طلب بهذا المرجع —
 * وهي إجابة قاطعة (حجز لم يُدفع)، تختلف عن فشل القراءة.
 */
async function getOrder({ gatewayRef, sessionRef }) {
  const attempts = [];
  let anyReadOk = false;
  for (const variant of orderReadVariants({ gatewayRef, sessionRef })) {
    const r = await rawGet(variant.path);
    if (r.error) {
      attempts.push(`${variant.label} ✗ ${r.error}`);
      continue;
    }
    anyReadOk = true;
    const order = variant.pick(r.json);
    if (!order?.orderId) {
      attempts.push(`${variant.label} — لا طلب مطابق`);
      continue;
    }
    attempts.push(`${variant.label} ✓`);
    return { order, raw: r.raw, via: variant.label, attempts };
  }
  if (anyReadOk) return { notFound: true, attempts };
  return { error: attempts.join(" | ") || "لا مرجع للبحث", attempts };
}

const money = (n) => (n == null ? "—" : Number(n).toFixed(2));
const near = (a, b) => a != null && b != null && Math.abs(Number(a) - Number(b)) < 0.01;

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const dbName = process.env.DATABASE_URL?.split("/").pop()?.split("?")[0];

  console.log("════════ مصالحة جيديا (قراءة فقط) ════════");
  console.log("القاعدة:", dbName);
  console.log("جيديا  :", apiBase);

  const limit = Number(arg("--limit", "40"));
  const rows = await prisma.bookingRequest.findMany({
    where: {
      OR: [
        { paymentGatewayRef: { not: null } },
        { paymentSessionRef: { not: null } },
        { paymentMethod: { in: ["CARD", "MADA", "APPLE_PAY"] }, paymentStatus: { not: "PENDING" } },
      ],
    },
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
      cancellationRefundAmountSar: true,
      cancellationRefundExternalRef: true,
    },
    orderBy: { id: "desc" },
    take: limit,
  });

  console.log(`عدد الحجوزات المفحوصة: ${rows.length}\n`);
  if (!rows.length) {
    await prisma.$disconnect();
    return;
  }

  const problems = [];
  const lines = [];

  for (const r of rows) {
    const base = {
      id: r.id,
      date: r.createdAt.toISOString().slice(0, 10),
      method: r.paymentMethod ?? "—",
      ours: `${r.paymentStatus}/${r.status}`,
      oursAmt: r.paidAmountSar,
    };

    // حتى بلا مرجع بوابة نحاول القراءة بمرجع الجلسة — هكذا نكشف دفعة تمّت عند
    // جيديا ولم تصلنا أصلاً.
    if (!r.paymentGatewayRef && !r.paymentSessionRef) {
      const note = r.paymentStatus === "PAID" ? "مدفوع بلا أي مرجع" : "بلا أي مرجع";
      lines.push({ ...base, gStatus: "—", gAmt: null, gRefund: null, note });
      if (r.paymentStatus === "PAID") {
        problems.push(`#${r.id}: عندنا PAID بلا مرجع بوابة — لا يمكن استرداده آلياً.`);
      }
      continue;
    }
    if (!r.paymentGatewayRef && r.paymentStatus === "PAID") {
      problems.push(`#${r.id}: عندنا PAID بلا paymentGatewayRef — لا يمكن استرداده آلياً.`);
    }

    const { order, error, notFound, raw, via, attempts } = await getOrder({
      gatewayRef: r.paymentGatewayRef,
      sessionRef: r.paymentSessionRef,
    });
    if (process.argv.includes("--probe")) {
      console.log(`── #${r.id} محاولات القراءة: ${attempts.join(" | ")}`);
    }
    if (process.argv.includes("--json")) {
      console.log(`── #${r.id} خام ──`, JSON.stringify(raw, null, 2));
    }
    if (error) {
      lines.push({ ...base, gStatus: "خطأ", gAmt: null, gRefund: null, note: error });
      problems.push(`#${r.id}: تعذّر قراءة العملية من جيديا — ${error}`);
      continue;
    }
    if (notFound) {
      // جيديا ردّت بنجاح ولا يوجد لديها طلب بهذا المرجع — جلسة فُتحت ولم تُدفع.
      // فرق حقيقي فقط إذا كنا نظن أن الحجز مدفوع.
      const paidOurs = r.paymentStatus === "PAID" || r.paymentStatus === "REFUNDED";
      lines.push({
        ...base,
        gStatus: "لا عملية",
        gAmt: null,
        gRefund: null,
        note: paidOurs ? "⚠️ عندنا مدفوع ولا عملية عند جيديا" : "✓ جلسة لم تُدفع",
      });
      if (paidOurs) {
        problems.push(`#${r.id}: عندنا ${r.paymentStatus} ولا توجد أي عملية بهذا المرجع عند جيديا.`);
      }
      continue;
    }

    const gStatus = order.detailedStatus ?? order.status ?? "—";
    const gAmt = order.totalAmount ?? order.amount ?? null;
    const gRefund = order.totalRefundedAmount ?? 0;
    const notes = [];

    const paidOurs = r.paymentStatus === "PAID";
    const paidGeidea = /paid|captur|success/i.test(gStatus);
    if (paidOurs && !paidGeidea) notes.push(`عندنا PAID وجيديا ${gStatus}`);
    if (!paidOurs && paidGeidea && r.paymentStatus === "PENDING") {
      notes.push(`جيديا ${gStatus} وعندنا PENDING — دفعة لم تُسجَّل`);
    }
    if (paidOurs && gAmt != null && !near(r.paidAmountSar, gAmt)) {
      notes.push(`مبلغ مختلف: عندنا ${money(r.paidAmountSar)} وجيديا ${money(gAmt)}`);
    }
    const ourRefund = r.cancellationRefundAmountSar;
    if (ourRefund != null && ourRefund > 0 && !(gRefund > 0)) {
      notes.push(`سجّلنا استرداد ${money(ourRefund)} ولا استرداد عند جيديا`);
    }
    if (gRefund > 0 && (ourRefund == null || ourRefund === 0)) {
      notes.push(`جيديا استردّت ${money(gRefund)} ولم نسجّلها`);
    }
    if (ourRefund != null && ourRefund > 0 && gRefund > 0 && !near(ourRefund, gRefund)) {
      notes.push(`مبلغ استرداد مختلف: عندنا ${money(ourRefund)} وجيديا ${money(gRefund)}`);
    }

    lines.push({
      ...base,
      gStatus,
      gAmt,
      gRefund,
      note: `[${via}] ${notes.join(" | ") || "✓ مطابق"}`,
    });
    for (const n of notes) problems.push(`#${r.id}: ${n}`);
  }

  const head = [
    "الحجز".padStart(7),
    "التاريخ".padEnd(10),
    "الوسيلة".padEnd(10),
    "عندنا".padEnd(22),
    "مبلغنا".padStart(9),
    "جيديا".padEnd(16),
    "مبلغ جيديا".padStart(10),
    "مسترد".padStart(8),
    "ملاحظة",
  ].join(" │ ");
  console.log(head);
  console.log("─".repeat(head.length + 40));
  for (const l of lines) {
    console.log(
      [
        String(l.id).padStart(7),
        l.date.padEnd(10),
        l.method.padEnd(10),
        l.ours.padEnd(22),
        money(l.oursAmt).padStart(9),
        String(l.gStatus).padEnd(16),
        money(l.gAmt).padStart(10),
        money(l.gRefund).padStart(8),
        l.note,
      ].join(" │ "),
    );
  }

  console.log(`\n════════ الخلاصة ════════`);
  if (!problems.length) {
    console.log("✅ لا فروقات — كل حجز مطابق لعملية جيديا.");
  } else {
    console.log(`⚠️ ${problems.length} فرق:`);
    for (const p of problems) console.log("  •", p);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("💥", e);
  process.exit(1);
});
