"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type MotionSectionProps = {
  children: ReactNode;
  className?: string;
  /** تأخير بداية الانتقال (ثوانٍ) */
  delay?: number;
  /** محفوظ للتوافق */
  x?: number;
};

const smoothEase = [0.16, 1, 0.3, 1] as const;

/** قسم يظهر عند التمرير — انزلاق عمودي ناعم وانسيابي مع استجابة فورية */
export function MotionSection({
  children,
  className,
  delay = 0,
}: MotionSectionProps) {
  const reduced = useReducedMotion();
  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px 0px -40px 0px" }}
      transition={{ duration: 0.52, delay, ease: smoothEase }}
    >
      {children}
    </motion.div>
  );
}
