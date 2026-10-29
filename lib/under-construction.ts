/**
 * وضع «قيد الإنشاء»: يُفعَّل من لوحة التحكم ويحجب الموقع العام عن الزوار ومحركات البحث.
 * الملف بلا اعتماديات خادم (لا Prisma) لأن middleware (Edge) يستورده.
 */

export const SITE_KEY_UNDER_CONSTRUCTION = "under_construction_v1";

export const UNDER_CONSTRUCTION_MESSAGE_MAX = 500;

export const DEFAULT_UNDER_CONSTRUCTION_MESSAGE =
  "الموقع قيد الإنشاء حالياً، نعود إليكم قريباً.";

export type UnderConstructionSettings = {
  enabled: boolean;
  /** نص مخصص يظهر للزائر؛ فارغ = النص الافتراضي. */
  message: string;
};

export const DEFAULT_UNDER_CONSTRUCTION: UnderConstructionSettings = {
  enabled: false,
  message: "",
};

export function normalizeUnderConstruction(raw: unknown): UnderConstructionSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_UNDER_CONSTRUCTION;
  const o = raw as Record<string, unknown>;
  return {
    enabled: o.enabled === true,
    message:
      typeof o.message === "string"
        ? o.message.trim().slice(0, UNDER_CONSTRUCTION_MESSAGE_MAX)
        : "",
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** صفحة HTML مستقلة تُرجعها middleware بدل أي صفحة عامة أثناء وضع «قيد الإنشاء». */
export function renderUnderConstructionHtml(message: string): string {
  const text = escapeHtml(message.trim() || DEFAULT_UNDER_CONSTRUCTION_MESSAGE).replace(
    /\r?\n/g,
    "<br />",
  );
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
<title>قيد الإنشاء</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
    background:#f5f7f8;color:#003749;font-family:Tahoma,Arial,sans-serif;text-align:center}
  main{max-width:480px}
  .icon{font-size:56px;margin-bottom:12px}
  h1{font-size:26px;margin:0 0 12px}
  p{font-size:16px;line-height:1.9;margin:0;color:#3b5a66}
</style>
</head>
<body>
<main>
  <div class="icon" aria-hidden="true">🚧</div>
  <h1>قيد الإنشاء</h1>
  <p>${text}</p>
</main>
</body>
</html>`;
}
