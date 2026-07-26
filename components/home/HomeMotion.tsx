"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/** منحنى حركة انسيابي فائق النعومة (Apple / Vercel Spring-like Easing) */
const smoothEase = [0.16, 1, 0.3, 1] as const;

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
};

/** يظهر بنعومة عند دخول القسم إلى نافذة العرض */
export function Reveal({ children, className, delay = 0, y = 16 }: RevealProps) {
  const reduced = useReducedMotion();
  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px 0px -40px 0px" }}
      transition={{ duration: 0.5, ease: smoothEase, delay }}
    >
      {children}
    </motion.div>
  );
}

type HeroEntranceProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

/** للهيرو فوق الطية: حركة دخول سلسة وفائقة النعومة عند تحميل الصفحة */
export function HeroEntrance({
  children,
  className,
  delay = 0,
}: HeroEntranceProps) {
  const reduced = useReducedMotion();
  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: smoothEase, delay }}
    >
      {children}
    </motion.div>
  );
}
