import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Link2 } from "lucide-react";
import { verifyAdminSession } from "@/lib/admin-auth";
import { listGowebSources } from "@/lib/goweb-crm";
import { getAppPublicUrl } from "@/lib/app-public-url";
import { CampaignLinksGenerator } from "./CampaignLinksGenerator";

export const dynamic = "force-dynamic";

/** نطاق الموقع: من رابط المصدر المسجّل في GoWeb، وإلا من إعدادات البيئة. */
function pickBaseUrl(urls: Array<string | null>): string {
  for (const u of urls) {
    if (!u) continue;
    try {
      return new URL(u).origin;
    } catch {
      /* رابط غير صالح — نجرّب اللي بعده */
    }
  }
  return getAppPublicUrl();
}

export default async function AdminCampaignLinksPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const sources = await listGowebSources();
  const baseUrl = pickBaseUrl((sources ?? []).map((s) => s.url));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="relative overflow-hidden rounded-3xl bg-surface-container p-8 shadow-sm border border-outline-variant/30">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-primary/10 text-primary rounded-xl">
                <Link2 className="w-6 h-6" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">روابط الحملات</h1>
            </div>
            <p className="mt-2 max-w-2xl text-on-surface-variant leading-relaxed">
              روابط جاهزة لكل مصدر إعلاني (Meta وTikTok وSnapchat ...). حطّ الرابط في الإعلان، وأي
              طلب أو ضغطة من الزائر بتتنسب للمصدر الصح في GoWeb. إعلانات Google مش محتاجة رابط خاص —
              بتتعرف تلقائيًا.
            </p>
          </div>
          <Link
            href="/admin"
            className="group flex items-center gap-2 rounded-xl bg-surface-container-high px-5 py-3 text-sm font-semibold text-primary transition-all hover:bg-primary hover:text-on-primary hover:shadow-md"
          >
            العودة للوحة التحكم
            <ArrowRight className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          </Link>
        </div>
      </header>

      {sources === null ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          تعذّر تحميل المصادر من GoWeb الآن. جرّب تحدّث الصفحة بعد شوية.
        </div>
      ) : sources.length === 0 ? (
        <div className="rounded-3xl border border-outline-variant/30 bg-surface-container p-8 text-center text-on-surface-variant">
          مفيش مصادر مسجّلة في GoWeb لهذا الحساب.
        </div>
      ) : (
        <CampaignLinksGenerator sources={sources} initialBaseUrl={baseUrl} />
      )}
    </div>
  );
}
