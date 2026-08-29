"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requirePermissionForAction } from "@/lib/admin-access";
import {
  captureTabbyPayment,
  createTabbyCheckoutSession,
  refundTabbyPayment,
} from "@/lib/tabby/client";
import { TEST_TABBY_PAYMENT_COOKIE } from "@/lib/test-tabby-constants";

/**
 * أداة اختبار داخلية لبوابة تابي على بيئة الإنتاج الحقيقية — سوبر أدمن فقط.
 * تستخدم `bookingRequestId: 0` عمداً: صيغة المرجع الناتجة `booking-0-{ts}` لا
 * تُطابق شرط `id >= 1` في `bookingIdFromTabbyReference`، فيتجاهلها الـwebhook
 * تماماً ولا يمسّ أي حجز حقيقي — ولهذا التحصيل هنا يدوي وليس تلقائياً كالإنتاج.
 */

export async function startTabbyTestPaymentAction(formData: FormData): Promise<void> {
  const auth = await requirePermissionForAction("/admin/test-tabby");
  if (!auth.ok) redirect("/admin/test-tabby?error=" + encodeURIComponent(auth.error));

  const amountSar = Number(formData.get("amountSar"));
  if (!Number.isFinite(amountSar) || amountSar <= 0) {
    redirect("/admin/test-tabby?error=" + encodeURIComponent("مبلغ غير صالح."));
  }

  const appUrl = (process.env.APP_PUBLIC_URL ?? "").trim().replace(/\/$/, "");
  const returnUrl = `${appUrl}/admin/test-tabby`;

  let webUrl: string;
  let paymentId: string;
  try {
    const session = await createTabbyCheckoutSession({
      bookingRequestId: 0,
      amountSar,
      buyer: {
        phone: "+966500000000",
        email: "test@rawaes.com",
        name: "Admin Test",
      },
      items: [{ title: "دفعة اختبار تابي", quantity: 1, unitPriceSar: amountSar }],
      successUrl: returnUrl,
      cancelUrl: returnUrl,
      failureUrl: returnUrl,
    });
    webUrl = session.webUrl;
    paymentId = session.paymentId;
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    redirect("/admin/test-tabby?error=" + encodeURIComponent(`تعذّر إنشاء جلسة الدفع: ${detail}`));
  }

  const jar = await cookies();
  jar.set(TEST_TABBY_PAYMENT_COOKIE, paymentId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin/test-tabby",
    maxAge: 15 * 60,
  });

  redirect(webUrl);
}

export type TabbyTestActionState = {
  ok: boolean;
  error?: string;
  status?: string;
  refundId?: string;
};

export async function captureTabbyTestPaymentAction(
  _prev: TabbyTestActionState | null,
  formData: FormData,
): Promise<TabbyTestActionState> {
  const auth = await requirePermissionForAction("/admin/test-tabby");
  if (!auth.ok) return { ok: false, error: auth.error };

  const paymentId = String(formData.get("paymentId") ?? "").trim();
  const amountSar = Number(formData.get("amountSar"));
  if (!paymentId) return { ok: false, error: "معرّف الدفعة (paymentId) مفقود." };
  if (!Number.isFinite(amountSar) || amountSar <= 0) {
    return { ok: false, error: "مبلغ غير صالح." };
  }

  try {
    const result = await captureTabbyPayment({ paymentId, amountSar });
    return { ok: true, status: result.status };
  } catch (e) {
    console.error("[test-tabby] capture failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "فشل تنفيذ التحصيل." };
  }
}

export async function refundTabbyTestPaymentAction(
  _prev: TabbyTestActionState | null,
  formData: FormData,
): Promise<TabbyTestActionState> {
  const auth = await requirePermissionForAction("/admin/test-tabby");
  if (!auth.ok) return { ok: false, error: auth.error };

  const paymentId = String(formData.get("paymentId") ?? "").trim();
  const amountSar = Number(formData.get("amountSar"));
  if (!paymentId) return { ok: false, error: "معرّف الدفعة (paymentId) مفقود." };
  if (!Number.isFinite(amountSar) || amountSar <= 0) {
    return { ok: false, error: "مبلغ استرداد غير صالح." };
  }

  try {
    const result = await refundTabbyPayment({ paymentId, amountSar });
    return { ok: true, status: result.status, refundId: result.refundId };
  } catch (e) {
    console.error("[test-tabby] refund failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "فشل تنفيذ الاسترداد." };
  }
}
