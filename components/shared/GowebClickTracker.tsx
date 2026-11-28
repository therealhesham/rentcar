"use client";

import { useEffect } from "react";
import { trackGowebClick } from "@/lib/track-goweb-click";
import type { GowebClickType } from "@/lib/goweb-crm";

function clickTypeFromHref(href: string): GowebClickType | null {
  const h = href.trim().toLowerCase();
  if (h.startsWith("tel:")) return "call";
  if (h.startsWith("mailto:")) return "email";
  if (h.startsWith("https://wa.me/") || h.startsWith("https://api.whatsapp.com/") || h.startsWith("whatsapp:")) {
    return "whatsapp";
  }
  return null;
}

/**
 * يلتقط أي ضغطة على رابط اتصال (tel:) أو إيميل (mailto:) أو واتساب (wa.me) في الموقع العام
 * ويسجّلها في GoWeb — من غير ما نعدّل كل رابط لوحده. موجود في الـ layout العام فقط (مش الأدمن).
 */
export function GowebClickTracker() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const a = target.closest("a[href]");
      if (!a) return;
      const type = clickTypeFromHref(a.getAttribute("href") ?? "");
      if (type) trackGowebClick(type);
    }
    // capture: نلتقطها حتى لو رابط بيوقف الـ propagation أو بيفتح تطبيق فورًا.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
