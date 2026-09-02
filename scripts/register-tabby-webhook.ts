/**
 * تسجيل رابط الـwebhook لدى تابي — يُشغَّل يدوياً مرة واحدة (ولمرة أخرى عند
 * الحصول على مفاتيح الإنتاج، لأن تسجيل webhook بمفتاح test لا يستقبل إلا دفعات test).
 *
 * تشغيل: npx tsx scripts/register-tabby-webhook.ts
 */
import { registerTabbyWebhook } from "../lib/tabby/client";
import { getAppPublicUrl } from "../lib/app-public-url";

async function main() {
  const appUrl = getAppPublicUrl();
  if (!appUrl) throw new Error("APP_PUBLIC_URL غير مضبوط في .env");

  const webhookUrl = `${appUrl}/api/payments/tabby/webhook`;
  console.log(`Registering webhook: ${webhookUrl}`);

  const result = await registerTabbyWebhook(webhookUrl);
  console.log("✅ Registered:", result);
}

main().catch((e) => {
  console.error("❌ Failed:", e);
  process.exit(1);
});
