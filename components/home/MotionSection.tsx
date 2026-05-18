"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type MotionSectionProps = {
  children: ReactNode;
  className?: string;
  /** تأخير بداية الانتقال (ثوانٍ) */
  delay?: number;
  /** محفوظ للتوافق — الانتقال عمودي الآن لتجنّب تمرير أفقي على الجوال */
  x?: number;
};

/** قسم يظهر عند التمرير — انزلاق عمودي لتجنّب تمرير أفقي على الشاشات الضيقة */
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
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px 0px" }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
