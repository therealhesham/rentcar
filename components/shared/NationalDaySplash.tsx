"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";

/**
 * شاشة ترحيب موسمية لمسار العميل تدمج شعار اليوم الوطني «دام عزّك يا وطن»
 * بهوية روائس الذهبية. تظهر مرة واحدة لكل جلسة متصفّح وضمن نافذة تواريخ
 * حول اليوم الوطني، وتُغلَق تلقائياً أو بأي تفاعل من الزائر.
 *
 * النصوص هنا مضمّنة عمداً (لا تمرّ عبر next-intl) لأنها محتوى موسمي قصير
 * يُفعَّل ويُطفأ من الثابتين أدناه دون لمس ملفات الترجمة.
 */

const NATIONAL_DAY_NUMBER_AR = "٩٦";
const NATIONAL_DAY_NUMBER_EN = "96th";

/** نافذة العرض: من بداية سبتمبر حتى نهايته (توقيت السعودية +03). */
const WINDOW_START = Date.parse("2026-09-01T00:00:00+03:00");
const WINDOW_END = Date.parse("2026-10-01T00:00:00+03:00");

const SESSION_KEY = "rawaes:national-day-splash:2026";
/** مدة بقاء الشاشة قبل الانسحاب التلقائي. */
const HOLD_MS = 2600;

const EASE = [0.16, 1, 0.3, 1] as const;

type Copy = {
  slogan: string;
  lead: string;
  skip: string;
  dir: "rtl" | "ltr";
};

function getCopy(locale: string): Copy {
  if (locale === "ar") {
    return {
      slogan: "دام عزّك يا وطن",
      lead: `روائس تحتفي باليوم الوطني السعودي الـ ${NATIONAL_DAY_NUMBER_AR}`,
      skip: "تخطّي",
      dir: "rtl",
    };
  }
  return {
    slogan: "دام عزّك يا وطن",
    lead: `Rawaes celebrates the ${NATIONAL_DAY_NUMBER_EN} Saudi National Day`,
    skip: "Skip",
    dir: "ltr",
  };
}

export function NationalDaySplash({ locale }: { locale: string }) {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const copy = getCopy(locale);

  const dismiss = useCallback(() => {
    setOpen(false);
    try {
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* الوضع الخاص قد يمنع التخزين — لا يضرّ */
    }
  }, []);

  useEffect(() => {
    const now = Date.now();
    if (now < WINDOW_START || now >= WINDOW_END) return;

    try {
      if (window.sessionStorage.getItem(SESSION_KEY)) return;
    } catch {
      /* تجاهل ثم اعرض */
    }

    /* eslint-disable-next-line react-hooks/set-state-in-effect -- كشف مؤجّل بعد أول رندر لتفادي عدم تطابق الترطيب (SSR يعرض null) */
    setOpen(true);
    const timer = window.setTimeout(dismiss, reduced ? 1600 : HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [dismiss, reduced]);

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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={copy.lead}
          dir={copy.dir}
          onClick={dismiss}
          onWheel={dismiss}
          onTouchMove={dismiss}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5, ease: EASE } }}
          transition={{ duration: 0.35, ease: EASE }}
          className="fixed inset-0 z-[999] flex flex-col items-center justify-center overflow-hidden px-6 text-center"
          style={{
            background:
              "radial-gradient(125% 95% at 50% 12%, #0b6437 0%, #054e2a 44%, #00341c 76%, #001c0e 100%)",
          }}
        >
          <StarField />

          <div className="relative flex flex-col items-center">
            {/* شارة حرف R بذهب روائس داخل حلقة رفيعة */}
            <motion.div
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.82 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.12 }}
              className="mb-7 flex size-20 items-center justify-center rounded-full sm:size-24"
              style={{
                boxShadow: "0 0 0 1px rgba(230,190,130,0.55), 0 18px 50px -12px rgba(0,0,0,0.55)",
                background:
                  "radial-gradient(circle at 32% 28%, rgba(230,190,130,0.20), rgba(230,190,130,0.02) 70%)",
              }}
            >
              <svg viewBox="0 0 40 44" className="h-11 w-11 sm:h-12 sm:w-12" role="img" aria-label="Rawaes">
                <defs>
                  <linearGradient id="nd-splash-gold" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f4d9a8" />
                    <stop offset="55%" stopColor="#e6be82" />
                    <stop offset="100%" stopColor="#b98f45" />
                  </linearGradient>
                </defs>
                <path
                  fill="url(#nd-splash-gold)"
                  d="M12 12h10c4.4 0 7 3.1 7 6.5 0 2.4-1.2 4.3-3.1 5.3L29 32h-4.2l-2.6-6.8H15.8V32H12V12zm3.8 3.6v7.4h5.8c2.3 0 3.6-1.4 3.6-3.7 0-2.2-1.3-3.7-3.6-3.7h-5.8z"
                />
              </svg>
            </motion.div>

            {/* الشعار الوطني — بطل الشاشة */}
            <motion.h1
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.42 }}
              className="text-3xl font-black leading-tight text-white sm:text-5xl"
              style={{ textShadow: "0 2px 30px rgba(0,0,0,0.35)" }}
            >
              {copy.slogan}
            </motion.h1>

            {/* خط ذهبي رفيع يُرسَم من المنتصف */}
            <motion.div
              initial={reduced ? { opacity: 0 } : { opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.62 }}
              className="my-6 h-px w-40 sm:w-52"
              style={{
                background:
                  "linear-gradient(90deg, transparent, #e6be82 22%, #f4d9a8 50%, #e6be82 78%, transparent)",
              }}
            />

            {/* سطر ربط روائس باليوم الوطني */}
            <motion.p
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.95 }}
              className="max-w-xs text-sm font-light text-white/70 sm:text-base"
            >
              {copy.lead}
            </motion.p>
          </div>

          {/* زر التخطّي */}
          <motion.button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              dismiss();
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: EASE, delay: 1.2 }}
            className="absolute bottom-8 rounded-full px-4 py-1.5 text-xs font-medium text-white/55 ring-1 ring-white/20 transition-colors hover:text-white hover:ring-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e6be82]"
          >
            {copy.skip}
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** حقل نجوم ثُمانية نجدية باهت جداً كنسيج للخلفية. */
function StarField() {
  const stars = [
    { x: 12, y: 22, s: 14, o: 0.10 },
    { x: 84, y: 16, s: 10, o: 0.08 },
    { x: 68, y: 74, s: 18, o: 0.07 },
    { x: 22, y: 78, s: 12, o: 0.09 },
    { x: 48, y: 44, s: 22, o: 0.05 },
    { x: 90, y: 52, s: 9, o: 0.07 },
    { x: 6, y: 54, s: 8, o: 0.06 },
  ];
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      {stars.map((st, i) => (
        <path
          key={i}
          transform={`translate(${st.x} ${st.y}) scale(${st.s / 24})`}
          d="M12 0l2.9 6.6L22 4.2l-2.4 7.1 6.6 2.9-7.1 2.4 2.4 7.1-6.6-2.9L12 24l-2.9-6.6L4.2 20l2.4-7.1L0 10l7.1-2.4L4.2 4.2l6.6 2.9z"
          fill="#e6be82"
          opacity={st.o}
        />
      ))}
    </svg>
  );
}
