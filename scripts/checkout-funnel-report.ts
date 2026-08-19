/**
 * تقرير رحلة الحجز — قراءة مباشرة من قاعدة البرودكشن (`car_rental`, لا `car_rental_test`
 * التي يشير إليها .env محلياً — انظر memory: prod-vs-test-database) وبناء صفحة HTML
 * مستقلة تُفتح محلياً بلا تسجيل دخول إدارة (حساب الأدمن المحلي غير صالح على البرودكشن).
 *
 * يعيد استخدام نفس منطق `lib/activity-funnel.ts` المستخدَم في `/admin/logs`، ويضيف
 * تفصيلاً غير معروض هناك بعد: توزيع خطوات `CHECKOUT_ABANDON` (أين يتوقف من يغادر
 * صفحة الحجز دون ضغط زر التأكيد — وهم غالبية من يخسرهم الموقع).
 *
 * تشغيل: npx tsx scripts/checkout-funnel-report.ts
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";
import path from "path";
import {
  buildFunnel,
  buildSessions,
  CHECKOUT_ABANDON_STEP_LABELS,
  CHECKOUT_ERROR_LABELS,
  FUNNEL_STAGE_LABELS,
  deviceOf,
  median,
  parseAbandonDetail,
  shortBrowser,
  tally,
  type ActivityRowForFunnel,
  type VisitorSession,
} from "../lib/activity-funnel";

const LOCAL_IPS = ["::1", "127.0.0.1", "::ffff:127.0.0.1"];
const OUTPUT_PATH = path.join(__dirname, "..", "reports", "checkout-funnel-report.html");

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return "لحظة";
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds} ث`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds ? `${minutes} د ${seconds} ث` : `${minutes} د`;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function bar(count: number, max: number): string {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return `<div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>`;
}

async function main() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL غير موجود في البيئة");
  const base = new URL(rawUrl);
  base.pathname = "/car_rental"; // البرودكشن — لا car_rental_test
  const prisma = new PrismaClient({ datasources: { db: { url: base.toString() } } });

  console.log(`قراءة من ${base.hostname}${base.pathname} (قراءة فقط)…`);

  const [rows, adminIpRows, paidBookings] = await Promise.all([
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20000,
      select: {
        id: true,
        kind: true,
        path: true,
        ip: true,
        userAgent: true,
        userId: true,
        carModelId: true,
        referrer: true,
        detail: true,
        createdAt: true,
      },
    }),
    prisma.activityLog.findMany({
      where: { kind: "ADMIN_LOGIN", ip: { not: null } },
      select: { ip: true },
      distinct: ["ip"],
    }),
    prisma.bookingRequest.count({ where: { paymentStatus: "PAID" } }),
  ]);
  await prisma.$disconnect();

  console.log(`${rows.length} سجل نشاط، ${paidBookings} حجز مدفوع.`);

  const staffIps = new Set<string>([...adminIpRows.map((r) => r.ip as string), ...LOCAL_IPS]);
  const allSessions = buildSessions(rows as ActivityRowForFunnel[], staffIps);

  // استبعاد: فريق الشركة، البوتات المتنكّرة (fast-hop)، وأجهزة Linux — بطلب صريح،
  // لأن زوّار الموقع الحقيقيين شبه كلهم على الجوال (انظر memory: checkout-funnel-analytics)
  // وجلسات Linux desktop هنا غالباً أدوات آلية لا عملاء.
  const linuxSessions = allSessions.filter((s) => !s.isStaff && deviceOf(s.userAgent) === "Linux");
  const sessions = allSessions.filter(
    (s) => !s.isStaff && !s.isSuspectedBot && deviceOf(s.userAgent) !== "Linux",
  );

  const funnel = buildFunnel(sessions);
  const maxFunnel = Math.max(1, ...funnel.rows.map((r) => r.sessions));

  // ── توزيع الانسحاب داخل صفحة الحجز (CHECKOUT_ABANDON) ──────────────────
  const abandonEvents = sessions.flatMap((s) =>
    s.events.filter((e) => e.kind === "CHECKOUT_ABANDON" && e.detail),
  );
  const abandonSteps = tally(abandonEvents, (e) => parseAbandonDetail(e.detail).step || null);
  const abandonDurations = abandonEvents
    .map((e) => parseAbandonDetail(e.detail).seconds)
    .filter((v): v is number => v != null);
  const maxAbandon = Math.max(1, ...abandonSteps.map(([, c]) => c));

  // ── أخطاء النموذج بعد ضغط التأكيد ───────────────────────────────────────
  const errorTally = tally(sessions.flatMap((s) => s.errorCodes), (c) => c);
  const maxError = Math.max(1, ...errorTally.map(([, c]) => c));

  // ── الأجهزة والمتصفحات ──────────────────────────────────────────────────
  const deviceTally = tally(sessions, (s) => s.device);
  const browserTally = tally(sessions, (s) => s.browser);
  const maxDevice = Math.max(1, ...deviceTally.map(([, c]) => c));

  // ── أعمق مرحلة وصلها كل من لم يدفع، مع صفحة الخروج الأكثر تكراراً ──────
  const dropOffPathCounts = new Map<string, Map<string, number>>();
  const dropOff = new Map<string, number>();
  for (const s of sessions) {
    const key = s.deepestStage ?? "none";
    dropOff.set(key, (dropOff.get(key) ?? 0) + 1);
    if (s.exitPath) {
      const m = dropOffPathCounts.get(key) ?? new Map<string, number>();
      m.set(s.exitPath, (m.get(s.exitPath) ?? 0) + 1);
      dropOffPathCounts.set(key, m);
    }
  }
  const topExitPath = (stage: string): string | null => {
    const m = dropOffPathCounts.get(stage);
    if (!m) return null;
    let best: string | null = null, bestCount = 0;
    for (const [p, c] of m) if (c > bestCount) { bestCount = c; best = p; }
    return best;
  };

  const checkoutSessions = sessions.filter((s) => s.stages.has("checkout"));
  const checkoutNoSubmit = checkoutSessions.filter((s) => !s.stages.has("submit"));
  const medianDwell = median(
    checkoutSessions.map((s) => s.checkoutDwellMs).filter((v): v is number => v != null),
  );

  // ── جلسات صفحة الحجز بالتفصيل (للفحص اليدوي) ────────────────────────────
  const checkoutRows = checkoutSessions
    .slice(0, 200)
    .map((s: VisitorSession) => {
      const lastAbandon = [...s.events].reverse().find((e) => e.kind === "CHECKOUT_ABANDON");
      const abandon = lastAbandon ? parseAbandonDetail(lastAbandon.detail) : null;
      return {
        startedAt: s.startedAt.toISOString(),
        device: s.device,
        browser: s.browser ?? "—",
        reachedSubmit: s.stages.has("submit"),
        reachedPayment: s.stages.has("payment"),
        dwell: formatDuration(s.checkoutDwellMs),
        abandonStep: abandon ? (CHECKOUT_ABANDON_STEP_LABELS[abandon.step] ?? abandon.step) : "—",
        lastError: s.lastErrorCode ? (CHECKOUT_ERROR_LABELS[s.lastErrorCode] ?? s.lastErrorCode) : "—",
        exitPath: s.exitPath ?? "—",
        referrer: s.referrer ?? "مباشر",
      };
    });

  const generatedAt = new Date().toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" });

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>تقرير رحلة الحجز — البرودكشن</title>
<style>
  :root { --accent:#0f766e; --danger:#be123c; --bg:#f8fafc; --card:#fff; --border:#e2e8f0; --text:#0f172a; --muted:#64748b; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 24px; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .meta { color: var(--muted); font-size: 13px; margin-bottom: 24px; }
  .badge { display:inline-block; background:#fef3c7; color:#92400e; border-radius:6px; padding:2px 8px; font-size:12px; margin-inline-start:8px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .stat { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; }
  .stat .num { font-size: 26px; font-weight: 700; }
  .stat .label { color: var(--muted); font-size: 13px; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 18px; margin-bottom: 20px; }
  .card h2 { font-size: 16px; margin: 0 0 14px; }
  .card .note { color: var(--muted); font-size: 12.5px; margin-top: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { padding: 6px 8px; text-align: right; border-bottom: 1px solid var(--border); }
  th { color: var(--muted); font-weight: 600; font-size: 12px; }
  .row { display: flex; align-items: center; gap: 10px; margin: 6px 0; }
  .row .label { flex: 0 0 190px; font-size: 13px; }
  .row .count { flex: 0 0 48px; font-weight: 600; font-size: 13px; text-align: left; }
  .bar-track { flex: 1; background: #f1f5f9; border-radius: 6px; height: 16px; overflow: hidden; }
  .bar-fill { background: var(--accent); height: 100%; border-radius: 6px; }
  .bar-fill.danger { background: var(--danger); }
  .pill { display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; background:#f1f5f9; }
  .yes { color: var(--accent); font-weight:600; }
  .no { color: var(--danger); }
  code { background:#f1f5f9; padding:1px 5px; border-radius:4px; font-size:12px; }
  .filters { font-size: 12.5px; color: var(--muted); margin-bottom: 20px; }
</style>
</head>
<body>
  <h1>تقرير رحلة الحجز — قاعدة البرودكشن<span class="badge">قراءة فقط</span></h1>
  <div class="meta">تولّد في ${generatedAt} (الرياض) · ${rows.length} سجل نشاط خام</div>
  <div class="filters">
    مُستبعَد: فريق الشركة (${staffIps.size} عنوان)، بوتات fast-hop، أجهزة Linux (${linuxSessions.length} جلسة).
    الجلسات المتبقية للتحليل: <b>${sessions.length}</b> من أصل ${allSessions.length}.
  </div>

  <div class="grid">
    <div class="stat"><div class="num">${funnel.totalSessions}</div><div class="label">جلسات دخلت الموقع</div></div>
    <div class="stat"><div class="num">${checkoutSessions.length}</div><div class="label">فتحوا صفحة الحجز</div></div>
    <div class="stat"><div class="num">${checkoutNoSubmit.length}</div><div class="label">غادروا دون ضغط التأكيد</div></div>
    <div class="stat"><div class="num">${paidBookings}</div><div class="label">حجوزات مدفوعة (كل الوقت)</div></div>
    <div class="stat"><div class="num">${formatDuration(medianDwell)}</div><div class="label">وسيط زمن البقاء بصفحة الحجز</div></div>
  </div>

  <div class="card">
    <h2>رحلة الحجز — من الدخول حتى الدفع</h2>
    ${funnel.rows
      .map(
        (r) => `<div class="row">
        <div class="label">${FUNNEL_STAGE_LABELS[r.stage]}</div>
        <div class="count">${r.sessions}</div>
        ${bar(r.sessions, maxFunnel)}
        <div class="pill">${Math.round(r.shareOfAll * 100)}٪</div>
      </div>`,
      )
      .join("")}
    <div class="note">النسبة = من إجمالي الجلسات. الأعمدة تُقارَن بأوسع مرحلة سابقة لتفادي نسب فوق ١٠٠٪.</div>
  </div>

  <div class="card">
    <h2>أين يتوقف من يغادر صفحة الحجز دون ضغط «تأكيد»؟</h2>
    ${
      abandonSteps.length
        ? abandonSteps
            .map(
              ([step, count]) => `<div class="row">
        <div class="label">${esc(CHECKOUT_ABANDON_STEP_LABELS[step] ?? step)}</div>
        <div class="count">${count}</div>
        ${bar(count, maxAbandon).replace("bar-fill", "bar-fill danger")}
      </div>`,
            )
            .join("")
        : `<div class="note">لا أحداث <code>CHECKOUT_ABANDON</code> بعد — أُضيف التتبّع ٢٠٢٦-٠٨-١٤، تحقّق أنه انتشر على البرودكشن ومرّ وقت كافٍ لتجميع بيانات.</div>`
    }
    ${
      abandonDurations.length
        ? `<div class="note">${abandonEvents.length} حدث انسحاب مسجَّل · وسيط المدة قبل الانسحاب: ${formatDuration(
            (median(abandonDurations) ?? 0) * 1000,
          )}</div>`
        : ""
    }
  </div>

  <div class="card">
    <h2>أخطاء النموذج بعد ضغط «تأكيد» (من نجح لاحقاً غالباً)</h2>
    ${
      errorTally.length
        ? errorTally
            .map(
              ([code, count]) => `<div class="row">
        <div class="label">${esc(CHECKOUT_ERROR_LABELS[code] ?? code)}</div>
        <div class="count">${count}</div>
        ${bar(count, maxError)}
      </div>`,
            )
            .join("")
        : `<div class="note">لا أخطاء نموذج مسجَّلة في هذه الفترة.</div>`
    }
  </div>

  <div class="card">
    <h2>الأجهزة والمتصفحات (بعد استبعاد Linux)</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
      <div>
        <h3 style="font-size:13px;color:var(--muted);margin:0 0 8px">الجهاز</h3>
        ${deviceTally
          .map(
            ([d, c]) => `<div class="row"><div class="label" style="flex-basis:100px">${esc(d)}</div><div class="count">${c}</div>${bar(c, maxDevice)}</div>`,
          )
          .join("")}
      </div>
      <div>
        <h3 style="font-size:13px;color:var(--muted);margin:0 0 8px">المتصفح</h3>
        <table><tbody>
        ${browserTally
          .slice(0, 8)
          .map(([b, c]) => `<tr><td>${esc(b)}</td><td>${c}</td></tr>`)
          .join("")}
        </tbody></table>
      </div>
    </div>
  </div>

  <div class="card">
    <h2>أعمق مرحلة وصلها كل من لم يُتمّ الدفع (مع صفحة الخروج الأكثر تكراراً)</h2>
    <table>
      <thead><tr><th>المرحلة</th><th>عدد الجلسات</th><th>صفحة الخروج الأكثر تكراراً</th></tr></thead>
      <tbody>
      ${[...dropOff.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(
          ([stage, count]) => `<tr>
          <td>${stage === "none" ? "صفحات أخرى فقط" : FUNNEL_STAGE_LABELS[stage as keyof typeof FUNNEL_STAGE_LABELS]}</td>
          <td>${count}</td>
          <td><code>${esc(topExitPath(stage) ?? "—")}</code></td>
        </tr>`,
        )
        .join("")}
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2>جلسات صفحة الحجز بالتفصيل (أحدث ${checkoutRows.length})</h2>
    <table>
      <thead>
        <tr>
          <th>الوقت</th><th>الجهاز</th><th>المتصفح</th><th>وصل للتأكيد؟</th><th>وصل للدفع؟</th>
          <th>مدة البقاء</th><th>آخر مرحلة قبل الانسحاب</th><th>آخر خطأ</th><th>صفحة الخروج</th><th>المصدر</th>
        </tr>
      </thead>
      <tbody>
      ${checkoutRows
        .map(
          (r) => `<tr>
        <td>${new Date(r.startedAt).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })}</td>
        <td>${esc(r.device)}</td>
        <td>${esc(r.browser)}</td>
        <td class="${r.reachedSubmit ? "yes" : "no"}">${r.reachedSubmit ? "نعم" : "لا"}</td>
        <td class="${r.reachedPayment ? "yes" : "no"}">${r.reachedPayment ? "نعم" : "لا"}</td>
        <td>${r.dwell}</td>
        <td>${esc(r.abandonStep)}</td>
        <td>${esc(r.lastError)}</td>
        <td><code>${esc(r.exitPath)}</code></td>
        <td>${esc(r.referrer)}</td>
      </tr>`,
        )
        .join("")}
      </tbody>
    </table>
  </div>

</body>
</html>`;

  writeFileSync(OUTPUT_PATH, html, "utf-8");
  console.log(`كُتب التقرير في: ${OUTPUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
