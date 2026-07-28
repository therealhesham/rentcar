"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import { createGeideaCheckoutSession, refundGeideaPayment } from "@/lib/geidea/client";
import { TEST_GEIDEA_REF_COOKIE } from "@/lib/test-geidea-constants";

/**
 * أداة اختبار داخلية لبوابة جيديا على بيئة الإنتاج الحقيقية — سوبر أدمن فقط.
 * تستخدم `bookingRequestId: 0` عمداً: صيغة المرجع الناتجة `booking-0-{ts}` لا
 * تُطابق شرط `id >= 1` في `bookingIdFromGeideaReference`، فيتجاهلها الـwebhook
 * تماماً (`ignored: unknown reference`) ولا يمسّ أي حجز حقيقي.
 *
 * مرجع الجلسة (merchantReferenceId) يُنشأ داخل createGeideaCheckoutSession نفسها،
 * فلا يمكن تضمينه في returnUrl مسبقاً — يُحفظ بدلاً من ذلك في كوكي قصيرة العمر
 * لتُقرأ عند عودة العميل من صفحة الدفع.
 */

const TEST_AMOUNT_SAR = 1;

export async function startGeideaTestPaymentAction(): Promise<void> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) redirect("/admin/test-geidea?error=" + encodeURIComponent(auth.error));

  const appUrl = (process.env.APP_PUBLIC_URL ?? "").trim().replace(/\/$/, "");

  let redirectUrl: string;
  let merchantReferenceId: string;
  try {
    console.log("[test-geidea] Starting test payment session creation...");
    const session = await createGeideaCheckoutSession({
      bookingRequestId: 0,
      amountSar: TEST_AMOUNT_SAR,
      returnUrl: `${appUrl}/admin/test-geidea`,
      callbackUrl: `${appUrl}/api/payments/geidea/webhook`,
    });
    redirectUrl = session.redirectUrl;
    merchantReferenceId = session.merchantReferenceId;
    console.log("[test-geidea] Session created successfully:", session);
  } catch (e) {
    const detailMsg = e instanceof Error ? e.message : String(e);
    console.error("[test-geidea] session creation failed:", e);
    redirect("/admin/test-geidea?error=" + encodeURIComponent(`تعذّر إنشاء جلسة الدفع: ${detailMsg}`));
  }

  const jar = await cookies();
  jar.set(TEST_GEIDEA_REF_COOKIE, merchantReferenceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin/test-geidea",
    maxAge: 15 * 60,
  });

  redirect(redirectUrl);
}

export type ApplePayTestSessionResult =
  | { ok: true; sessionId: string }
  | { ok: false; error: string };

/**
 * جلسة اختبار Apple Pay السريعة (Express Checkout) بريال واحد — سوبر أدمن فقط.
 * تستخدم نفس حيلة `bookingRequestId: 0` فيتجاهلها الـwebhook ولا تمسّ أي حجز.
 * تُرجع sessionId (لا تُحوّل) لأن زر Apple Pay يُركَّب على صفحتنا نفسها.
 */
export async function startGeideaApplePayTestSessionAction(): Promise<ApplePayTestSessionResult> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const appUrl = (process.env.APP_PUBLIC_URL ?? "").trim().replace(/\/$/, "");
  try {
    const session = await createGeideaCheckoutSession({
      bookingRequestId: 0,
      amountSar: TEST_AMOUNT_SAR,
      callbackUrl: `${appUrl}/api/payments/geidea/webhook`,
      expressCheckoutWallets: ["apple-pay"],
    });
    console.log("[test-geidea] apple pay express session created:", session.sessionId);
    // نفس الكوكي التي يقرأها كرت «نتيجة آخر دفعة اختبار» — بعد نجاح الدفع يكفي
    // تحديث الصفحة ليُجلب الطلب من جيديا بنفس المسار المستخدم مع HPP.
    const jar = await cookies();
    jar.set(TEST_GEIDEA_REF_COOKIE, session.merchantReferenceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/admin/test-geidea",
      maxAge: 15 * 60,
    });
    return { ok: true, sessionId: session.sessionId };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error("[test-geidea] apple pay express session failed:", e);
    return { ok: false, error: `تعذّر إنشاء جلسة Apple Pay: ${detail}` };
  }
}

export type RefundActionState = {
  ok: boolean;
  error?: string;
  refundTransactionRef?: string;
  orderStatus?: string;
};

export async function refundGeideaTestPaymentAction(
  _prev: RefundActionState | null,
  formData: FormData,
): Promise<RefundActionState> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const orderId = String(formData.get("orderId") ?? "").trim();
  const amountRaw = Number(formData.get("amountSar"));
  if (!orderId) return { ok: false, error: "معرّف الطلب (orderId) مفقود." };
  if (!Number.isFinite(amountRaw) || amountRaw <= 0) {
    return { ok: false, error: "مبلغ الاسترداد غير صالح." };
  }

  try {
    const result = await refundGeideaPayment({
      paymentGatewayRef: orderId,
      amountSar: amountRaw,
    });
    return {
      ok: true,
      refundTransactionRef: result.refundTransactionRef,
      orderStatus: result.orderStatus,
    };
  } catch (e) {
    console.error("[test-geidea] refund failed:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "فشل تنفيذ الاسترداد.",
    };
  }
}
