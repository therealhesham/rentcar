"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

const ease = [0.22, 1, 0.36, 1] as const;

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
};

/** يظهر عند دخول القسم إلى نافذة العرض (مرة واحدة) */
export function Reveal({ children, className, delay = 0, y = 22 }: RevealProps) {
  const reduced = useReducedMotion();
  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-36px 0px -24px 0px" }}
      transition={{ duration: 0.48, ease, delay }}
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

/** للهيرو فوق الطية: حركة عند أول عرض */
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease, delay }}
    >
      {children}
    </motion.div>
  );
}
