"use client";

import { Loader2, Shield } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SiteFooter } from "@/components/home/SiteFooter";
import { SiteNav } from "@/components/shared/SiteNav";
import { OtpPinInput } from "@/components/ui/OtpPinInput";
import { BOOKING_OTP_REGEX, bookingOtpLengthLabelAr } from "@/lib/booking-otp-constants";
import type { BookingOtpChannel } from "@/lib/site-settings";
import {
  isBranchOutsideHoursBookingError,
  stripBranchHoursErrorCodeForDisplay,
} from "@/lib/direct-booking-user-messages";

const TEAL = "#003749";
const GOLD = "#dbb878";

export function FleetCheckoutOtpClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const token = sp.get("token")?.trim() ?? "";
  const modelId = sp.get("modelId")?.trim() ?? "";

  const [mounted, setMounted] = useState(false);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [channel, setChannel] = useState<BookingOtpChannel | null>(null);
  const [destinationHint, setDestinationHint] = useState<string | null>(null);

  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [otpSendBusy, setOtpSendBusy] = useState(false);
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [otpCooldownSec, setOtpCooldownSec] = useState(0);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (otpCooldownSec <= 0) return;
    const id = window.setTimeout(() => setOtpCooldownSec((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [otpCooldownSec]);

  useEffect(() => {
    if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
      setMetaLoading(false);
      setMetaError("رابط التحقق غير صالح. ارجع إلى صفحة إتمام الحجز من الأسطول.");
      return;
    }
    let cancel = false;
    void (async () => {
      setMetaLoading(true);
      setMetaError(null);
      try {
        const res = await fetch(
          `/api/bookings/direct/draft/meta?token=${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        const j = (await res.json()) as {
          ok?: boolean;
          error?: string;
          channel?: string;
          destinationHint?: string;
        };
        if (cancel) return;
        if (j.ok !== true) {
          setMetaError(j.error ?? "تعذّر تحميل بيانات التحقق.");
          setMetaLoading(false);
          return;
        }
        const ch = String(j.channel ?? "").trim().toUpperCase();
        setChannel(
          ch === "SMS" || ch === "EMAIL" || ch === "WHATSAPP" || ch === "OFF"
            ? (ch as BookingOtpChannel)
            : "OFF",
        );
        setDestinationHint(typeof j.destinationHint === "string" ? j.destinationHint : null);
      } catch {
        if (!cancel) setMetaError("تعذّر الاتصال بالخادم.");
      } finally {
        if (!cancel) setMetaLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [token]);

  async function handleResend() {
    if (!token) return;
    setOtpSendBusy(true);
    setOtpHint(null);
    setError(null);
    try {
      const res = await fetch("/api/bookings/direct/send-checkout-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftToken: token }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        retryAfterSec?: number;
      };
      if (data.ok) {
        setOtpHint(
          channel === "EMAIL"
            ? "تم إرسال رمز جديد. تحقق من البريد (والبريد غير الهام)."
            : channel === "WHATSAPP"
              ? "تم إرسال رمز جديد. تحقق من واتساب على جوالك."
              : "تم إرسال رمز جديد. تحقق من رسائل الجوال.",
        );
        setOtpCooldownSec(45);
        return;
      }
      if (typeof data.retryAfterSec === "number" && data.retryAfterSec > 0) {
        setOtpCooldownSec(data.retryAfterSec);
      }
      setOtpHint(data.error ?? "تعذّر إرسال الرمز.");
    } catch {
      setOtpHint("تعذّر الاتصال بالخادم.");
    } finally {
      setOtpSendBusy(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const code = otp.replace(/\s+/g, "").trim();
    if (!BOOKING_OTP_REGEX.test(code)) {
      setError(`أدخل رمز التحقق المكوّن من ${bookingOtpLengthLabelAr()}.`);
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/bookings/direct/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ draftToken: token, otp: code }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        bookingRequestId?: number;
      };
      if (data.ok && data.bookingRequestId) {
        router.push(`/fleet/payment/${data.bookingRequestId}`);
        return;
      }
      const rawErr = data.error ?? "تعذّر تأكيد الرمز.";
      setError(
        isBranchOutsideHoursBookingError(rawErr)
          ? stripBranchHoursErrorCodeForDisplay(rawErr)
          : rawErr,
      );
    } catch {
      setError("تعذّر الاتصال بالخادم.");
    } finally {
      setPending(false);
    }
  }

  const backHref = modelId ? `/fleet/checkout?modelId=${encodeURIComponent(modelId)}` : "/fleet";

  return (
    <div className="flex min-h-screen flex-col bg-[#fdfbf6] text-on-surface">
      <SiteNav active="fleet" />
      <div
        className={`pt-24 pb-20 transition-opacity duration-500 ease-out ${mounted ? "opacity-100" : "opacity-0"}`}
      >
        <main className="mx-auto max-w-lg px-4 sm:px-6">
          <nav className="mb-6 text-[13px] font-semibold text-[#aaa08e]">
            <Link href={backHref} className="hover:text-[#dbb878]">
              ← العودة إلى الإتمام
            </Link>
          </nav>

          <section
            className="overflow-hidden rounded-3xl border border-[#ebe4d3] bg-white p-6 shadow-[0_24px_60px_-20px_rgba(15,61,71,0.12)] sm:p-8"
            style={{ color: TEAL }}
          >
            <div className="mb-6 flex items-start gap-3">
              <div
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-[#003749]"
                style={{ backgroundColor: `${GOLD}33` }}
              >
                <Shield className="size-5" aria-hidden />
              </div>
              <div>
                <h1 className="text-lg font-extrabold text-[#003749]">رمز التحقق</h1>
                <p className="mt-2 text-[13px] font-semibold leading-relaxed text-[#6b5a3b]">
                  بعد تأكيد بياناتك في الخطوة السابقة، أُرسل تلقائياً رمز مكوّن من {bookingOtpLengthLabelAr()} إلى{" "}
                  {channel === "EMAIL"
                    ? "بريدك الإلكتروني"
                    : channel === "WHATSAPP"
                      ? "واتساب جوالك"
                      : "جوالك"}
                  {destinationHint ? (
                    <>
                      {" "}
                      (<span dir="ltr" className="font-extrabold text-[#003749]">
                        {destinationHint}
                      </span>
                      ).
                    </>
                  ) : (
                    "."
                  )}{" "}
                  أدخل الرمز هنا ليتم تسجيل الحجز والانتقال إلى الدفع. يُنشأ حسابك تلقائياً إن لم يكن
                  موجوداً (بالاسم والجوال والبريد) أو يُحدَّث، وتبقى جلسة الدخول نشطة حتى تسجيل
                  الخروج يدوياً.
                </p>
              </div>
            </div>

            {metaLoading ? (
              <div className="flex items-center gap-2 py-8 text-[13px] font-bold text-[#aaa08e]">
                <Loader2 className="size-5 animate-spin" aria-hidden />
                جاري التحميل…
              </div>
            ) : metaError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] font-bold text-red-700" role="alert">
                {metaError}
              </div>
            ) : channel === "OFF" ? (
              <p className="text-[13px] font-bold text-amber-800">
                رمز التحقق غير مفعّل حالياً. ارجع إلى صفحة الإتمام وأعد إرسال الطلب.
              </p>
            ) : (
              <form onSubmit={handleConfirm} className="space-y-5">
                <div className="space-y-3">
                  <p className="text-center text-[13px] font-bold text-[#8a7752]">
                    {`أدخل الرمز (${bookingOtpLengthLabelAr()})`}
                  </p>
                  <OtpPinInput
                    id="checkout-otp-pin"
                    value={otp}
                    autoFocus
                    disabled={pending}
                    aria-label={`رمز التحقق من ${bookingOtpLengthLabelAr()}`}
                    onChange={(next) => {
                      setOtp(next);
                      setError(null);
                    }}
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => void handleResend()}
                    disabled={otpSendBusy || otpCooldownSec > 0 || pending}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-[#003749] bg-white px-5 py-3 text-[13px] font-extrabold text-[#003749] transition-colors hover:bg-[#003749] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {otpSendBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                    {otpCooldownSec > 0 ? `إعادة الإرسال (${otpCooldownSec})` : "إعادة إرسال الرمز"}
                  </button>
                  <p className="text-[12px] font-semibold text-[#8a7752]">
                    لم تصلك رسالة؟ تحقق من الرسائل غير المرغوب فيها أو انتظر ثوانٍ ثم أعد الطلب.
                  </p>
                </div>

                {otpHint ? (
                  <p
                    className={`text-[12px] font-bold ${otpHint.startsWith("تم إرسال") ? "text-emerald-700" : "text-[#8a7752]"}`}
                    role="status"
                  >
                    {otpHint}
                  </p>
                ) : null}

                {error ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] font-bold text-red-700" role="alert">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={pending || otp.length !== 4}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-extrabold text-white transition-opacity disabled:opacity-50"
                  style={{
                    background: `linear-gradient(135deg, ${GOLD} 0%, #c9a356 100%)`,
                    boxShadow: "0 8px 24px -6px rgba(219,184,120,0.5)",
                  }}
                >
                  {pending ? (
                    <>
                      <Loader2 className="size-5 animate-spin" aria-hidden />
                      جاري تسجيل الحجز…
                    </>
                  ) : (
                    "تأكيد الرمز والانتقال للدفع"
                  )}
                </button>
              </form>
            )}
          </section>
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}
