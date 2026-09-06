"use client";

import { useTranslations } from "next-intl";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { loginCustomer, type AuthFormState } from "@/app/[locale]/account/actions";
import { SiteFooter } from "@/components/home/SiteFooter";
import { SiteNav } from "@/components/shared/SiteNav";
import { OtpPinInput } from "@/components/ui/OtpPinInput";
import { BOOKING_OTP_LENGTH, BOOKING_OTP_REGEX } from "@/lib/booking-otp-constants";
import type { BookingOtpChannel } from "@/lib/site-settings";

const TEAL = "#003749";
const GOLD = "#dbb878";

type Props = {
  /** بعد تسجيل الدخول (مثلاً صفحة دفع حجز). */
  returnTo?: string;
};

export function AccountLoginClient({ returnTo = "/account" }: Props) {
  const t = useTranslations("Account");
  const router = useRouter();
  const [state, formAction, pending] = useActionState(loginCustomer, null as AuthFormState);

  const [otpRequired, setOtpRequired] = useState(false);
  const [otpChannel, setOtpChannel] = useState<BookingOtpChannel>("OFF");
  const [cfgLoaded, setCfgLoaded] = useState(false);

  const [identifier, setIdentifier] = useState("");
  const [otpStep, setOtpStep] = useState<"identifier" | "code">("identifier");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSendBusy, setOtpSendBusy] = useState(false);
  const [otpVerifyBusy, setOtpVerifyBusy] = useState(false);
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [otpCooldownSec, setOtpCooldownSec] = useState(0);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      try {
        const res = await fetch("/api/bookings/direct/otp-config", { cache: "no-store" });
        const j = (await res.json()) as { ok?: boolean; channel?: string; required?: boolean };
        if (cancel || j.ok !== true) return;
        const ch = String(j.channel ?? "").trim().toUpperCase();
        setOtpRequired(Boolean(j.required));
        setOtpChannel(
          ch === "SMS" || ch === "EMAIL" || ch === "WHATSAPP" || ch === "OFF"
            ? (ch as BookingOtpChannel)
            : "OFF",
        );
      } catch {
        /* ignore */
      } finally {
        if (!cancel) setCfgLoaded(true);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (otpCooldownSec <= 0) return;
    const id = window.setTimeout(() => setOtpCooldownSec((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [otpCooldownSec]);

  useEffect(() => {
    if (otpStep !== "code") return;
    const code = otp.replace(/\s+/g, "").trim();
    if (code.length === BOOKING_OTP_LENGTH && !otpVerifyBusy) {
      void doVerifyOtp(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  function validateIdentifierForSend(): string | null {
    const raw = identifier.trim();
    if (otpChannel === "EMAIL") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) || raw.length > 254) {
        return t("errEmailFormat");
      }
      return null;
    }
    if (otpChannel === "SMS" || otpChannel === "WHATSAPP") {
      const d = raw.replace(/\s+/g, "").replace(/\D/g, "");
      if (!/^5\d{8}$/.test(d)) {
        return t("errPhoneFormat");
      }
      return null;
    }
    return t("errLoginConfig");
  }

  async function handleSendOtp() {
    setOtpError(null);
    setOtpHint(null);
    const v = validateIdentifierForSend();
    if (v) {
      setOtpError(v);
      return;
    }
    setOtpSendBusy(true);
    try {
      const toSend =
        otpChannel === "SMS" || otpChannel === "WHATSAPP"
          ? identifier.trim().replace(/\s+/g, "").replace(/\D/g, "")
          : identifier.trim();
      const res = await fetch("/api/auth/customer/send-login-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: toSend }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        retryAfterSec?: number;
      };
      if (data.ok) {
        setOtpStep("code");
        setOtpHint(
          otpChannel === "EMAIL"
            ? t("otpSentEmail")
            : otpChannel === "WHATSAPP"
              ? t("otpSentWhatsapp")
              : t("otpSentSms"),
        );
        setOtpCooldownSec(45);
        return;
      }
      if (typeof data.retryAfterSec === "number" && data.retryAfterSec > 0) {
        setOtpCooldownSec(data.retryAfterSec);
      }
      setOtpError(data.error ?? t("errOtpSend"));
    } catch {
      setOtpError("تعذّر الاتصال بالخادم.");
    } finally {
      setOtpSendBusy(false);
    }
  }

  async function doVerifyOtp(code: string) {
    if (otpVerifyBusy) return;
    setOtpError(null);
    if (!BOOKING_OTP_REGEX.test(code)) {
      setOtpError(t("errOtpLength", { length: BOOKING_OTP_LENGTH }));
      return;
    }
    const toSend =
      otpChannel === "SMS" || otpChannel === "WHATSAPP"
        ? identifier.trim().replace(/\s+/g, "").replace(/\D/g, "")
        : identifier.trim();
    setOtpVerifyBusy(true);
    try {
      const res = await fetch("/api/auth/customer/verify-login-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identifier: toSend, otp: code }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        router.push(returnTo);
        router.refresh();
        return;
      }
      setOtpError(data.error ?? t("errOtpConfirm"));
    } catch {
      setOtpError("تعذّر الاتصال بالخادم.");
    } finally {
      setOtpVerifyBusy(false);
    }
  }

  function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const code = otp.replace(/\s+/g, "").trim();
    void doVerifyOtp(code);
  }

  async function handleResendOtp() {
    setOtpError(null);
    setOtpHint(null);
    const v = validateIdentifierForSend();
    if (v) {
      setOtpError(v);
      return;
    }
    setOtpSendBusy(true);
    try {
      const toSend =
        otpChannel === "SMS" || otpChannel === "WHATSAPP"
          ? identifier.trim().replace(/\s+/g, "").replace(/\D/g, "")
          : identifier.trim();
      const res = await fetch("/api/auth/customer/send-login-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: toSend }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        retryAfterSec?: number;
      };
      if (data.ok) {
        setOtpHint(
          otpChannel === "EMAIL"
            ? t("otpResentEmail")
            : otpChannel === "WHATSAPP"
              ? t("otpResentWhatsapp")
              : t("otpResentSms"),
        );
        setOtpCooldownSec(45);
        return;
      }
      if (typeof data.retryAfterSec === "number" && data.retryAfterSec > 0) {
        setOtpCooldownSec(data.retryAfterSec);
      }
      setOtpError(data.error ?? t("errOtpResend"));
    } catch {
      setOtpError("تعذّر الاتصال بالخادم.");
    } finally {
      setOtpSendBusy(false);
    }
  }

  const useOtpOnly =
    cfgLoaded &&
    otpRequired &&
    (otpChannel === "SMS" || otpChannel === "EMAIL" || otpChannel === "WHATSAPP");

  return (
    <div className="flex min-h-screen flex-col bg-[#fdfbf6] text-on-surface">
      <SiteNav active="home" />
      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-16 pt-28">
        <div
          className="w-full max-w-md overflow-hidden rounded-3xl border border-[#ebe4d3] bg-white p-8 shadow-[0_24px_60px_-20px_rgba(15,61,71,0.12)]"
          style={{ color: TEAL }}
        >
          <h1 className="mb-1 text-2xl font-extrabold text-[#003749]">{t("loginTitle")}</h1>
          <p className="mb-8 text-sm font-semibold leading-relaxed text-[#6b5a3b]">
            {useOtpOnly
              ? otpChannel === "EMAIL"
                ? t("loginSubtitleEmail")
                : otpChannel === "WHATSAPP"
                  ? t("loginSubtitleWhatsapp")
                  : t("loginSubtitleSms")
              : t("loginSubtitlePassword")}
          </p>

          {!cfgLoaded ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm font-bold text-[#aaa08e]">
              <Loader2 className="size-5 animate-spin" aria-hidden />
              {t("loading")}
            </div>
          ) : useOtpOnly ? (
            <div className="space-y-6">
          

              {otpStep === "identifier" ? (
                <div className="space-y-4">
                  {otpChannel === "EMAIL" ? (
                    <label className="block">
                      <span className="mb-1.5 block text-[13px] font-extrabold text-[#003749]">
                        {t("email")}
                      </span>
                      <input
                        type="email"
                        value={identifier}
                        onChange={(ev) => setIdentifier(ev.target.value)}
                        autoComplete="email"
                        placeholder="name@example.com"
                        className="w-full rounded-xl border border-[#ebe4d3] bg-white px-4 py-3.5 text-[15px] font-semibold text-[#003749] outline-none transition-shadow focus:border-[#dbb878] focus:ring-2 focus:ring-[#dbb878]/40"
                        dir="ltr"
                      />
                    </label>
                  ) : (
                    <label className="block">
                      <span className="mb-1.5 block text-[13px] font-extrabold text-[#003749]">
                        {t("phone")}
                      </span>
                      <div className="flex overflow-hidden rounded-xl border border-[#ebe4d3] transition-shadow focus-within:border-[#dbb878] focus-within:ring-2 focus-within:ring-[#dbb878]/40">
                      <input
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel-national"
                          maxLength={9}
                          pattern="5[0-9]{8}"
                          value={identifier}
                          onChange={(ev) =>
                            setIdentifier(ev.target.value.replace(/\D/g, "").slice(0, 9))
                          }
                          placeholder="5XXXXXXXX"
                          className="min-w-0 flex-1 bg-white px-4 py-3.5 text-[15px] font-semibold tabular-nums text-[#003749] outline-none"
                          dir="ltr"
                        />
                        <span
                          className="flex items-center border-e border-[#ebe4d3] bg-[#fdfbf6] px-3 text-[13px] font-extrabold tabular-nums text-[#003749]"
                          dir="ltr"
                        >
                          +966
                        </span>
                  
                      </div>
                      <span className="mt-1.5 block text-[11px] font-semibold text-[#8a7752]">
                        {t("phoneHint")}
                      </span>
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleSendOtp()}
                    disabled={otpSendBusy || otpCooldownSec > 0}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-extrabold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
                    style={{
                      background: `linear-gradient(135deg, ${GOLD} 0%, #c9a356 100%)`,
                      boxShadow: "0 8px 24px -6px rgba(219,184,120,0.45)",
                    }}
                  >
                    {otpSendBusy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
                    {otpSendBusy
                      ? t("sending")
                      : otpCooldownSec > 0
                        ? t("waitSeconds", { sec: otpCooldownSec })
                        : t("sendOtp")}
                  </button>
                </div>
              ) : (
                <form className="space-y-5" onSubmit={handleVerifyOtp}>
                  <div className="space-y-3">
                    <p className="text-center text-[13px] font-extrabold text-[#003749]">
                      {t("otpLabel", { length: BOOKING_OTP_LENGTH })}
                    </p>
                    <OtpPinInput
                      value={otp}
                      autoFocus
                      disabled={otpVerifyBusy}
                      aria-label={t("otpAria")}
                      onChange={(next) => {
                        setOtp(next);
                        setOtpError(null);
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={otpVerifyBusy || otp.length !== BOOKING_OTP_LENGTH}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#003749] py-4 text-[15px] font-extrabold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {otpVerifyBusy ? <Loader2 className="size-5 animate-spin text-white" aria-hidden /> : null}
                    {otpVerifyBusy ? t("signingIn") : t("confirmLogin")}
                  </button>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={() => void handleResendOtp()}
                      disabled={otpSendBusy || otpCooldownSec > 0}
                      className="text-[13px] font-extrabold text-[#003749] underline decoration-[#dbb878] underline-offset-2 disabled:opacity-40"
                    >
                      {otpCooldownSec > 0 ? t("resendAfter", { sec: otpCooldownSec }) : t("resend")}
                    </button>
                    <button
                      type="button"
                      className="text-[13px] font-bold text-[#8a7752] hover:text-[#003749]"
                      onClick={() => {
                        setOtpStep("identifier");
                        setOtp("");
                        setOtpHint(null);
                        setOtpError(null);
                      }}
                    >
                      {otpChannel === "EMAIL" ? t("changeEmail") : t("changePhone")}
                    </button>
                  </div>
                </form>
              )}

              {otpHint ? (
                <p className="text-[13px] font-bold text-emerald-700" role="status">
                  {otpHint}
                </p>
              ) : null}
              {otpError ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-bold text-red-700" role="alert">
                  {otpError}
                </p>
              ) : null}
            </div>
          ) : (
            <form action={formAction} className="flex flex-col gap-4">
              <input type="hidden" name="next" value={returnTo} />
              <label className="text-[13px] font-extrabold text-[#003749]">
                {t("email")}
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="mt-1.5 w-full rounded-xl border border-[#ebe4d3] bg-white px-4 py-3.5 text-on-surface outline-none focus:border-[#dbb878] focus:ring-2 focus:ring-[#dbb878]/40"
                  dir="ltr"
                />
              </label>
              <label className="text-[13px] font-extrabold text-[#003749]">
                {t("password")}
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="mt-1.5 w-full rounded-xl border border-[#ebe4d3] bg-white px-4 py-3.5 outline-none focus:border-[#dbb878] focus:ring-2 focus:ring-[#dbb878]/40"
                />
              </label>
              {state?.error ? (
                <p className="text-sm font-bold text-red-700" role="alert">
                  {state.error}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={pending}
                className="rounded-2xl bg-[#003749] py-4 text-[15px] font-extrabold text-white transition-opacity disabled:opacity-50"
              >
                {pending ? t("signingIn") : t("signIn")}
              </button>
            </form>
          )}

          <p className="mt-8 text-center text-sm font-semibold text-[#6b5a3b]">
            {t("noAccount")}{" "}
            <Link href="/account/register" className="font-extrabold text-[#003749] underline underline-offset-2">
              {t("createAccount")}
            </Link>
          </p>
          <p className="mt-3 text-center text-sm">
            <Link href="/" className="font-semibold text-[#8a7752] hover:text-[#003749]">
              {t("backHome")}
            </Link>
          </p>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
