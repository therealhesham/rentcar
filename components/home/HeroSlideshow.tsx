"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import type { HomeHeroSlide } from "@/lib/site-settings";

const SLIDE_INTERVAL_MS = 6000;
const SLIDE_DURATION_S = 0.9;

/** نفس منحنى الحركة المستخدم في بقية الصفحة الرئيسية */
const smoothEase = [0.16, 1, 0.3, 1] as const;

type Props = {
  slides: HomeHeroSlide[];
  /** اتجاه الانزلاق يتبع لغة الصفحة: العربية تدخل الشريحة فيها من اليسار */
  isRtl: boolean;
};

/**
 * خلفية الهيرو: شريحة واحدة = صورة ثابتة، وأكثر = تنقّل تلقائي بانزلاق جانبي.
 * الحاوية الأب `aria-hidden` فالصور زخرفية بحتة.
 */
export function HeroSlideshow({ slides, isRtl }: Props) {
  const reduced = useReducedMotion();
  const count = slides.length;
  const [index, setIndex] = useState(0);

  // التبويب المخفي يوقف rAF فتتجمّد الحركة بينما يستمر المؤقّت، فتتراكم انتقالات
  // معلّقة تُنفَّذ دفعةً واحدة عند العودة — لذلك يتوقف المؤقّت مع إخفاء التبويب.
  useEffect(() => {
    if (count < 2) return;

    let id: ReturnType<typeof setInterval> | null = null;

    const stop = () => {
      if (id) clearInterval(id);
      id = null;
    };
    const start = () => {
      stop();
      id = setInterval(() => {
        setIndex((prev) => (prev + 1) % count);
      }, SLIDE_INTERVAL_MS);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    onVisibilityChange();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [count]);

  if (count === 0) return null;

  const slide = slides[index] ?? slides[0];
  const enterX = isRtl ? "-100%" : "100%";
  const exitX = isRtl ? "100%" : "-100%";

  return (
    <>
      {/* initial={false}: لا حركة دخول عند أول رسم حتى لا تتأخر أكبر عنصر مرئي */}
      <AnimatePresence initial={false}>
        <motion.div
          key={index}
          className="absolute inset-0"
          initial={reduced ? { opacity: 0 } : { x: enterX, opacity: 0.5 }}
          animate={{ x: 0, opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { x: exitX, opacity: 0.5 }}
          transition={{ duration: reduced ? 0.35 : SLIDE_DURATION_S, ease: smoothEase }}
        >
          <SlideImage slide={slide} priority={index === 0} />
        </motion.div>
      </AnimatePresence>

      {/* تحميل مسبق للصورة التالية حتى لا تظهر فجوة بيضاء لحظة الانتقال */}
      {count > 1 ? (
        <div className="absolute inset-0 opacity-0">
          <SlideImage slide={slides[(index + 1) % count]} priority={false} />
        </div>
      ) : null}
    </>
  );
}

/**
 * صورة الشريحة مع اتجاه فني للجوال: عنصران، كل واحد مخفي على المقاس الآخر.
 * `sizes` يعطي المتصفح عرضاً وهمياً 1px للعنصر المخفي فيسحب أصغر نسخة من
 * الـsrcset بدل تنزيل صورة كاملة لا تُعرض.
 */
function SlideImage({ slide, priority }: { slide: HomeHeroSlide; priority: boolean }) {
  if (!slide.mobileImageUrl) {
    return (
      <Image
        src={slide.imageUrl}
        alt={slide.imageAlt}
        fill
        priority={priority}
        className="object-cover object-center"
        sizes="100vw"
      />
    );
  }

  return (
    <>
      <Image
        src={slide.mobileImageUrl}
        alt={slide.imageAlt}
        fill
        priority={priority}
        className="object-cover object-center sm:hidden"
        sizes="(max-width: 639px) 100vw, 1px"
      />
      <Image
        src={slide.imageUrl}
        alt={slide.imageAlt}
        fill
        priority={priority}
        className="hidden object-cover object-center sm:block"
        sizes="(max-width: 639px) 1px, 100vw"
      />
    </>
  );
}
