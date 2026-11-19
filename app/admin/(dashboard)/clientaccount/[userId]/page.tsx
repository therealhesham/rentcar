import Link from "next/link";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { Eye, ExternalLink, ShieldAlert } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CustomerAccountView } from "@/components/account/CustomerAccountView";
import { bookingBranchWhere } from "@/lib/admin-access";
import { requireAdminPage } from "@/lib/admin-page";
import { getCustomerProfileById } from "@/lib/customer-auth";
import { customerIdsInSessionScope, sessionSeesAllCustomers } from "../client-account-scope";

export const dynamic = "force-dynamic";

/** صفحة الحساب تُعرض للعملاء بالعربية افتراضياً — المعاينة بنفس اللغة. */
const PREVIEW_LOCALE = "ar";

/**
 * معاينة حساب العميل كما يراه هو — للعرض فقط.
 *
 * تقرأ الملف مباشرة بالمعرّف (`getCustomerProfileById`) ولا تلمس كوكي جلسة العميل،
 * وتعرض نفس `CustomerAccountView` الذي تعرضه صفحة `/account` بـ `readOnly`: الروابط
 * لا تنتقل والأزرار معطّلة، وإجراءات السيرفر الخاصة بالعميل (إلغاء/تعديل/دفع) تتحقق
 * أصلاً من جلسة العميل فلا تعمل من جلسة الموظف حتى لو استُدعيت.
 */
export default async function AdminClientAccountPreviewPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await requireAdminPage();
  const { userId: rawUserId } = await params;
  const userId = Number(rawUserId);
  if (!Number.isInteger(userId) || userId < 1) notFound();

  const profile = await getCustomerProfileById(userId);
  if (!profile) notFound();

  const seesAll = sessionSeesAllCustomers(session);
  if (!seesAll) {
    const allowed = await customerIdsInSessionScope(session, [profile]);
    if (!allowed.has(profile.id)) notFound();
  }

  const messages = await getMessages({ locale: PREVIEW_LOCALE });

  return (
    <>
      <AdminPageHeader
        title={`حساب ${profile.name?.trim() || "العميل"}`}
        description="هذه الصفحة كما تظهر للعميل عند فتح «حسابي» في الموقع."
        backHref="/admin/clientaccount"
        backLabel="البحث عن عميل"
        actions={
          <Link
            href={`/admin/customers?q=${encodeURIComponent(profile.phone ?? profile.name ?? "")}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant/40 bg-white px-4 py-2 text-sm font-bold text-on-surface shadow-sm transition hover:border-primary hover:text-primary"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            في صفحة العملاء
          </Link>
        }
      />

      {/* شريط وضع المعاينة — ثابت أعلى المحتوى أثناء التمرير */}
      <div
        role="status"
        className="sticky top-2 z-20 mb-6 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50/95 px-4 py-3.5 text-amber-950 shadow-md backdrop-blur-sm sm:items-center"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-200/70 text-amber-900">
          <Eye className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 text-sm leading-relaxed">
          <p className="font-extrabold">وضع المعاينة — للعرض فقط</p>
          <p className="font-semibold text-amber-900/90">
            ترى الحساب كما يراه العميل. كل الأزرار معطّلة ولا يُنفَّذ أي إجراء (دفع، إلغاء، تعديل،
            إعادة حجز) نيابةً عنه. رقم الحجز على كل بطاقة يفتحه في لوحة الإدارة.
          </p>
        </div>
      </div>

      {!seesAll ? (
        <p className="mb-6 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold leading-relaxed text-sky-950">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          تظهر هنا حجوزات العميل داخل نطاق فرعك/مدينتك فقط — قد يرى العميل في حسابه حجوزات
          أخرى خارج نطاقك.
        </p>
      ) : null}

      {/* نفس حاوية صفحة العميل (RTL وخلفيتها) كي تطابق ما يراه */}
      <div dir="rtl" className="rounded-3xl bg-[#f4f4f5] p-3 text-on-surface sm:p-5">
        <NextIntlClientProvider locale={PREVIEW_LOCALE} messages={{ Account: messages.Account }}>
          <CustomerAccountView
            profile={profile}
            locale={PREVIEW_LOCALE}
            readOnly
            bookingScopeWhere={seesAll ? undefined : bookingBranchWhere(session)}
          />
        </NextIntlClientProvider>
      </div>
    </>
  );
}
