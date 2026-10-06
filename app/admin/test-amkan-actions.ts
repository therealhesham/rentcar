"use server";

import { requirePermissionForAction } from "@/lib/admin-access";
import {
  createAmkanOrder,
  fetchAmkanMerchantConfigRaw,
  fetchAmkanOrderStatus,
  getAmkanCredentials,
  type AmkanConfig,
  type AmkanCredentials,
} from "@/lib/amkan/client";

/**
 * أداة اختبار داخلية لبوابة إمكان على بيئة الساندبوكس — سوبر أدمن فقط.
 *
 * سبب وجودها: ثلاث قيم في المواصفة غير محسومة (`merchantId` لم يصل،
 * `origin-source-channel` قيمته للإيكوميرس غير موثّقة، وزوجا الحدود `order*`/`bnpl*`
 * لا تبيّن الوثيقة أيّهما الملزم). تجريبها عبر حجز حقيقي غير وارد، فتُجرَّب هنا
 * كقيم في نموذج قبل تثبيتها في `.env`.
 *
 * الأمان: كل طلب اختباري يُنشأ بـ `bookingRequestId: 0` فيصير مرجعنا
 * `booking-0-{ts}`، ولا يُكتب في أي عمود على أي حجز — فالويب هوك يبحث عن الحجز بـ
 * `paymentGatewayRef` ولن يجد شيئاً، فيتجاهل الإشعار (`ignored: unknown order`).
 * لا يمكن لهذه الأداة أن تمسّ حجزاً حقيقياً.
 */

const ACTION_PAGE = "/admin/test-amkan";

/** يبني بيانات الاعتماد من النموذج، ويقع على البيئة لما لم يُملأ. */
function credentialsFrom(formData: FormData): AmkanCredentials | { error: string } {
  const env = getAmkanCredentials();
  const merchantId = String(formData.get("merchantId") ?? "").trim() || env?.merchantId || "";
  const apiBase =
    String(formData.get("apiBase") ?? "").trim() ||
    env?.apiBase ||
    "https://sit-gw-pub.emkanfinance.com.sa";
  const username = env?.username ?? "";
  const password = env?.password ?? "";

  if (!username || !password) {
    return { error: "AMKAN_USERNAME و AMKAN_PASSWORD غير مضبوطين في .env — أضفهما ثم أعد المحاولة." };
  }
  if (!merchantId) {
    return { error: "merchantId مطلوب: اكتبه في الحقل أعلاه أو اضبط AMKAN_MERCHANT_ID في .env." };
  }
  return { merchantId, username, password, apiBase: apiBase.replace(/\/$/, "") };
}

export type AmkanProbeState = {
  ok: boolean;
  error?: string;
  /** الرد الخام من إمكان — يُعرض كما هو، فالهدف من الأداة رؤية ما ترسله فعلاً. */
  raw?: string;
  hint?: string;
};

/**
 * فحص الاتصال + اكتشاف الإعدادات. نداء واحد يكشف `merchantCode` و`serviceStatus`
 * والحدود الأربعة معاً — وهو أسرع طريق لحسم سؤال `order*` مقابل `bnpl*`.
 */
export async function probeAmkanMerchantConfigAction(
  _prev: AmkanProbeState | null,
  formData: FormData,
): Promise<AmkanProbeState> {
  const auth = await requirePermissionForAction(ACTION_PAGE);
  if (!auth.ok) return { ok: false, error: auth.error };

  const creds = credentialsFrom(formData);
  if ("error" in creds) return { ok: false, error: creds.error };

  try {
    const data = await fetchAmkanMerchantConfigRaw(creds);
    const merchantCode = typeof data.merchantCode === "string" ? data.merchantCode.trim() : "";
    const orderLo = data.orderLowerLimit;
    const orderHi = data.orderUpperLimit;
    const bnplLo = data.bnplLowerLimit;
    const bnplHi = data.bnplUpperLimit;

    const hints: string[] = [];
    if (merchantCode) {
      hints.push(`merchantCode = "${merchantCode}" ← ضعه في AMKAN_MERCHANT_CODE`);
    }
    if (orderLo != null || bnplLo != null) {
      hints.push(
        `الحدود: order = ${orderLo ?? "—"}..${orderHi ?? "—"} | bnpl = ${bnplLo ?? "—"}..${bnplHi ?? "—"}` +
          (orderLo !== bnplLo || orderHi !== bnplHi
            ? " — الزوجان مختلفان، اسأل إمكان أيّهما الملزم لطلبات BNPL."
            : " — الزوجان متطابقان، فالسؤال ساقط عملياً."),
      );
    }
    if (typeof data.serviceStatus === "string" && data.serviceStatus.toUpperCase() !== "ACTIVE") {
      hints.push(`⚠️ serviceStatus = ${data.serviceStatus} (ليست ACTIVE)`);
    }

    return { ok: true, raw: JSON.stringify(data, null, 2), hint: hints.join("\n") || undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, hint: authFailureHint(msg, creds) };
  }
}

