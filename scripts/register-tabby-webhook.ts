
import { registerTabbyWebhook } from "../lib/tabby/client";

async function main() {
  const appUrl = (process.env.APP_PUBLIC_URL ?? "").trim().replace(/\/$/, "");
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
