"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { OVERLAY_PANEL_Z } from "@/lib/overlay-z-index";

type Options = {
  panelWidth: number;
  gap?: number;
  forceBelow?: boolean;
  autoScrollOnOpen?: boolean;
};

/**
 * يثبّت لوحة منبثقة أسفل عنصر مرساة (محاذاة يمين RTL) فوق أي overflow في الآباء.
 * لا يُعلَم `ready` إلا بعد أول قياس ناجح لتجنّب ظهور اللوحة أسفل الصفحة بلا تموضع.
 */
export function useAnchoredPopoverPosition(
  isOpen: boolean,
  anchorRef: React.RefObject<HTMLElement | null>,
  panelRef: React.RefObject<HTMLElement | null>,
  { panelWidth, gap = 8, forceBelow = false, autoScrollOnOpen = false }: Options,
) {
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [ready, setReady] = useState(false);
  const hasAutoScrolledRef = useRef(false);

  // التمرير التلقائي لأسفل عند فتح النافذة حتى تظهر أسفل الويدجت بوضوح
  useEffect(() => {
    if (!isOpen) {
      hasAutoScrolledRef.current = false;
      return;
    }
    if (autoScrollOnOpen && !hasAutoScrolledRef.current) {
      hasAutoScrolledRef.current = true;
      const el = anchorRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        const panelH = panelRef.current?.offsetHeight ?? 380;
        if (r.bottom + panelH > vh - 20 || r.top > 120) {
          const targetScroll = Math.max(0, window.scrollY + r.top - 80);
          window.scrollTo({ top: targetScroll, behavior: "smooth" });
        }
      }
    }
  }, [isOpen, autoScrollOnOpen, anchorRef, panelRef]);

  const update = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return false;

    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const panelW = Math.min(panelWidth, vw - 16);
    const isNarrow = vw < 640;
    let left = isNarrow
      ? Math.max(8, (vw - panelW) / 2)
      : r.right - panelW;
    if (left < 8) left = 8;
    if (left + panelW > vw - 8) left = vw - 8 - panelW;

    const panelH = panelRef.current?.offsetHeight ?? 300;
    const belowTop = r.bottom + gap;
    const fitsBelow = belowTop + panelH <= vh - 8;
    const top = forceBelow || fitsBelow
      ? belowTop
      : Math.max(8, r.top - gap - panelH);

    setStyle({
      position: "fixed",
      top,
      left,
      width: panelW,
      zIndex: OVERLAY_PANEL_Z,
    });
    setReady(true);
    return true;
  }, [anchorRef, panelRef, panelWidth, gap, forceBelow]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setReady(false);
      setStyle({});
      return;
    }

    let cancelled = false;
    let raf = 0;

    const run = () => {
      if (cancelled) return;
      if (update()) return;
      raf = requestAnimationFrame(run);
    };

    run();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [isOpen, update]);

  // إعادة القياس بعد رسم اللوحة (ارتفاع فعلي) وعند التمرير/تغيير الحجم
  useLayoutEffect(() => {
    if (!isOpen || !ready) return;
    update();
  }, [isOpen, ready, update]);

  useEffect(() => {
    if (!isOpen) return;
    const onScroll = () => update();
    const onResize = () => update();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [isOpen, update]);

  return { style, ready };
}
