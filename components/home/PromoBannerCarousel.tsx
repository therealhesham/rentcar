"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PromoBannerSlide } from "@/lib/site-settings";

const INTERVAL_MS = 4500;

export function PromoBannerCarousel({ slides }: { slides: PromoBannerSlide[] }) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goTo = useCallback(
    (idx: number) => {
      setCurrent((idx + slides.length) % slides.length);
    },
    [slides.length],
  );

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, INTERVAL_MS);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length < 2) return;
    resetTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [slides.length, resetTimer]);

  if (slides.length === 0) return null;

  const slide = slides[current];

  function handlePrev() {
    goTo(current - 1);
    resetTimer();
  }
  function handleNext() {
    goTo(current + 1);
    resetTimer();
  }

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={current}
      src={slide.imageUrl}
      alt={`عرض ${current + 1}`}
      className="mx-auto block h-auto max-h-[min(52vw,240px)] w-full max-w-5xl rounded-xl object-contain sm:max-h-[280px]"
      style={{ animation: "promo-fade-in 0.4s ease" }}
    />
  );

  return (
    <div className="relative select-none">
      <style>{`
        @keyframes promo-fade-in {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* الصورة */}
      {slide.linkUrl ? (
        <Link href={slide.linkUrl} className="block">
          {img}
        </Link>
      ) : (
        img
      )}

      {/* أزرار السابق / التالي */}
      {slides.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            aria-label="السابق"
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-[#003749]/75 p-2.5 text-white shadow-lg backdrop-blur-sm transition hover:bg-[#003749]"
          >
            <ChevronRight />
          </button>
          <button
            onClick={handleNext}
            aria-label="التالي"
            className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-[#003749]/75 p-2.5 text-white shadow-lg backdrop-blur-sm transition hover:bg-[#003749]"
          >
            <ChevronLeft />
          </button>

          {/* النقاط */}
          <div className="mt-3 flex justify-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => { goTo(i); resetTimer(); }}
                aria-label={`انتقل إلى الشريحة ${i + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === current
                    ? "w-6 bg-[#dbb878]"
                    : "w-2 bg-[#dbb878]/40 hover:bg-[#dbb878]/70"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
function ChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
