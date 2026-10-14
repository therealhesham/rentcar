"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Link2 } from "lucide-react";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // http أو متصفح يمنع الـ Clipboard API: نسخة احتياطية عبر عنصر مؤقت.
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/** ينسخ رابط صفحة السيارة الدعائية العامة (`/fleet/car/:id`) للمشاركة على السوشيال. */
export function CopyPromoLinkButton({ modelId }: { modelId: number }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function onClick() {
    const ok = await copyText(`${window.location.origin}/fleet/car/${modelId}`);
    setState(ok ? "copied" : "failed");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  }

  const label =
    state === "copied" ? "تم النسخ" : state === "failed" ? "تعذّر النسخ" : "نسخ رابط الدعاية";

  return (
    <button
      type="button"
      onClick={onClick}
      title="نسخ رابط صفحة السيارة الدعائية للمشاركة على السوشيال ميديا"
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
        state === "copied"
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : state === "failed"
            ? "border-red-300 bg-red-50 text-red-700"
            : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low"
      }`}
    >
      {state === "copied" ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
      {label}
    </button>
  );
}
