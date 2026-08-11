/**
 * تنزيل قاعدة GeoLite2-City من MaxMind إلى `data/GeoLite2-City.mmdb`.
 *
 * تشغيل: `MAXMIND_LICENSE_KEY=xxx node scripts/download-geolite.mjs`
 * أو ضع المفتاح في `.env` وشغّل: `npm run geo:update`
 *
 * MaxMind تحدّث القاعدة أسبوعياً (كل ثلاثاء). أعد التشغيل من وقت لآخر حتى لا
 * تتقادم — العناوين تُعاد توزيعها بين المشغّلين باستمرار.
 */
import { createWriteStream } from "node:fs";
import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { spawn } from "node:child_process";

const licenseKey = process.env.MAXMIND_LICENSE_KEY?.trim();
if (!licenseKey) {
  console.error(
    "✗ MAXMIND_LICENSE_KEY غير موجود.\n" +
      "  أنشئ حساباً مجانياً على https://www.maxmind.com/en/geolite2/signup\n" +
      "  ثم My Account → Manage License Keys → Generate new license key\n" +
      "  وضعه في .env باسم MAXMIND_LICENSE_KEY",
  );
  process.exit(1);
}

const DATA_DIR = join(process.cwd(), "data");
const TARGET = join(DATA_DIR, "GeoLite2-City.mmdb");
const TMP_DIR = join(DATA_DIR, ".geolite-tmp");

const url =
  "https://download.maxmind.com/app/geoip_download" +
  `?edition_id=GeoLite2-City&license_key=${encodeURIComponent(licenseKey)}&suffix=tar.gz`;

await mkdir(DATA_DIR, { recursive: true });
await rm(TMP_DIR, { recursive: true, force: true });
await mkdir(TMP_DIR, { recursive: true });

console.log("… جارٍ التنزيل من MaxMind");
const res = await fetch(url);
if (!res.ok) {
  const body = await res.text().catch(() => "");
  console.error(`✗ فشل التنزيل: ${res.status} ${res.statusText}\n${body.slice(0, 300)}`);
  console.error("  تأكد أن المفتاح صالح وأن نوعه GeoLite2 (لا GeoIP2 المدفوع).");
  process.exit(1);
}

// الأرشيف tar.gz: نفكّ الـ gzip ثم نمرّر الـ tar لأمر النظام (أبسط من مكتبة tar).
const tarPath = join(TMP_DIR, "geolite.tar");
await pipeline(res.body, createGunzip(), createWriteStream(tarPath));

await new Promise((resolve, reject) => {
  const child = spawn("tar", ["-xf", tarPath, "-C", TMP_DIR], { stdio: "inherit" });
  child.on("error", reject);
  child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`tar exited ${code}`))));
});

// الأرشيف يفكّ إلى مجلد مؤرَّخ مثل GeoLite2-City_20260811/
const entries = await readdir(TMP_DIR, { withFileTypes: true });
const extracted = entries.find((e) => e.isDirectory() && e.name.startsWith("GeoLite2-City"));
if (!extracted) {
  console.error("✗ لم يُعثر على مجلد القاعدة داخل الأرشيف");
  process.exit(1);
}

await rename(join(TMP_DIR, extracted.name, "GeoLite2-City.mmdb"), TARGET);
await rm(TMP_DIR, { recursive: true, force: true });

const { size } = await stat(TARGET);
console.log(`✓ تم: ${TARGET} (${(size / 1024 / 1024).toFixed(1)} MB)`);
