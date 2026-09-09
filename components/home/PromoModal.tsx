"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PromoModalSlide } from "@/lib/site-settings";

/**
 * نافذة ترويجية تفتح تلقائياً على الصفحة الرئيسية.
 *
 * قاعدتان تحكمانها وتُخزَّنان في `localStorage`:
 *  1) لا تظهر للزائر نفسه قبل انقضاء فترة التهدئة (٣٠ دقيقة افتراضياً).
 *  2) تعرض الآن **كاروزال** بكل الصور بدل صورة واحدة متناوبة.
 */

const STORAGE_KEY = "rawaes:promo-modal:v1";
/** تأخير بسيط بعد أول رسم حتى لا تقفز النافذة فوق صفحة ما زالت تُحمَّل. */
const OPEN_DELAY_MS = 1200;
/** مدة الانتقال التلقائي بين الشرائح (ms). */
const AUTO_SLIDE_MS = 4000;

const EASE = [0.16, 1, 0.3, 1] as const;

type StoredState = {
  /** توقيت آخر ظهور (ms) — تبدأ منه فترة التهدئة. */
  lastShownAt: number;
  /** يُبقى للتوافق مع الإصدار السابق، لا يُستخدم الآن. */
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
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAr = locale === "ar";
  const closeLabel = isAr ? "إغلاق" : "Close";
  const prevLabel = isAr ? "السابق" : "Previous";
  const nextLabel = isAr ? "التالي" : "Next";

  const dismiss = useCallback(() => setOpen(false), []);

  const goTo = useCallback(
    (idx: number) => {
      setActiveIndex(((idx % slides.length) + slides.length) % slides.length);
    },
    [slides.length],
  );

  const goPrev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);
  const goNext = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);

  /* ── فتح المودال بعد التأخير إن انتهت فترة التهدئة ── */
  useEffect(() => {
    if (slides.length === 0) return;

    const { lastShownAt } = readState();
    const cooldownMs = Math.max(1, cooldownMinutes) * 60_000;
    const now = Date.now();

    if (lastShownAt <= now && now - lastShownAt < cooldownMs) return;

    const timer = window.setTimeout(() => {
      setOpen(true);
      setActiveIndex(0);
      writeState({ lastShownAt: Date.now(), nextIndex: 0 });
    }, OPEN_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [slides.length, cooldownMinutes]);

  /* ── Escape & overflow ── */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
      if (e.key === "ArrowLeft") isAr ? goNext() : goPrev();
      if (e.key === "ArrowRight") isAr ? goPrev() : goNext();
    };
    window.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [open, dismiss, goNext, goPrev, isAr]);

  /* ── تقدم تلقائي ── */
  useEffect(() => {
    if (!open || slides.length <= 1) return;
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => {
      setActiveIndex((i) => (i + 1) % slides.length);
    }, AUTO_SLIDE_MS);
    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
    };
  }, [open, activeIndex, slides.length]);

  const slide = slides[activeIndex] ?? null;

  return (
    <AnimatePresence>
      {open && slide && (
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
            {/* ── الصورة الحالية مع تأثير fade بين الشرائح ── */}
            <div className="relative overflow-hidden rounded-2xl shadow-2xl">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeIndex}
                  initial={{ opacity: 0, x: reduced ? 0 : (isAr ? -24 : 24) }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: reduced ? 0 : (isAr ? 24 : -24) }}
                  transition={{ duration: 0.35, ease: EASE }}
                >
                  {slide.linkUrl ? (
                    <Link href={slide.linkUrl} onClick={dismiss} className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={slide.imageUrl}
                        alt={isAr ? "عرض ترويجي" : "Promotional offer"}
                        className="block max-h-[78vh] w-auto max-w-full object-contain"
                      />
                    </Link>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={slide.imageUrl}
                      alt={isAr ? "عرض ترويجي" : "Promotional offer"}
                      className="block max-h-[78vh] w-auto max-w-full object-contain"
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              {/* ── أسهم التنقل (تظهر فقط إن كان هناك أكثر من شريحة) ── */}
              {slides.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goPrev}
                    aria-label={prevLabel}
                    className="absolute start-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    aria-label={nextLabel}
                    className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </>
              )}

              {/* ── نقاط المؤشر (dots) ── */}
              {slides.length > 1 && (
                <div className="absolute bottom-3 start-0 end-0 flex justify-center gap-1.5">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => goTo(i)}
                      aria-label={`${isAr ? "الشريحة" : "Slide"} ${i + 1}`}
                      className={[
                        "h-2 rounded-full transition-all duration-300 focus-visible:outline-none",
                        i === activeIndex
                          ? "w-6 bg-white"
                          : "w-2 bg-white/50 hover:bg-white/80",
                      ].join(" ")}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ── زر الإغلاق ── */}
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
