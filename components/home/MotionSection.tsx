"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type MotionSectionProps = {
  children: ReactNode;
  className?: string;
  /** تأخير بداية الانتقال (ثوانٍ) */
  delay?: number;
  /** موضع البداية على المحور X (مثل المثال: انزلاق من الجانب) */
  x?: number;
};

/** قسم يظهر عند التمرير: opacity + translateX، مرة واحدة — نفس أسلوب AboutSection */
export function MotionSection({
  children,
  className,
  delay = 0,
  x = 50,
}: MotionSectionProps) {
  const reduced = useReducedMotion();
  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, x }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, delay }}
    >
      {children}
    </motion.div>
  );
}
