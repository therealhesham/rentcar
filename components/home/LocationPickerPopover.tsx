"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  MapPin,
  Building2,
  X,
  Search,
  ChevronDown,
  Navigation,
  Clock,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import type { BookingCityBranchesOption, BookingBranchOption } from "@/lib/booking-location-options";
import { OVERLAY_PANEL_Z } from "@/lib/overlay-z-index";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  dateCities: BookingCityBranchesOption[];
  selectedBranchSlug: string;
  defaultBranchSlug: string;
  onBranchSelect: (branchSlug: string, citySlug: string) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  /** إذا مُرِّر، يُطابق عرض اللوحة عرض هذا الحاوي (مثل النموذج كاملاً). */
  containerRef?: React.RefObject<HTMLElement | null>;
  label: string;
};

/** Hook: يضع اللوحة أسفل anchor بنفس عرض containerRef (أو anchor إن لم يُمرَّر). */
function useWidgetAlignedPosition(
  isOpen: boolean,
  anchorRef: React.RefObject<HTMLElement | null>,
  containerRef: React.RefObject<HTMLElement | null> | undefined,
  panelRef: React.RefObject<HTMLElement | null>,
  gap = 6,
) {
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [ready, setReady] = useState(false);

  const update = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return false;
    const ar = anchor.getBoundingClientRect();
    if (ar.width === 0 && ar.height === 0) return false;

    const container = containerRef?.current;
    const cr = container ? container.getBoundingClientRect() : ar;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Width: full container width, clamped to viewport
    const panelW = Math.min(cr.width, vw - 16);
    // Left: align with container left, keeping inside viewport
    let left = cr.left;
    if (left < 8) left = 8;
    if (left + panelW > vw - 8) left = vw - 8 - panelW;

    const panelH = panelRef.current?.offsetHeight ?? 400;
    const belowTop = ar.bottom + gap;
    const fitsBelow = belowTop + panelH <= vh - 8;
    const top = fitsBelow ? belowTop : Math.max(8, ar.top - gap - panelH);

    setStyle({
      position: "fixed",
      top,
      left,
      width: panelW,
      zIndex: OVERLAY_PANEL_Z,
    });
    setReady(true);
    return true;
  }, [anchorRef, containerRef, panelRef, gap]);

  useLayoutEffect(() => {
    if (!isOpen) { setReady(false); setStyle({}); return; }
    let cancelled = false;
    let raf = 0;
    const run = () => { if (cancelled) return; if (update()) return; raf = requestAnimationFrame(run); };
    run();
    return () => { cancelled = true; if (raf) cancelAnimationFrame(raf); };
  }, [isOpen, update]);

  useLayoutEffect(() => { if (isOpen && ready) update(); }, [isOpen, ready, update]);

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

type BranchMatch = {
  branch: BookingBranchOption;
  citySlug: string;
  cityName: string;
};

