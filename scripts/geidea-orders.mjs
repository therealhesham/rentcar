/**
 * قراءة عمليات جيديا (read-only) — GET فقط، لا ينفّذ أي دفع أو استرداد.
 *
 *   node geidea-orders.mjs --from 2026-08-01 --to 2026-08-25
 *   node geidea-orders.mjs --sandbox              # مفاتيح GEIDEA_SANDBOX_*
 *   node geidea-orders.mjs --host https://api.merchant.geidea.net   # تجاوز apiBase
 *   node geidea-orders.mjs --take 50 --skip 0
 *   node geidea-orders.mjs --order <orderId>
 *   node geidea-orders.mjs --ref <merchantReferenceId>
 *   node geidea-orders.mjs --raw                  # JSON الخام كما يرد من جيديا
 */
import fs from "node:fs";
import path from "node:path";

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
const showRaw = process.argv.includes("--raw");
const prefix = useSandbox ? "GEIDEA_SANDBOX" : "GEIDEA";

const publicKey = process.env[`${prefix}_PUBLIC_KEY`];
const apiPassword = process.env[`${prefix}_API_PASSWORD`];
// `--host` يسمح بتجربة مضيف جيديا الآخر (api.merchant.geidea.net) دون تعديل .env.
const apiBase = (
  arg("--host") ?? process.env[`${prefix}_API_BASE`] ?? "https://api.ksamerchant.geidea.net"
).replace(/\/$/, "");

if (!publicKey || !apiPassword) {
  console.error(`❌ مفاتيح ${prefix}_* ناقصة في .env`);
  process.exit(1);
}

const authHeader = `Basic ${Buffer.from(`${publicKey}:${apiPassword}`).toString("base64")}`;

async function get(pathAndQuery) {
  const url = `${apiBase}${pathAndQuery}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* نُبقي النص الخام */
  }
  return { url, status: res.status, json, text };
}

function fmtOrder(o) {
  const brand = o.paymentMethod?.wallet || o.paymentMethod?.brand || "-";
  const amount = o.totalAmount ?? o.amount ?? 0;
  const refunded = o.totalRefundedAmount ?? 0;
  return [
    (o.createdDate ?? o.createdAt ?? "").toString().slice(0, 19).padEnd(19),
    (o.orderId ?? "-").padEnd(36),
    (o.detailedStatus ?? o.status ?? "-").padEnd(14),
    `${Number(amount).toFixed(2)} ${o.currency ?? ""}`.padEnd(12),
    refunded > 0 ? `مسترد ${Number(refunded).toFixed(2)}`.padEnd(16) : "".padEnd(16),
    brand.padEnd(12),
    o.merchantReferenceId ?? "-",
  ].join(" │ ");
}

async function main() {
  console.log("════════ عمليات جيديا (قراءة فقط) ════════");
  console.log("البيئة :", useSandbox ? "SANDBOX" : "الأساسية (GEIDEA_*)");
  console.log("apiBase:", apiBase);

  const orderId = arg("--order");
  if (orderId) {
    const r = await get(`/pgw/api/v1/direct/order/${encodeURIComponent(orderId)}`);
    console.log(`\nGET ${r.url}\nHTTP ${r.status}`);
    console.log(JSON.stringify(r.json ?? r.text, null, 2));
    return;
  }

  // بارامترات البحث الموثّقة: FromDate/ToDate/Skip/Take/Status/Reference…
  const params = new URLSearchParams();
  const ref = arg("--ref");
  if (ref) params.set("Reference", ref);
  const from = arg("--from");
  const to = arg("--to");
  if (from) params.set("FromDate", from.includes("T") ? from : `${from}T00:00:00Z`);
  if (to) params.set("ToDate", to.includes("T") ? to : `${to}T23:59:59Z`);
  const status = arg("--status");
  if (status) params.set("Status", status);
  params.set("Skip", arg("--skip") ?? "0");
  params.set("Take", arg("--take") ?? "20");

  const r = await get(`/pgw/api/v1/direct/order?${params.toString()}`);
  console.log(`\nGET ${r.url}\nHTTP ${r.status}`);
  if (r.json?.totalCount != null) {
    console.log(`totalCount=${r.json.totalCount}  totalAmount=${r.json.totalAmount ?? "-"}`);
  }

  if (showRaw || !r.json) {
    console.log(JSON.stringify(r.json ?? r.text, null, 2).slice(0, 8000));
    return;
  }

  const orders = r.json.orders;
  if (!Array.isArray(orders)) {
    console.log("لا يوجد مصفوفة orders في الرد:");
    console.log(JSON.stringify(r.json, null, 2).slice(0, 4000));
    return;
  }

  console.log(`\nعدد العمليات المُرجَعة: ${orders.length}\n`);
  console.log(
    ["التاريخ".padEnd(19), "orderId".padEnd(36), "الحالة".padEnd(14), "المبلغ".padEnd(12), "الاسترداد".padEnd(16), "الوسيلة".padEnd(12), "مرجعنا"].join(" │ "),
  );
  console.log("─".repeat(150));
  for (const o of orders) console.log(fmtOrder(o));
}

main().catch((e) => {
  console.error("💥", e);
  process.exit(1);
});
