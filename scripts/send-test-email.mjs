/**
 * يبعت قوالب البريد لعنوان تجريبي عشان تتشاف على جهاز حقيقي (موبايل/ديسكتوب).
 * بياخد الـHTML من راوت /api/test-email عشان يبقى نفس المخرج الحقيقي للقالب.
 *
 * التشغيل (لازم `npm run dev` شغّال):
 *   node --env-file=.env scripts/send-test-email.mjs you@example.com [received,invoice,notification]
 */
import nodemailer from "nodemailer";

const to = process.argv[2];
const types = (process.argv[3] || "received,invoice").split(",").map((s) => s.trim()).filter(Boolean);
const baseUrl = process.env.TEST_EMAIL_BASE_URL || "http://localhost:3000";

if (!to) {
  console.error("الاستعمال: node --env-file=.env scripts/send-test-email.mjs <email> [types]");
  process.exit(1);
}

const { MAIL_HOST, MAIL_USER, MAIL_PASS, MAIL_PORT, MAIL_FROM } = process.env;
if (!MAIL_HOST || !MAIL_USER || !MAIL_PASS) {
  console.error("ناقص MAIL_HOST / MAIL_USER / MAIL_PASS في .env");
  process.exit(1);
}

const port = Number(MAIL_PORT) || 465;
const transporter = nodemailer.createTransport({
  host: MAIL_HOST,
  port,
  secure: port === 465,
  auth: { user: MAIL_USER, pass: MAIL_PASS },
  ...(port === 587 ? { requireTLS: true } : {}),
});

const subjects = {
  received: "[تجربة] تم استلام حجزك — معاينة القالب",
  invoice: "[تجربة] فاتورة الحجز — معاينة القالب",
  notification: "[تجربة] إشعار حجز جديد للموظفين — معاينة القالب",
};

for (const type of types) {
  const res = await fetch(`${baseUrl}/api/test-email?type=${type}`);
  if (!res.ok) {
    console.error(`✗ ${type}: الراوت رجّع ${res.status}`);
    continue;
  }
  const html = await res.text();
  const info = await transporter.sendMail({
    from: MAIL_FROM || MAIL_USER,
    to,
    subject: subjects[type] || `[تجربة] ${type}`,
    html,
    text: "معاينة قالب بريد — افتح الرسالة بصيغة HTML.",
  });
  console.log(`✓ ${type} → ${to} (${html.length} حرف) — ${info.messageId}`);
}

transporter.close();
