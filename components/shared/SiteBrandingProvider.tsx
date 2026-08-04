"use client";

import { createContext, useContext } from "react";
import { DEFAULT_SITE_BRANDING, type SiteBranding } from "@/lib/site-branding";

/**
 * الشعارات تُقرأ مرة واحدة في تخطيط اللغة وتُمرَّر عبر السياق، لأن `SiteNav`
 * و`SiteFooter` مكوّنات عميل تُستدعى من صفحات خادم وصفحات عميل معاً — فلا يمكن
 * جعلها مكوّنات خادم تقرأ من قاعدة البيانات مباشرة.
 */
const SiteBrandingContext = createContext<SiteBranding>(DEFAULT_SITE_BRANDING);

export function SiteBrandingProvider({
  value,
  children,
}: {
  value: SiteBranding;
  children: React.ReactNode;
}) {
  return (
    <SiteBrandingContext.Provider value={value}>{children}</SiteBrandingContext.Provider>
  );
}

export function useSiteBranding(): SiteBranding {
  return useContext(SiteBrandingContext);
}
