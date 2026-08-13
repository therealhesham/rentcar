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

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;  
  const dLon = (lon2 - lon1) * Math.PI / 180; 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
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
  userLocation,
}: {
  branch: BookingBranchOption;
  isSelected: boolean;
  onClick: () => void;
  isRTL: boolean;
  userLocation?: { lat: number; lng: number } | null;
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
      className={`group relative flex w-full cursor-pointer flex-col gap-2.5 rounded-xl border p-4 text-start transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#dbb878] ${
        isSelected
          ? "border-[#dbb878] bg-[#fffcf5] shadow-[0_4px_20px_-4px_rgba(219,184,120,0.3)] ring-1 ring-[#dbb878]/50"
          : "border-[#e8e0d0] bg-white hover:-translate-y-0.5 hover:border-[#dbb878]/60 hover:bg-[#faf9f5] hover:shadow-[0_8px_24px_-8px_rgba(0,55,73,0.12)]"
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
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${isSelected ? "bg-[#dbb878]/20 shadow-inner" : "bg-[#f5f0e8] group-hover:bg-[#dbb878]/15"} transition-all duration-300`}>
            {hasCoords
              ? <MapPin className={`size-4 ${isSelected ? "text-[#c9a356]" : "text-[#8a7752]"}`} />
              : <Building2 className={`size-4 ${isSelected ? "text-[#c9a356]" : "text-[#8a7752]"}`} />}
          </span>
          <span className={`min-w-0 flex-1 text-[14px] font-bold leading-snug whitespace-normal break-words ${isSelected ? "text-[#003749]" : "text-[#1a1a1a] group-hover:text-[#003749]"} transition-colors duration-300`}>
            {branch.name}
          </span>
        </span>

        {hasMapLink && (
          <button
            type="button"
            onClick={handleMapClick}
            title={isRTL ? "عرض الموقع على الخريطة" : "View on map"}
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#e8e0d0] bg-white text-[#8a7752] shadow-sm transition-all duration-300 hover:scale-105 hover:border-[#dbb878] hover:bg-[#dbb878] hover:text-white hover:shadow-md"
          >
            <MapPin className="size-4" />
          </button>
        )}
      </div>

      {/* Address & Distance */}
      <div className="flex items-start justify-between gap-2">
        {branch.address && (
          <span className="flex items-start gap-1.5 text-[12px] text-[#5c4d32] leading-relaxed opacity-90">
            <MapPin className="mt-0.5 size-3 shrink-0 text-[#8a7752]/70" aria-hidden />
            <span>{branch.address}</span>
          </span>
        )}
        
        {userLocation && branch.lat != null && branch.lng != null && (
          <span className="shrink-0 flex items-center gap-1.5 text-[11px] font-bold text-[#003749] bg-[#e8e0d0]/40 px-2 py-1 rounded-md">
            <Navigation className="size-3 text-[#dbb878]" />
            <span dir="ltr">
              {(() => {
                const dist = getDistanceKm(userLocation.lat, userLocation.lng, branch.lat, branch.lng);
                return dist < 1 
                  ? `${(dist * 1000).toFixed(0)} ${isRTL ? "متر" : "m"}` 
                  : `${dist.toFixed(1)} ${isRTL ? "كم" : "km"}`;
              })()}
            </span>
          </span>
        )}
      </div>

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
  userLocation,
  onToggle,
  onBranchSelect,
}: {
  city: BookingCityBranchesOption;
  isExpanded: boolean;
  isRTL: boolean;
  effectiveBranch: string;
  userLocation?: { lat: number; lng: number } | null;
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
        className={`group flex w-full cursor-pointer items-center justify-between px-5 py-4 text-start transition-all duration-300 hover:bg-[#faf9f5] ${isExpanded ? "bg-[#faf9f5]" : ""}`}
      >
        <span className="flex items-center gap-3.5">
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-full border shadow-sm transition-all duration-300 ${isExpanded ? "border-[#dbb878]/50 bg-[#fffcf5] text-[#dbb878] scale-105" : "border-[#e8e0d0] bg-white text-[#8a7752] group-hover:border-[#dbb878]/30 group-hover:text-[#dbb878]"}`}>
            <Building2 className="size-4" />
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

      {/* Accordion body — branch cards list */}
      {isExpanded && (
        <div className="grid grid-cols-1 gap-2.5 px-4 pb-4">
          {city.branches.map((branch) => (
            <BranchCard
              key={branch.slug}
              branch={branch}
              isSelected={branch.slug === effectiveBranch}
              isRTL={isRTL}
              userLocation={userLocation}
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
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
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
    const effectiveBranch = selectedBranchSlug;
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
    let cities = dateCities;
    
    if (q) {
      cities = cities
        .map((city) => {
          const cityMatches = city.name.toLowerCase().includes(q);
          const matchedBranches = cityMatches
            ? city.branches
            : city.branches.filter((b) => b.name.toLowerCase().includes(q));
          return matchedBranches.length > 0 ? { ...city, branches: matchedBranches } : null;
        })
        .filter(Boolean) as BookingCityBranchesOption[];
    }

    if (userLocation) {
      cities = cities.map(city => {
        const sortedBranches = [...city.branches].sort((a, b) => {
          if (a.lat == null || a.lng == null) return 1;
          if (b.lat == null || b.lng == null) return -1;
          const distA = getDistanceKm(userLocation.lat, userLocation.lng, a.lat, a.lng);
          const distB = getDistanceKm(userLocation.lat, userLocation.lng, b.lat, b.lng);
          return distA - distB;
        });
        return { ...city, branches: sortedBranches };
      }).sort((cityA, cityB) => {
        const aFirst = cityA.branches[0];
        const bFirst = cityB.branches[0];
        if (!aFirst || aFirst.lat == null || aFirst.lng == null) return 1;
        if (!bFirst || bFirst.lat == null || bFirst.lng == null) return -1;
        const distA = getDistanceKm(userLocation.lat, userLocation.lng, aFirst.lat, aFirst.lng);
        const distB = getDistanceKm(userLocation.lat, userLocation.lng, bFirst.lat, bFirst.lng);
        return distA - distB;
      });
    }

    return cities;
  }, [query, dateCities, userLocation]);

  const effectiveBranch = selectedBranchSlug;
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
      className="location-popover flex flex-col overflow-hidden rounded-2xl border border-[#e8e0d0]/60 bg-white/95 backdrop-blur-md shadow-[0_32px_64px_-12px_rgba(0,55,73,0.25),0_8px_24px_-8px_rgba(0,55,73,0.15)] ring-1 ring-black/5"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* ── Search bar ─────────────────────────────────────── */}
      <div className="shrink-0 bg-white/80 px-5 pt-5 pb-3">
        <div className="relative flex items-center gap-2.5 rounded-xl border-2 border-[#e8e0d0] bg-[#faf9f5] px-4 py-3 transition-all duration-300 focus-within:border-[#dbb878] focus-within:bg-white focus-within:shadow-[0_4px_20px_-4px_rgba(219,184,120,0.2)]">
          <Search className="size-4.5 shrink-0 text-[#dbb878]" aria-hidden />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isRTL ? "ابحث عن مدينة أو فرع…" : "Search for a city or branch…"}
            className="flex-1 bg-transparent text-[15px] text-[#003749] placeholder:text-[#8a7752] outline-none"
            aria-label={isRTL ? "بحث عن مدينة أو فرع" : "Search city or branch"}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="flex size-7 cursor-pointer shrink-0 items-center justify-center rounded-full bg-[#f5f0e8] text-[#8a7752] transition-all hover:bg-[#e8e0d0] hover:text-[#003749]"
              aria-label={isRTL ? "مسح البحث" : "Clear search"}
            >
              <X className="size-4" />
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
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                setUserLocation({ lat, lng });
                
                // Find closest city to expand it
                let bestCity: string | null = null;
                let minDist = Infinity;
                for (const city of dateCities) {
                  for (const b of city.branches) {
                    if (b.lat == null || b.lng == null) continue;
                    const dist = getDistanceKm(lat, lng, b.lat, b.lng);
                    if (dist < minDist) {
                      minDist = dist;
                      bestCity = city.slug;
                    }
                  }
                }
                if (bestCity) {
                  setExpandedCities((prev) => {
                    const next = new Set(prev);
                    next.add(bestCity!);
                    return next;
                  });
                }
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
              userLocation={userLocation}
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
