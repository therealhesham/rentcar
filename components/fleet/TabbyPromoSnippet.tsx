"use client";

import { useEffect, useId, useRef } from "react";

declare global {
  interface Window {
    TabbyPromo?: new (config: {
      selector: string;
      currency: string;
      price: string;
      lang?: string;
      source?: "product" | "cart";
      shouldInheritBg?: boolean;
      publicKey: string;
      merchantCode: string;
    }) => void;
  }
}

const SCRIPT_SRC = "https://checkout.tabby.ai/tabby-promo.js";
let scriptLoadPromise: Promise<void> | null = null;

function loadTabbyPromoScript(): Promise<void> {
  if (window.TabbyPromo) return Promise.resolve();
  if (!scriptLoadPromise) {
    scriptLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("tabby-promo.js failed to load"));
      document.head.appendChild(script);
    });
  }
  return scriptLoadPromise;
}

type Props = {
  publicKey: string;
  merchantCode: string;
  priceSar: number;
  lang: "ar" | "en";
  source: "product" | "cart";
};

/** Tabby's own on-site messaging widget — النص/الشعار الترويجي بجانب السعر قبل الدفع. */
export function TabbyPromoSnippet({ publicKey, merchantCode, priceSar, lang, source }: Props) {
  const containerId = `tabby-promo-${useId().replace(/[:]/g, "")}`;
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!(priceSar > 0)) return;
    mountedRef.current = true;
    loadTabbyPromoScript()
      .then(() => {
        if (!mountedRef.current || !window.TabbyPromo) return;
        new window.TabbyPromo({
          selector: `#${containerId}`,
          currency: "SAR",
          price: priceSar.toFixed(2),
          lang,
          source,
          shouldInheritBg: false,
          publicKey,
          merchantCode,
        });
      })
      .catch((e) => console.error("[TabbyPromoSnippet] load failed:", e));
    return () => {
      mountedRef.current = false;
    };
  }, [containerId, publicKey, merchantCode, priceSar, lang, source]);

  if (!(priceSar > 0)) return null;
  return <div id={containerId} />;
}