/* ─── Branch Card ─────────────────────────────────────────────────────────── */
function BranchCard({
  branch,
  isSelected,
  onClick,
  isRTL,
}: {
  branch: BookingBranchOption;
  isSelected: boolean;
  onClick: () => void;
  isRTL: boolean;
}) {
  const hasCoords = branch.lat != null && branch.lng != null;
  const hasMapLink = !!branch.mapUrl || hasCoords;

  function handleMapClick(e: React.MouseEvent) {
    e.stopPropagation();
    let url = branch.mapUrl;
    if (!url && branch.lat != null && branch.lng != null) {
      url = `https://www.google.com/maps/search/?api=1&query=${branch.lat},${branch.lng}`;
    }
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className={`group relative flex w-full cursor-pointer flex-col gap-2 rounded-xl border p-3.5 text-start transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#dbb878] ${
        isSelected
          ? "border-[#dbb878] bg-[#fffcf5] shadow-[0_0_0_2px_rgba(219,184,120,0.25)]"
          : "border-[#ebe4d3] bg-white hover:border-[#dbb878]/60 hover:bg-[#fffdf9] hover:shadow-sm"
      }`}
    >
      {/* Selected indicator */}
      {isSelected && (
        <span className="absolute end-3 top-3 flex size-5 items-center justify-center rounded-full bg-[#dbb878]">
          <svg className="size-3 text-white" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}

      {/* Branch name and map pin */}
      <div className="flex items-start justify-between gap-2 pe-6">
        <span className="flex items-center gap-2">
          <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${isSelected ? "bg-[#dbb878]/20" : "bg-[#f5f0e8] group-hover:bg-[#dbb878]/15"} transition-colors`}>
            {hasCoords
              ? <MapPin className={`size-3.5 ${isSelected ? "text-[#c9a356]" : "text-[#8a7752]"}`} />
              : <Building2 className={`size-3.5 ${isSelected ? "text-[#c9a356]" : "text-[#8a7752]"}`} />}
          </span>
          <span className={`text-[13px] font-bold leading-snug ${isSelected ? "text-[#003749]" : "text-[#1a1a1a] group-hover:text-[#003749]"} transition-colors`}>
            {branch.name}
          </span>
        </span>

        {hasMapLink && (
          <button
            type="button"
            onClick={handleMapClick}
            title={isRTL ? "عرض الموقع على الخريطة" : "View on map"}
            className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[#ebe4d3] bg-[#fdfbf6] text-[#8a7752] transition-colors hover:border-[#dbb878] hover:bg-[#dbb878]/10 hover:text-[#c9a356]"
          >
            <MapPin className="size-3.5" />
          </button>
        )}
      </div>

      {/* Address */}
      {branch.address && (
        <span className="text-[11px] text-[#6b5a3b] leading-relaxed">
          {branch.address}
        </span>
      )}

      {/* Opening hours hint */}
      {branch.openingHours && (
        <span className="flex items-center gap-1.5 text-[11px] text-[#8a7752]">
          <Clock className="size-3 shrink-0" aria-hidden />
          <span className="leading-tight">
            {isRTL ? "متاح الأسبوع" : "Available"}
          </span>
        </span>
      )}
    </div>
  );
}

/* ─── City Accordion Row ──────────────────────────────────────────────────── */
function CityAccordion({
  city,
  isExpanded,
  isRTL,
  effectiveBranch,
  onToggle,
  onBranchSelect,
}: {
  city: BookingCityBranchesOption;
  isExpanded: boolean;
  isRTL: boolean;
  effectiveBranch: string;
  onToggle: () => void;
  onBranchSelect: (branchSlug: string, citySlug: string) => void;
}) {
  const selectedInThisCity = city.branches.some((b) => b.slug === effectiveBranch);

  return (
    <div className="border-b border-[#f0ebe4] last:border-0">
      {/* Accordion header */}
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full cursor-pointer items-center justify-between px-4 py-3.5 text-start transition-colors hover:bg-[#fdfbf6] ${isExpanded ? "bg-[#fdfbf6]" : ""}`}
      >
        <span className="flex items-center gap-3">
          <span className={`flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors ${isExpanded ? "border-[#dbb878]/40 bg-[#dbb878]/10" : "border-[#ebe4d3] bg-[#f5f0e8]"}`}>
            <Building2 className={`size-3.5 ${isExpanded ? "text-[#c9a356]" : "text-[#8a7752]"}`} />
          </span>
          <span>
            <span className={`block text-[14px] font-bold ${isExpanded ? "text-[#003749]" : "text-[#1a1a1a]"} transition-colors`}>
              {city.name}
              {selectedInThisCity && (
                <span className="ms-2 inline-flex size-2 rounded-full bg-[#dbb878] align-middle" />
              )}
            </span>
            <span className="block text-[11px] text-[#8a7752]">
              {city.branches.length} {isRTL ? "فرع" : "branch"}
            </span>
          </span>
        </span>
        <ChevronDown
          className={`size-4 text-[#8a7752] transition-transform duration-200 ${isExpanded ? "rotate-180 text-[#c9a356]" : ""}`}
          aria-hidden
        />
      </button>

      {/* Accordion body — branch cards grid */}
      {isExpanded && (
        <div className="grid grid-cols-1 gap-2.5 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-3">
          {city.branches.map((branch) => (
            <BranchCard
              key={branch.slug}
              branch={branch}
              isSelected={branch.slug === effectiveBranch}
              isRTL={isRTL}
              onClick={() => onBranchSelect(branch.slug, city.slug)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main Popover ────────────────────────────────────────────────────────── */
export function LocationPickerPopover({
  isOpen,
  onClose,
  dateCities,
  selectedBranchSlug,
  defaultBranchSlug,
  onBranchSelect,
  anchorRef,
  containerRef,
  label,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const t = useTranslations("Common");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [query, setQuery] = useState("");
  const [expandedCities, setExpandedCities] = useState<Set<string>>(() => {
    // Start with first city expanded
    const s = new Set<string>();
    if (dateCities[0]) s.add(dateCities[0].slug);
    return s;
  });

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handler(e: MouseEvent) {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!panel) return;
      if (
        !panel.contains(e.target as Node) &&
        (!anchor || !anchor.contains(e.target as Node))
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose, anchorRef]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Reset & setup when opening
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      return;
    }

    // Auto-expand city of selected branch
    const effectiveBranch = selectedBranchSlug || defaultBranchSlug;
    const selectedCity = dateCities.find((c) =>
      c.branches.some((b) => b.slug === effectiveBranch)
    );

    setExpandedCities(() => {
      const s = new Set<string>();
      if (selectedCity) {
        s.add(selectedCity.slug);
      } else if (dateCities[0]) {
        s.add(dateCities[0].slug);
      }
      return s;
    });

    // Auto-focus search field
    setTimeout(() => searchRef.current?.focus(), 60);
  }, [isOpen, selectedBranchSlug, defaultBranchSlug, dateCities]);

  // Expand cities that match query
  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) return;
    const toExpand = new Set<string>();
    for (const city of dateCities) {
      const cityMatches = city.name.toLowerCase().includes(q);
      const branchMatches = city.branches.some((b) =>
        b.name.toLowerCase().includes(q)
      );
      if (cityMatches || branchMatches) toExpand.add(city.slug);
    }
    setExpandedCities(toExpand);
  }, [query, dateCities]);

  // Search results (filtered cities & branches)
  const filteredCities = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return dateCities;
    return dateCities
      .map((city) => {
        const cityMatches = city.name.toLowerCase().includes(q);
        const matchedBranches = cityMatches
          ? city.branches
          : city.branches.filter((b) => b.name.toLowerCase().includes(q));
        return matchedBranches.length > 0 ? { ...city, branches: matchedBranches } : null;
      })
      .filter(Boolean) as BookingCityBranchesOption[];
  }, [query, dateCities]);

  const effectiveBranch = selectedBranchSlug || defaultBranchSlug;
  const isSearching = query.trim().length > 0;
  const totalBranches = dateCities.reduce((s, c) => s + c.branches.length, 0);

  const { style: panelStyle, ready: panelReady } = useWidgetAlignedPosition(
    isOpen,
    anchorRef,
    containerRef,
    panelRef,
  );

  if (!isOpen || !panelReady || typeof document === "undefined") return null;

  function selectBranch(branchSlug: string, citySlug: string) {
    onBranchSelect(branchSlug, citySlug);
    onClose();
  }

  function toggleCity(slug: string) {
    setExpandedCities((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`${t("select")} ${label}`}
      style={panelStyle}
      className="location-popover flex flex-col overflow-hidden rounded-2xl border border-[#e8e0d0] bg-white shadow-[0_24px_64px_-12px_rgba(0,55,73,0.20),0_4px_16px_-6px_rgba(0,55,73,0.10)]"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* ── Search bar ─────────────────────────────────────── */}
      <div className="shrink-0 bg-white px-4 pt-4 pb-3">
        <div className="relative flex items-center gap-2 rounded-xl border-2 border-[#ebe4d3] bg-[#fafaf8] px-3.5 py-2.5 transition-[border-color,box-shadow] focus-within:border-[#dbb878] focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(219,184,120,0.15)]">
          <Search className="size-4 shrink-0 text-[#c9a356]" aria-hidden />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isRTL ? "ابحث عن مدينة أو فرع…" : "Search for a city or branch…"}
            className="flex-1 bg-transparent text-[14px] text-[#0f1923] placeholder:text-[#aaa08e] outline-none"
            aria-label={isRTL ? "بحث عن مدينة أو فرع" : "Search city or branch"}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="flex size-6 cursor-pointer shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[#f0ebe4]"
              aria-label={isRTL ? "مسح البحث" : "Clear search"}
            >
              <X className="size-3.5 text-[#8a7752]" />
            </button>
          ) : null}
        </div>

        {/* "Find branches near me" shortcut */}
        <button
          type="button"
          className="mt-2.5 flex cursor-pointer items-center gap-2 text-[12px] font-semibold text-[#003749] transition-opacity hover:opacity-75"
          onClick={() => {
            if (!navigator.geolocation) return;
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                // Find closest branch
                let best: { slug: string; citySlug: string; dist: number } | null = null;
                for (const city of dateCities) {
                  for (const b of city.branches) {
                    if (b.lat == null || b.lng == null) continue;
                    const dist = Math.hypot(b.lat - pos.coords.latitude, b.lng - pos.coords.longitude);
                    if (!best || dist < best.dist) best = { slug: b.slug, citySlug: city.slug, dist };
                  }
                }
                if (best) selectBranch(best.slug, best.citySlug);
              },
              () => {/* ignore */}
            );
          }}
        >
          <Navigation className="size-3.5 text-[#dbb878]" aria-hidden />
          {isRTL ? "البحث عن أقرب فرع" : "Find Branches Near Me"}
        </button>
      </div>

      {/* ── City list heading ───────────────────────────────── */}
      <div className="shrink-0 border-t border-b border-[#f0ebe4] bg-[#fdfbf6] px-4 py-2">
        <span className="text-[12px] font-bold uppercase tracking-widest text-[#8a7752]">
          {isSearching
            ? isRTL
              ? `${filteredCities.reduce((s, c) => s + c.branches.length, 0)} نتيجة`
              : `${filteredCities.reduce((s, c) => s + c.branches.length, 0)} result(s)`
            : isRTL
              ? `${dateCities.length} مدينة — ${totalBranches} فرع`
              : `${dateCities.length} cities — ${totalBranches} branches`}
        </span>
      </div>

      {/* ── Scrollable accordion list ───────────────────────── */}
      <div className="overflow-y-auto" style={{ maxHeight: 420 }}>
        {filteredCities.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-[#aaa08e]">
            {isRTL ? "لا توجد نتائج مطابقة" : "No results found"}
          </p>
        ) : (
          filteredCities.map((city) => (
            <CityAccordion
              key={city.slug}
              city={city}
              isExpanded={expandedCities.has(city.slug)}
              isRTL={isRTL}
              effectiveBranch={effectiveBranch}
              onToggle={() => toggleCity(city.slug)}
              onBranchSelect={selectBranch}
            />
          ))
        )}
      </div>
    </div>,
    document.body,
  );
}
