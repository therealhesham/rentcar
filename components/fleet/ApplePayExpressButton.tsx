"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * زر Apple Pay السريع (Geidea Express Checkout) — يُعرض على صفحتنا مباشرةً بدل
 * التحويل إلى صفحة جيديا المستضافة.
 *
 * ترتيب الخطوات مقصود: الجلسة تُنشأ ثم يُركَّب الزر، لأن شيت Apple يلزمه إيماءة
 * مستخدم مباشرة — لو أنشأنا الجلسة عند الضغط لانكسرت سلسلة الإيماءة ومنعها Safari.
 *
 * لا يُسجَّل الدفع من هنا: `onSuccess` يعيد تحميل الصفحة فقط، والتأكيد الفعلي يأتي
 * من webhook جيديا أو من مصالحة الصفحة خادم‑لخادم.
 */

type GeideaExpressInstance = { mount: (selector: string) => void };
type GeideaExpressApi = {
  create: (config: {
    sessionId: string;
    onSuccess: (data: unknown) => void;
    onError: (data: unknown) => void;
    onCancel: () => void;
  }) => Promise<GeideaExpressInstance>;
};

declare global {
  interface Window {
    GeideaExpressCheckout?: new () => GeideaExpressApi;
    ApplePaySession?: { canMakePayments: () => boolean };
  }
}

const MOUNT_ID = "geidea-apple-pay-express";

/** تحميل مكتبة جيديا مرة واحدة لكل صفحة (بدون async/defer كما يطلب التوثيق). */
function loadGeideaScript(src: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.GeideaExpressCheckout) return Promise.resolve();

  const existing = document.querySelector<HTMLScriptElement>(
    `script[data-geidea-express="1"]`,
  );
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("geidea script failed")),
        { once: true },
      );
    });
  }

  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.dataset.geideaExpress = "1";
    el.addEventListener("load", () => resolve(), { once: true });
    el.addEventListener("error", () => reject(new Error("geidea script failed")), {
      once: true,
    });
    document.head.appendChild(el);
  });
}

type Status = "checking" | "unsupported" | "ready" | "error";

export type ApplePayExpressSession =
  | { ok: true; sessionId: string }
  | { ok: false; error: string };

export function ApplePayExpressButton({
  scriptUrl,
  createSession,
  onPaid,
}: {
  scriptUrl: string;
  /** يُنشئ جلسة جيديا على السيرفر — يختلف بين صفحة دفع العميل وأداة اختبار الإدارة. */
  createSession: () => Promise<ApplePayExpressSession>;
  onPaid: () => void;
}) {
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string | null>(null);
  // يمنع تركيب الزر مرتين عند إعادة تشغيل التأثير (StrictMode / تغيّر المراجع).
  const mountedRef = useRef(false);
  // المُنشئ ومعالج النجاح يُقرآن من مرجع حتى لا تُعاد تهيئة الزر عند كل رسم
  // (المستدعي يمرّر دوال جديدة في كل رسم). التحديث في تأثير — الكتابة أثناء الرسم ممنوعة.
  const createSessionRef = useRef(createSession);
  const onPaidRef = useRef(onPaid);
  useEffect(() => {
    createSessionRef.current = createSession;
    onPaidRef.current = onPaid;
  }, [createSession, onPaid]);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        await loadGeideaScript(scriptUrl);
        if (cancelled) return;

        // فحص الدعم يسبق إنشاء الجلسة عن قصد: إنشاؤها يكتب paymentSessionRef
        // ويضبط وسيلة الدفع في قاعدة البيانات، فلا نلوّثهما لجهاز لا يدعم Apple Pay.
        const supported =
          typeof window.ApplePaySession !== "undefined" &&
          window.ApplePaySession.canMakePayments();
        if (!supported) {
          setStatus("unsupported");
          return;
        }

        const sessionRes = await createSessionRef.current();
        if (cancelled) return;

        if (!sessionRes.ok) {
          setError(sessionRes.error);
          setStatus("error");
          return;
        }
        if (!window.GeideaExpressCheckout) {
          setError("تعذّر تحميل Apple Pay. حدّث الصفحة وحاول مجدداً.");
          setStatus("error");
          return;
        }

        const api = new window.GeideaExpressCheckout();
        const express = await api.create({
          sessionId: sessionRes.sessionId,
          onSuccess: () => {
            // لا نثق بنتيجة المتصفح: المستدعي يتحقق خادم‑لخادم (مصالحة/جلب الطلب).
            onPaidRef.current();
          },
          onError: () => {
            setError("لم تكتمل عملية الدفع. حاول مجدداً أو اختر وسيلة أخرى.");
            setStatus("error");
          },
          onCancel: () => {
            setError(null);
          },
        });
        if (cancelled) return;
        express.mount(`#${MOUNT_ID}`);
        setStatus("ready");
      } catch (e) {
        console.error("[apple-pay-express] init failed:", e);
        if (cancelled) return;
        setError("تعذّر تهيئة Apple Pay. حاول مجدداً.");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [scriptUrl]);

  return (
    <div className="space-y-2">
      <div id={MOUNT_ID} className="min-h-[44px] [&_*]:!max-w-full" />

      {status === "checking" ? (
        <p className="flex items-center gap-2 text-xs font-medium text-neutral-500">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          جاري تهيئة Apple Pay…
        </p>
      ) : null}

      {status === "unsupported" ? (
        <p className="text-xs leading-relaxed text-neutral-600">
          Apple Pay يعمل على متصفح Safari في iPhone أو iPad أو Mac مع بطاقة مُضافة إلى المحفظة.
          اختر وسيلة دفع أخرى من الأعلى للمتابعة من هذا الجهاز.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs font-semibold text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
