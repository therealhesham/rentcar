/**
 * تشخيص ربط بوابة جيديا — يختبر إنشاء جلسة دفع ويطبع الطلب والرد الخام بالكامل.
 *
 *   node scripts/geidea-diagnose.mjs                 # يستخدم GEIDEA_* من .env
 *   node scripts/geidea-diagnose.mjs --sandbox       # يستخدم GEIDEA_SANDBOX_* من .env
 *   node scripts/geidea-diagnose.mjs --key <pub> --pass <password> [--base <url>]
 *
 * الهدف: عزل مصدر الخطأ (كودنا vs إعداد حساب جيديا). لا يمرّ على أي منطق من
 * كود المشروع — يبني التوقيع ويرسل الطلب مباشرةً كما توثّقه جيديا.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// ─── تحميل .env يدوياً (بدون الاعتماد على Next) ──────────────────────────────
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = val;
  }
}
loadEnv();

function arg(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const useSandbox = process.argv.includes("--sandbox");
const prefix = useSandbox ? "GEIDEA_SANDBOX" : "GEIDEA";

const publicKey = arg("--key") ?? process.env[`${prefix}_PUBLIC_KEY`];
const apiPassword = arg("--pass") ?? process.env[`${prefix}_API_PASSWORD`];
const apiBase = (arg("--base") ?? process.env[`${prefix}_API_BASE`] ?? "https://api.ksamerchant.geidea.net").replace(/\/$/, "");

if (!publicKey || !apiPassword) {
  console.error("❌ مفاتيح ناقصة. مرّرها بـ --key/--pass أو اضبط متغيرات البيئة.");
  process.exit(1);
}

function mask(s) {
  if (!s) return "(فارغ)";
  return s.length <= 8 ? "****" : `${s.slice(0, 8)}…${s.slice(-4)}`;
}

function formatAmount(n) {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function isoTimestamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function hmacBase64(data, key) {
  return crypto.createHmac("sha256", key).update(data).digest("base64");
}

/** يرسل طلب إنشاء جلسة ويطبع كل التفاصيل. */
async function probe(label, bodyExtra = {}) {
  const amount = formatAmount(1);
  const currency = "SAR";
  const merchantReferenceId = `diag-${Date.now()}`;
  const timestamp = isoTimestamp();
  const signatureBase = `${publicKey}${amount}${currency}${merchantReferenceId}${timestamp}`;
  const signature = hmacBase64(signatureBase, apiPassword);

  const body = {
    amount,
    currency,
    timestamp,
    merchantReferenceId,
    signature,
    paymentOperation: "Pay",
    language: "ar",
    ...bodyExtra,
  };

  console.log(`\n─── ${label} ───`);
  console.log("الطلب (body):", JSON.stringify(body, null, 2));

  let res, text;
  try {
    res = await fetch(`${apiBase}/payment-intent/api/v2/direct/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${publicKey}:${apiPassword}`).toString("base64")}`,
      },
      body: JSON.stringify(body),
    });
    text = await res.text();
  } catch (e) {
    console.log("❌ فشل الاتصال بالشبكة:", e.message);
    return;
  }

  console.log("HTTP status:", res.status);
  console.log("response headers:");
  for (const [k, v] of res.headers.entries()) {
    if (["content-type", "x-correlation-id", "x-request-id", "date"].includes(k.toLowerCase())) {
      console.log(`   ${k}: ${v}`);
    }
  }
  let json;
  try {
    json = JSON.parse(text);
    console.log("الرد (json):", JSON.stringify(json, null, 2));
  } catch {
    console.log("الرد (نص خام):", text.slice(0, 800));
    return;
  }

  if (json.responseCode === "000" && json.session?.id) {
    console.log(`✅ نجحت — session id: ${json.session.id}`);
  } else {
    console.log(
      `⚠️ فشل — responseCode=${json.responseCode} detailedResponseCode=${json.detailedResponseCode ?? "-"} | ${json.detailedResponseMessage ?? json.responseMessage ?? ""}`,
    );
  }
}

async function main() {
  console.log("════════ تشخيص جيديا ════════");
  console.log("البيئة:", useSandbox ? "SANDBOX" : "الأساسية (GEIDEA_*)");
  console.log("apiBase:", apiBase);
  console.log("publicKey:", mask(publicKey));
  console.log("apiPassword:", mask(apiPassword));

  // 1) الطلب القياسي (نفس ما يرسله كود المشروع)
  await probe("① طلب قياسي (amount=1.00, Pay)");

  // 2) بدون paymentOperation (نتحقق هل الحقل يسبب الخطأ)
  await probe("② بدون paymentOperation", { paymentOperation: undefined });

  // 3) بمبلغ أكبر (بعض الحسابات لها حد أدنى)
  {
    const amount = formatAmount(10);
    const currency = "SAR";
    const merchantReferenceId = `diag-${Date.now()}`;
    const timestamp = isoTimestamp();
    const signature = hmacBase64(
      `${publicKey}${amount}${currency}${merchantReferenceId}${timestamp}`,
      apiPassword,
    );
    console.log("\n─── ③ مبلغ 10.00 (اختبار حد أدنى) ───");
    const res = await fetch(`${apiBase}/payment-intent/api/v2/direct/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${publicKey}:${apiPassword}`).toString("base64")}`,
      },
      body: JSON.stringify({
        amount,
        currency,
        timestamp,
        merchantReferenceId,
        signature,
        paymentOperation: "Pay",
        language: "ar",
      }),
    });
    const json = await res.json().catch(() => null);
    console.log("HTTP", res.status, "→", JSON.stringify(json));
  }

  console.log("\n════════ انتهى ════════");
  console.log(
    "تلميح: 100/013 (Internal Server Error) من جيديا نفسها = غالباً الحساب غير مفعّل لـ Payment Intent v2 أو ينقصه إعداد. أرسل publicKey وdetailedResponseCode لدعم جيديا.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
