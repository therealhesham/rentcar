
import { registerTabbyWebhook } from "../lib/tabby/client";

async function main() {
  let appUrl = (process.env.APP_PUBLIC_URL ?? "").trim().replace(/\/$/, "");
  if (!appUrl) throw new Error("APP_PUBLIC_URL غير مضبوط في .env");

  // Ensure the URL carries a scheme — Tabby rejects bare hostnames (HTTP 400).
  if (!appUrl.startsWith("http://") && !appUrl.startsWith("https://")) {
    console.warn(`⚠️  APP_PUBLIC_URL has no scheme — prepending https://`);
    appUrl = `https://${appUrl}`;
  }

  const webhookUrl = `${appUrl}/api/payments/tabby/webhook`;
  console.log(`Registering webhook: ${webhookUrl}`);

  const result = await registerTabbyWebhook(webhookUrl);
  console.log("✅ Registered:", result);
}

main().catch((e) => {
  console.error("❌ Failed:", e);
  process.exit(1);
});
