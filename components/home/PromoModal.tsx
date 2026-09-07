"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { PromoModalSlide } from "@/lib/site-settings";

/**
 * نافذة ترويجية تفتح تلقائياً على الصفحة الرئيسية.
 *
 * قاعدتان تحكمانها وتُخزَّنان في `localStorage` (لا في الجلسة، حتى لا تعود مع
 * كل تبويب جديد):
 *  1) لا تظهر للزائر نفسه قبل انقضاء فترة التهدئة (٣٠ دقيقة افتراضياً).
 *  2) في كل ظهور تعرض الصورة التالية بالتناوب، فلا يرى الزائر الصورة ذاتها مرتين.
 */

const STORAGE_KEY = "rawaes:promo-modal:v1";
/** تأخير بسيط بعد أول رسم حتى لا تقفز النافذة فوق صفحة ما زالت تُحمَّل. */
const OPEN_DELAY_MS = 1200;

const EASE = [0.16, 1, 0.3, 1] as const;

type StoredState = {
  /** توقيت آخر ظهور (ms) — تبدأ منه فترة التهدئة. */
  lastShownAt: number;
  /** ترتيب الصورة التي ستُعرض في الظهور القادم. */
  nextIndex: number;
};

function readState(): StoredState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { lastShownAt: 0, nextIndex: 0 };
    const parsed = JSON.parse(raw) as Partial<StoredState> | null;
    return {
      lastShownAt: Number(parsed?.lastShownAt) || 0,
      nextIndex: Number(parsed?.nextIndex) || 0,
    };
  } catch {
    return { lastShownAt: 0, nextIndex: 0 };
  }
}

function writeState(state: StoredState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* الوضع الخاص قد يمنع التخزين — لا يضرّ */
  }
}

type Props = {
  slides: PromoModalSlide[];
  cooldownMinutes: number;
  locale: string;
};

export function PromoModal({ slides, cooldownMinutes, locale }: Props) {
  const reduced = useReducedMotion();
  const [slideIndex, setSlideIndex] = useState<number | null>(null);

  const isAr = locale === "ar";
  const closeLabel = isAr ? "إغلاق" : "Close";

  const dismiss = useCallback(() => setSlideIndex(null), []);

  useEffect(() => {
    if (slides.length === 0) return;

    const { lastShownAt, nextIndex } = readState();
    const cooldownMs = Math.max(1, cooldownMinutes) * 60_000;
    const now = Date.now();

    // فترة التهدئة لم تنتهِ بعد — لا نزعج الزائر.
    // (توقيت مستقبلي بسبب تعديل ساعة الجهاز يُعامَل كأنه لم يظهر بعد.)
    if (lastShownAt <= now && now - lastShownAt < cooldownMs) return;

    const index = nextIndex % slides.length;
    const timer = window.setTimeout(() => {
      setSlideIndex(index);
      writeState({ lastShownAt: Date.now(), nextIndex: (index + 1) % slides.length });
    }, OPEN_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [slides.length, cooldownMinutes]);

  const open = slideIndex !== null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [open, dismiss]);

  const slide = slideIndex === null ? null : slides[slideIndex];

  const image = slide ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={slide.imageUrl}
      alt={isAr ? "عرض ترويجي" : "Promotional offer"}
      className="block max-h-[78vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
    />
  ) : null;

  return (
    <AnimatePresence>
      {slide && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={isAr ? "عرض ترويجي" : "Promotional offer"}
          dir={isAr ? "rtl" : "ltr"}
          onClick={dismiss}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25, ease: EASE } }}
          transition={{ duration: 0.3, ease: EASE }}
          className="fixed inset-0 z-[998] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="relative max-w-[min(92vw,560px)]"
          >
            {slide.linkUrl ? (
              <Link href={slide.linkUrl} onClick={dismiss} className="block">
                {image}
              </Link>
            ) : (
              image
            )}

            <button
              type="button"
              onClick={dismiss}
              aria-label={closeLabel}
              className="absolute -top-3 rounded-full bg-white p-2 text-[#003749] shadow-lg transition hover:bg-[#dbb878] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dbb878] ltr:-right-3 rtl:-left-3"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