/**
 * تشخيص الرفض. الفرق الحاسم — مُحقَّق عملياً في 2026-10-02 بتجريب نفس النداء من
 * مصدرين — أن الرفض نوعان لا نوع واحد، ولا يصحّ خلطهما:
 *
 * | المصدر                  | الرد                                  | المعنى                       |
 * |-------------------------|---------------------------------------|------------------------------|
 * | سيرفرنا `31.97.55.12`   | `403` + HTML فيه `server: cloudflare` | محجوب **قبل** إمكان          |
 * | عنوان يَعبُر Cloudflare | `401` JSON بـ`requestId` بادئته `AGW` | وصل بوابة إمكان فعلاً وردّت  |
 *
 * الحجب ثابت على IPv4 وIPv6 ومع User-Agent متصفّح كامل — فهو على مستوى الـIP.
 * ولهذا لا تُقال جملة «الطلب وصل إلى إمكان» إلا حين يثبت ذلك من شكل الرد نفسه.
 */
function authFailureHint(message: string, creds: AmkanCredentials): string | undefined {
  if (!message.includes("HTTP 401") && !message.includes("HTTP 403")) return undefined;

  // ردّ HTML (لا JSON) معناه أن حاجزاً شبكياً ردّ بدل إمكان — فواجهتها لا تُرجع HTML أبداً.
  const isNetworkBlock =
    /<!DOCTYPE html|<html/i.test(message) || /cloudflare|access denied|forbidden/i.test(message);
  if (isNetworkBlock) {
    return [
      "⛔ حجب شبكي — الطلب لم يصل إلى إمكان إطلاقاً.",
      "الرد صفحة HTML من طبقة حماية (Cloudflare) لا JSON من إمكان، فلم يُفحَص اليوزر/الباسورد أصلاً.",
      "المفاتيح غير متورّطة هنا: لا تضيّع وقتاً في مراجعتها.",
      "المطلوب: أن تضيف إمكان عنوانَي سيرفرنا إلى قائمة السماح في طبقة Cloudflare/WAF —",
      "IPv4: 31.97.55.12 | IPv6: 2a02:4780:28:16e1::1 (ثابت على البروتوكولين ومع User-Agent متصفّح).",
      "أرسل لهم cf-ray من سجل السيرفر وقت المحاولة؛ يفتحونه في لوحتهم ويرون قاعدة الحجب مباشرةً.",
    ].join("\n");
  }

  // وصل بوابتهم: `AGW` بادئة requestId في ردود API Gateway لديهم.
  const reachedGateway = /"requestId"\s*:\s*"AGW/i.test(message);
  const isDocumentedBnplError = /[A-Za-z]+-\d{4}/.test(message);
  return [
    reachedGateway
      ? "الطلب وصل بوابة إمكان وعُولج (requestId ببادئة AGW) — فالعنوان والمسار والمنفذ الشبكي سليمة."
      : "رُفضت المصادقة. شكل الرد لا يحدّد إن كان وصل بوابة إمكان أم حُجب قبلها — راجع الرد الخام أعلاه.",
    isDocumentedBnplError
      ? "١) الرسالة تطابق نمط أخطاء BNPL الموثّقة في المواصفة — الأرجح مفتاح خاطئ أو تسجيل ناقص."
      : "١) الرسالة عامة («General Integration Error») ولا ترد في أي جدول أخطاء بالمواصفة V1.7، " +
        "بينما كل رسائل 401 الموثّقة محدَّدة بالاسم (Credentials are invalid / Merchant Id is not " +
        "related to Merchant Code). اسأل إمكان عن معنى هذا الرد تحديداً وعن صحة merchantId/merchantCode.",
    "٢) حرف ملتبس عند النسخ: قارن l (لام صغيرة) بـ I (آي كبيرة) في AMKAN_USERNAME و AMKAN_PASSWORD — انسخهما من البورتال بالتحديد لا بإعادة الكتابة.",
    "٣) مسافة أو سطر زائد داخل علامتَي الاقتباس في .env.",
    `للتحقّق: طول المستخدم الحالي ${creds.username.length} حرفاً وكلمة المرور ${creds.password.length} حرفاً (المتوقّع 28 لكليهما).`,
  ].join("\n");
}

