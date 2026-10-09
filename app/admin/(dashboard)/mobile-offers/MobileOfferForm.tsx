"use client";

import { useActionState, useState } from "react";
import { Send, Smartphone } from "lucide-react";
import {
  sendMobileOfferAction,
  type MobileAudience,
  type MobileOfferSendState,
} from "@/app/admin/mobile-offers-actions";
import { AdminImageField } from "@/components/admin/AdminImageField";

const INITIAL: MobileOfferSendState = { ok: false, message: "" };

const MAX_TITLE = 80;
const MAX_BODY = 240;

const inputClass =
  "mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2";

export function MobileOfferForm({ audience }: { audience: MobileAudience }) {
  const [state, formAction, pending] = useActionState(sendMobileOfferAction, INITIAL);
  const [target, setTarget] = useState("all");
  const [title, setTitle] = useState("روائس");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const RECIPIENTS: Record<string, number> = {
    all: audience.allPromotions,
    registered: audience.promotionsOptedIn,
    anonymous: audience.anonymousDevices,
    "registered-booking-updates": audience.bookingUpdatesOptedIn,
  };
  const recipients: number | null = RECIPIENTS[target] ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <form
        action={formAction}
        className="grid gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6"
      >
        <label className="text-sm font-medium">
          وجهة الإرسال
          <select
            name="target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className={inputClass}
          >
            <option value="all">الكل — مسجّلين وغير مسجّلين ({audience.allPromotions} جهاز)</option>
            <option value="registered">
              المسجّلون فقط ({audience.promotionsOptedIn} جهاز)
            </option>
            <option value="anonymous">
              غير المسجّلين فقط ({audience.anonymousDevices} جهاز)
            </option>
            <option value="registered-booking-updates">
              المسجّلون — قناة تحديثات الحجز ({audience.bookingUpdatesOptedIn} جهاز)
            </option>
            <option value="single">عميل واحد برقمه</option>
          </select>
        </label>

        {target === "single" && (
          <label className="text-sm font-medium">
            رقم العميل (customerId)
            <input name="customerId" required inputMode="numeric" placeholder="34" className={inputClass} />
          </label>
        )}

        {/* «غير مسجّل» = نزّل التطبيق ولم يسجّل دخولاً. من لم يُنزّل التطبيق لا
            يمكن مخاطبته أصلاً — الإشعار يحتاج جهازاً سجّل رمزه عندنا. */}
        {(target === "anonymous" || target === "all") && (
          <p className="rounded-xl bg-surface-container-highest px-4 py-3 text-xs text-on-surface-variant">
            «غير مسجّل» يعني من نزّل التطبيق ولم يسجّل دخولاً. لا تملك هذه الأجهزة
            تفضيلات إشعارات (التفضيلات مربوطة بحساب) فتصلها الرسالة دائماً.
          </p>
        )}

        {/* إظهار العدد يمنع إرسالاً يظن صاحبه أنه وصل للجميع — قناة العروض
            افتراضها مغلق، فجمهور المسجّلين فيها أصغر بكثير مما يُتوقَّع. */}
        {recipients === 0 && (
          <p className="rounded-xl bg-error-container px-4 py-3 text-sm font-bold text-on-error-container">
            لا يوجد أي جهاز في هذه الفئة — لن يصل الإشعار لأحد.
          </p>
        )}

        <label className="text-sm font-medium">
          العنوان
          <input
            name="title"
            required
            maxLength={MAX_TITLE}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-on-surface-variant">
            {title.length}/{MAX_TITLE}
          </span>
        </label>

        <label className="text-sm font-medium">
          نص الرسالة
          <textarea
            name="body"
            required
            rows={3}
            maxLength={MAX_BODY}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="مثال: خصم ٢٠٪ على الإيجار الشهري حتى نهاية الأسبوع."
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-on-surface-variant">
            {body.length}/{MAX_BODY}
          </span>
        </label>

        <AdminImageField
          label="صورة الإشعار (اختياري)"
          fileHelp="تظهر فقط على أندرويد (Big Picture) — بحد أقصى 5 ميجابايت."
          onImageUrlChange={setImageUrl}
        />

        <label className="text-sm font-medium">
          رقم حجز (اختياري)
          <input name="bookingId" inputMode="numeric" placeholder="297" className={inputClass} />
          <span className="mt-1 block text-xs text-on-surface-variant">
            لو حطيته، الضغط على الإشعار يفتح شاشة تفاصيل هذا الحجز في التطبيق.
          </span>
        </label>

        <button
          type="submit"
          disabled={pending}
          className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-extrabold text-on-primary disabled:opacity-60"
        >
          <Send className="size-4" />
          {pending ? "جارٍ الإرسال…" : "إرسال الإشعار"}
        </button>

        {state.message && (
          <p
            className={`rounded-xl px-4 py-3 text-sm font-bold ${
              state.ok
                ? "bg-tertiary-container text-on-tertiary-container"
                : "bg-error-container text-on-error-container"
            }`}
          >
            {state.message}
          </p>
        )}
      </form>

      <aside className="grid content-start gap-4">
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
          <h2 className="flex items-center gap-2 text-sm font-extrabold">
            <Smartphone className="size-4" />
            الجمهور
          </h2>
          <dl className="mt-4 grid gap-2 text-sm">
            <Stat label="إجمالي الأجهزة" value={audience.devices} />
            <Stat label="عملاء مسجّلون" value={audience.customers} />
            <Stat label="أجهزة غير مسجّلة" value={audience.anonymousDevices} />
            <Stat label="مشترك في العروض" value={audience.promotionsOptedIn} />
            <Stat label="مشترك في تحديثات الحجز" value={audience.bookingUpdatesOptedIn} />
          </dl>
        </div>

        {/* معاينة حيّة بشكل إشعار أندرويد — أسرع من بناء APK لتجربة الصياغة. */}
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
          <h2 className="text-sm font-extrabold">المعاينة</h2>
          <div className="mt-3 rounded-2xl bg-surface-container-highest p-3 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] text-on-surface-variant">
              <span className="inline-block size-3 rounded-sm bg-[#003749]" />
              روائس · الآن
            </div>
            <p className="mt-1.5 text-sm font-extrabold break-words">{title || "العنوان"}</p>
            <p className="mt-0.5 text-sm text-on-surface-variant break-words">
              {body || "نص الرسالة يظهر هنا."}
            </p>
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt=""
                className="mt-2 aspect-[2/1] w-full rounded-lg object-cover"
              />
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="font-extrabold tabular-nums">{value}</dd>
    </div>
  );
}
