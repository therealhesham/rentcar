"use client";

import { CalendarCheck } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/** زر عائم يظهر بعد تجاوز كارت الحجز ويعيد المستخدم إليه بنقرة واحدة */
export function FloatingBookCta() {
  const [visible, setVisible] = useState(false);
  const reduced = useReducedMotion();
  const t = useTranslations("Common");

  useEffect(() => {
    const target = document.getElementById("home-booking");
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const scrollToBooking = () => {
    document
      .getElementById("home-booking")
      ?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={scrollToBooking}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#003749] py-3 pe-6 ps-5 text-sm font-extrabold text-white shadow-[0_16px_40px_-10px_rgba(0,55,73,0.55)] ring-1 ring-white/15 transition-colors hover:bg-[#00465d] sm:bottom-7"
        >
          <span
            className="flex size-6 items-center justify-center rounded-full bg-[#dbb878] text-[#1a1408]"
            aria-hidden
          >
            <CalendarCheck className="size-3.5" />
          </span>
          {t("bookNow")}
        </motion.button>
      )}
    </AnimatePresence>
  );
}