/**
 * إنشاء طلب تمويل تجريبي. هنا تُجرَّب قيمة `origin-source-channel`: الهيدر إلزامي
 * وقيمته للإيكوميرس غير موثّقة، فتُكتب في النموذج ويُقرأ رد إمكان مباشرةً.
 */
export async function createAmkanTestOrderAction(
  _prev: AmkanProbeState | null,
  formData: FormData,
): Promise<AmkanProbeState> {
  const auth = await requirePermissionForAction(ACTION_PAGE);
  if (!auth.ok) return { ok: false, error: auth.error };

  const creds = credentialsFrom(formData);
  if ("error" in creds) return { ok: false, error: creds.error };

  const merchantCode =
    String(formData.get("merchantCode") ?? "").trim() ||
    process.env.AMKAN_MERCHANT_CODE?.trim() ||
    "";
  const originSourceChannel =
    String(formData.get("originSourceChannel") ?? "").trim() ||
    process.env.AMKAN_ORIGIN_SOURCE_CHANNEL?.trim() ||
    "";
  if (!merchantCode) return { ok: false, error: "merchantCode مطلوب — استخرجه من «فحص الإعدادات» أولاً." };
  if (!originSourceChannel) {
    return { ok: false, error: "origin-source-channel مطلوب — جرّب قيمة (مثلاً Neoleap_POS) وشوف رد إمكان." };
  }

  const amountSar = Number(formData.get("amountSar"));
  if (!Number.isFinite(amountSar) || amountSar <= 0) {
    return { ok: false, error: "المبلغ غير صالح." };
  }
  const mobileNumber = String(formData.get("mobileNumber") ?? "").trim();

  const cfg: AmkanConfig = { ...creds, merchantCode, originSourceChannel };
  const appUrl = (process.env.APP_PUBLIC_URL ?? "").trim().replace(/\/$/, "");

  try {
    const session = await createAmkanOrder(
      {
        bookingRequestId: 0, // لا يطابق أي حجز — الويب هوك سيتجاهل أي إشعار عنه
        amountSar,
        mobileNumber: mobileNumber || undefined,
        returnUrl: `${appUrl}${ACTION_PAGE}`,
        callbackUrl: `${appUrl}/api/payments/amkan/webhook`,
        expiresInMinutes: 30,
      },
      cfg,
    );
    return {
      ok: true,
      raw: JSON.stringify(session, null, 2),
      hint:
        `افتح paymentURL لإكمال رحلة العميل، ثم استعلم عن الحالة بـ orderCode = ${session.gatewayOrderId}` +
        (appUrl.startsWith("https://") ? "" : "\n⚠️ APP_PUBLIC_URL ليس HTTPS — لن يصل إشعار من إمكان."),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** استعلام حالة طلب — للتأكد من وصول الرحلة إلى COMPLETED بعد الدفع. */
export async function checkAmkanOrderStatusAction(
  _prev: AmkanProbeState | null,
  formData: FormData,
): Promise<AmkanProbeState> {
  const auth = await requirePermissionForAction(ACTION_PAGE);
  if (!auth.ok) return { ok: false, error: auth.error };

  const creds = credentialsFrom(formData);
  if ("error" in creds) return { ok: false, error: creds.error };

  const orderCode = String(formData.get("orderCode") ?? "").trim();
  if (!orderCode) return { ok: false, error: "orderCode مطلوب." };

  try {
    const status = await fetchAmkanOrderStatus(orderCode, creds);
    return {
      ok: true,
      raw: JSON.stringify(status, null, 2),
      hint:
        status.statusCode === "COMPLETED"
          ? "COMPLETED = دُفعت الدفعة الأولى بنجاح (نظير paid عند جيديا)."
          : `الحالة ${status.statusCode} — ليست اكتمالاً؛ لا يُعلَّم أي حجز مدفوعاً.`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
