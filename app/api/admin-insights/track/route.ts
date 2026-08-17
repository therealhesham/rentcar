import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { isTrackableAdminPath, recordAdminPageView } from "@/lib/insights/insights-track";

export const dynamic = "force-dynamic";

/**
 * استقبال فتحات صفحات لوحة التحكم من المتصفح (يرسلها `AdminInsightsTracker`).
 *
 * المسار **فقط** يُؤخذ من الجسم؛ هوية الموظف تُقرأ من كوكي الجلسة على الخادم، فلا
 * يستطيع أحد نسبة نشاطه إلى زميل. الرد دائماً 200 حتى لا يُظهر `sendBeacon` أخطاء
 * في كونسول الموظف.
 */
export async function POST(request: Request) {
  let path = "";
  try {
    const body = (await request.json()) as { path?: unknown };
    path = String(body.path ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!isTrackableAdminPath(path)) return NextResponse.json({ ok: true });

  const session = await getAdminSession();
  if (!session) return NextResponse.json({ ok: true });

  await recordAdminPageView(session, path);
  return NextResponse.json({ ok: true });
}
