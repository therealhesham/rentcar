"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  MapPin,
  Building2,
  Plane,
  X,
  Search,
  ChevronDown,
  Navigation,
  Clock,
  Phone,
  MessageSquare,
} from "lucide-react";
import { useLocale } from "next-intl";
import type { BookingCityBranchesOption, BookingBranchOption } from "@/lib/booking-location-options";
import { useAnchoredPopoverPosition } from "@/lib/use-anchored-popover-position";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  dateCities: BookingCityBranchesOption[];
  selectedBranchSlug: string;
  defaultBranchSlug: string;
  onBranchSelect: (branchSlug: string, citySlug: string) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  containerRef?: React.RefObject<HTMLElement | null>;
  label: string;
};

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function LocationPickerPopover({
  isOpen,
  onClose,
  dateCities,
  selectedBranchSlug,
  defaultBranchSlug,
  onBranchSelect,
  anchorRef,
  label,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [query, setQuery] = useState("");
  const [, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [previewBranchSlug, setPreviewBranchSlug] = useState<string>(selectedBranchSlug || defaultBranchSlug);
  const [showHours, setShowHours] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const { style: panelStyle, ready: panelReady } = useAnchoredPopoverPosition(
    isOpen,
    anchorRef,
    panelRef,
    { panelWidth: 840, gap: 8, forceBelow: true, autoScrollOnOpen: true },
  );

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

  // Setup initial preview branch when opening
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setShowHours(false);
      return;
    }
    const initialSlug = selectedBranchSlug || defaultBranchSlug;
    if (initialSlug) {
      setPreviewBranchSlug(initialSlug);
    }
    setTimeout(() => searchRef.current?.focus(), 60);
  }, [isOpen, selectedBranchSlug, defaultBranchSlug]);

  // Find all branches flattened with city slug
  const allBranches = useMemo(() => {
    const list: Array<{ branch: BookingBranchOption; citySlug: string; cityName: string }> = [];
    for (const c of dateCities) {
      for (const b of c.branches) {
        list.push({ branch: b, citySlug: c.slug, cityName: c.name });
      }
    }
    return list;
  }, [dateCities]);

  // Filtered branches
  const filteredBranches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allBranches;
    return allBranches.filter(
      (item) =>
        item.branch.name.toLowerCase().includes(q) ||
        item.cityName.toLowerCase().includes(q) ||
        (item.branch.address && item.branch.address.toLowerCase().includes(q)),
    );
  }, [query, allBranches]);

  // Group branches by Airport vs Dynamic Cities (from database)
  const { airportBranches, cityGroups } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const airport: Array<{ branch: BookingBranchOption; citySlug: string }> = [];
    const cities: Array<{
      citySlug: string;
      cityName: string;
      headerTitle: string;
      branches: Array<{ branch: BookingBranchOption; citySlug: string }>;
    }> = [];

    for (const city of dateCities) {
      const cityNonAirportBranches: Array<{ branch: BookingBranchOption; citySlug: string }> = [];

      for (const branch of city.branches) {
        const nameLower = branch.name.toLowerCase();
        const matchesQuery =
          !q ||
          nameLower.includes(q) ||
          city.name.toLowerCase().includes(q) ||
          (branch.address && branch.address.toLowerCase().includes(q));

        if (!matchesQuery) continue;

        if (nameLower.includes("مطار") || nameLower.includes("airport")) {
          airport.push({ branch, citySlug: city.slug });
        } else {
          cityNonAirportBranches.push({ branch, citySlug: city.slug });
        }
      }

      if (cityNonAirportBranches.length > 0) {
        const headerTitle = isRTL
          ? city.name.startsWith("فروع")
            ? city.name
            : `فروع ${city.name}`
          : `${city.name} Branches`;

        cities.push({
          citySlug: city.slug,
          cityName: city.name,
          headerTitle,
          branches: cityNonAirportBranches,
        });
      }
    }

    return { airportBranches: airport, cityGroups: cities };
  }, [dateCities, query, isRTL]);

  // Active preview branch object
  const activeBranchItem = useMemo(() => {
    const found = allBranches.find((item) => item.branch.slug === previewBranchSlug);
    return found || allBranches[0] || null;
  }, [allBranches, previewBranchSlug]);

  const activeBranch = activeBranchItem?.branch || null;

  if (!isOpen || (!isMobile && !panelReady) || typeof document === "undefined") return null;

  function selectBranch(branchSlug: string, citySlug: string) {
    onBranchSelect(branchSlug, citySlug);
    onClose();
  }

  if (isMobile) {
    return createPortal(
      <div
        role="dialog"
        aria-label="مكان البحث"
        className="fixed inset-0 z-[100] flex flex-col bg-white text-right font-sans"
        dir={isRTL ? "rtl" : "ltr"}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-[#f0ebe4] px-4 py-3.5 bg-gradient-to-l from-[#fdfbf6] to-[#f9f5ee]">
          <button
            type="button"
            onClick={onClose}
            className="text-[#003749] font-bold text-sm hover:text-[#c9a356] hover:underline focus:outline-none"
          >
            إغلاق
          </button>
          <h3 className="text-base font-bold text-[#003749]">مكان البحث</h3>
        </div>

        {/* Search Input Box */}
        <div className="p-4 bg-white">
          <div className="relative flex items-center gap-2 rounded-xl border border-[#ebe4d3] bg-[#fdfbf6] px-3 py-2.5 shadow-sm focus-within:border-[#dbb878] focus-within:bg-white">
            <MapPin className="size-4 shrink-0 text-[#c9a356]" aria-hidden />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="المدينة"
              className="flex-1 bg-transparent text-sm font-semibold text-[#003749] placeholder:text-[#aaa08e] outline-none"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="flex size-5 items-center justify-center rounded-full text-gray-400 hover:text-gray-600"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Grouped Results */}
        <div className="flex-1 overflow-y-auto pb-10">
          {airportBranches.length === 0 && cityGroups.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#aaa08e]">
              {isRTL ? "لا توجد نتائج مطابقة" : "No matching results"}
            </p>
          ) : (
            <>
              {/* Category 1: Airport Branches */}
              {airportBranches.length > 0 && (
                <div>
                  <div className="bg-[#f9f6f0] border-y border-[#ebe4d3]/60 px-4 py-2 text-xs font-bold text-[#003749] flex items-center justify-between">
                    <span>فروع المطار</span>
                  </div>
                  <div className="divide-y divide-[#f0ebe4]">
                    {airportBranches.map(({ branch, citySlug }) => (
                      <button
                        key={branch.slug}
                        type="button"
                        onClick={() => selectBranch(branch.slug, citySlug)}
                        className="flex items-center justify-between gap-3 w-full px-4 py-3.5 text-start hover:bg-[#fdfbf6] active:bg-[#f9f5ee] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Plane className="size-4 shrink-0 text-[#c9a356]" />
                          <span className="text-sm font-bold text-[#003749]">{branch.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Category 2: Dynamic City Groups (فروع كل مدينة على حدة) */}
              {cityGroups.map((group) => (
                <div key={group.citySlug}>
                  <div className="bg-[#f9f6f0] border-y border-[#ebe4d3]/60 px-4 py-2 text-xs font-bold text-[#003749] flex items-center justify-between">
                    <span>{group.headerTitle}</span>
                  </div>
                  <div className="divide-y divide-[#f0ebe4]">
                    {group.branches.map(({ branch, citySlug }) => (
                      <button
                        key={branch.slug}
                        type="button"
                        onClick={() => selectBranch(branch.slug, citySlug)}
                        className="flex items-center justify-between gap-3 w-full px-4 py-3.5 text-start hover:bg-[#fdfbf6] active:bg-[#f9f5ee] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Building2 className="size-4 shrink-0 text-[#c9a356]" />
                          <span className="text-sm font-bold text-[#003749]">{branch.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>,
      document.body
    );
  }

  // Google Maps Embed URL for active branch
  const mapEmbedUrl = (() => {
    if (!activeBranch) return "";
    if (activeBranch.lat != null && activeBranch.lng != null) {
      return `https://maps.google.com/maps?q=${activeBranch.lat},${activeBranch.lng}&z=14&output=embed`;
    }
    const q = encodeURIComponent(`${activeBranch.name} ${activeBranch.address || ""}`);
    return `https://maps.google.com/maps?q=${q}&z=14&output=embed`;
  })();

  const phoneNum = activeBranch?.phone?.trim() || null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`اختر ${label}`}
      style={panelStyle}
      className="location-popover flex flex-col overflow-hidden rounded-2xl border border-[#ebe4d3] bg-white shadow-[0_20px_60px_-10px_rgba(0,55,73,0.22),0_4px_16px_-4px_rgba(0,55,73,0.12)] text-right"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Popover Header */}
      <div className="flex items-center justify-between border-b border-[#f0ebe4] bg-gradient-to-l from-[#fdfbf6] to-[#f9f5ee] px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-[#dbb878]/15">
            <MapPin className="size-3.5 text-[#dbb878]" />
          </span>
          <span className="text-[13px] font-bold text-[#003749]">موقع الاستلام والتسليم</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-full text-[#8a7752] transition-colors hover:bg-[#f0ebe4] hover:text-[#003749]"
          aria-label="إغلاق"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Main Grid: Right Side (Branch Categories & List), Left Side (Map Preview) */}
      <div className="p-4 bg-white">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          
          {/* RIGHT SIDE: Branch Categories & Search List (1st in DOM -> Right in RTL) */}
          <div className="md:col-span-5 flex flex-col gap-3 max-h-[440px] overflow-hidden pe-1">
            {/* Search Input */}
            <div className="relative flex items-center gap-2 rounded-xl border border-[#ebe4d3] bg-[#fdfbf6] px-3 py-2 transition-all focus-within:border-[#dbb878] focus-within:bg-white">
              <Search className="size-4 shrink-0 text-[#dbb878]" aria-hidden />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isRTL ? "مدينة أو فرع..." : "City or branch..."}
                className="flex-1 bg-transparent text-[13px] text-[#003749] placeholder:text-[#aaa08e] outline-none"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="flex size-5 items-center justify-center rounded-full bg-[#f0ebe4] text-[#8a7752] hover:text-[#003749]"
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </div>

            {/* Find nearest branch shortcut */}
            <button
              type="button"
              className="flex items-center gap-1.5 text-[11px] font-semibold text-[#003749] hover:text-[#dbb878] transition-colors"
              onClick={() => {
                if (!navigator.geolocation) return;
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    setUserLocation({ lat, lng });
                    let bestSlug: string | null = null;
                    let minDist = Infinity;
                    for (const item of allBranches) {
                      if (item.branch.lat == null || item.branch.lng == null) continue;
                      const d = getDistanceKm(lat, lng, item.branch.lat, item.branch.lng);
                      if (d < minDist) {
                        minDist = d;
                        bestSlug = item.branch.slug;
                      }
                    }
                    if (bestSlug) setPreviewBranchSlug(bestSlug);
                  },
                  () => {},
                );
              }}
            >
              <Navigation className="size-3 text-[#dbb878]" />
              <span>{isRTL ? "البحث عن أقرب فرع" : "Find Nearest Branch"}</span>
            </button>

            {/* Scrollable Branch List grouped by category */}
            <div className="flex-1 overflow-y-auto pe-1 space-y-4 max-h-[360px] custom-scrollbar">
              {airportBranches.length === 0 && cityGroups.length === 0 ? (
                <p className="py-8 text-center text-[12px] text-[#aaa08e]">
                  {isRTL ? "لا توجد نتائج مطابقة" : "No matching results"}
                </p>
              ) : (
                <>
                  {/* Category 1: Airport Branches (فروع المطار) */}
                  {airportBranches.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 px-1">
                        <Plane className="size-4 text-[#c9a356]" />
                        <h4 className="text-[13px] font-bold text-[#c9a356]">
                          {isRTL ? "فروع المطار" : "Airport Branches"}
                        </h4>
                      </div>
                      <div className="flex flex-col gap-1">
                        {airportBranches.map(({ branch, citySlug }) => {
                          const isSelected = branch.slug === selectedBranchSlug;
                          const isPreviewed = branch.slug === previewBranchSlug;

                          return (
                            <button
                              key={branch.slug}
                              type="button"
                              onMouseEnter={() => setPreviewBranchSlug(branch.slug)}
                              onClick={() => selectBranch(branch.slug, citySlug)}
                              className={`group flex items-center justify-between gap-2 w-full p-2.5 rounded-xl text-start transition-all ${
                                isSelected
                                  ? "bg-[#dbb878]/20 border border-[#dbb878] text-[#003749] font-bold"
                                  : isPreviewed
                                    ? "bg-[#fdfbf6] border border-[#dbb878]/60 text-[#003749]"
                                    : "bg-white border border-[#f0ebe4] text-gray-700 hover:bg-[#fdfbf6] hover:border-[#dbb878]/40"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <Plane className={`size-3.5 shrink-0 ${isSelected || isPreviewed ? "text-[#dbb878]" : "text-gray-400"}`} />
                                <span className="text-[12px] font-semibold truncate">{branch.name}</span>
                              </div>
                              {isSelected && (
                                <span className="size-2 rounded-full bg-[#dbb878] shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Category 2: Dynamic City Groups (فروع المدينة المنورة, فروع الرياض, إلخ) */}
                  {cityGroups.map((group) => (
                    <div key={group.citySlug} className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 px-1">
                        <Building2 className="size-4 text-[#c9a356]" />
                        <h4 className="text-[13px] font-bold text-[#c9a356]">
                          {group.headerTitle}
                        </h4>
                      </div>
                      <div className="flex flex-col gap-1">
                        {group.branches.map(({ branch, citySlug }) => {
                          const isSelected = branch.slug === selectedBranchSlug;
                          const isPreviewed = branch.slug === previewBranchSlug;

                          return (
                            <button
                              key={branch.slug}
                              type="button"
                              onMouseEnter={() => setPreviewBranchSlug(branch.slug)}
                              onClick={() => selectBranch(branch.slug, citySlug)}
                              className={`group flex items-center justify-between gap-2 w-full p-2.5 rounded-xl text-start transition-all ${
                                isSelected
                                  ? "bg-[#dbb878]/20 border border-[#dbb878] text-[#003749] font-bold"
                                  : isPreviewed
                                    ? "bg-[#fdfbf6] border border-[#dbb878]/60 text-[#003749]"
                                    : "bg-white border border-[#f0ebe4] text-gray-700 hover:bg-[#fdfbf6] hover:border-[#dbb878]/40"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <Building2 className={`size-3.5 shrink-0 ${isSelected || isPreviewed ? "text-[#dbb878]" : "text-gray-400"}`} />
                                <span className="text-[12px] font-semibold truncate">{branch.name}</span>
                              </div>
                              {isSelected && (
                                <span className="size-2 rounded-full bg-[#dbb878] shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* LEFT SIDE: Interactive Map Preview & Info Card Overlay (2nd in DOM -> Left in RTL) */}
          <div className="md:col-span-7 relative h-[400px] rounded-2xl overflow-hidden border border-[#ebe4d3] shadow-inner bg-[#f9f5ee]">
            {activeBranch ? (
              <>
                {/* Embedded Map */}
                <iframe
                  title={`خريطة ${activeBranch.name}`}
                  src={mapEmbedUrl}
                  className="w-full h-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />

                {/* Floating Branch Info Card Overlay */}
                <div className="absolute top-3 start-3 z-10 w-[270px] max-w-[calc(100%-24px)] rounded-xl bg-white/95 backdrop-blur-md p-3.5 shadow-lg border border-[#ebe4d3] text-right flex flex-col gap-2">
                  {/* Branch Name */}
                  <h5 className="text-[13px] font-bold text-[#003749] leading-snug">
                    {activeBranch.name}
                  </h5>

                  {/* Address */}
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    {activeBranch.address || activeBranch.name}
                  </p>

                  {/* Working Hours Toggle */}
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => setShowHours((v) => !v)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-[#8a7752] hover:text-[#003749] transition-colors"
                    >
                      <Clock className="size-3 text-[#dbb878]" />
                      <span>{isRTL ? "ساعات العمل" : "Working Hours"}</span>
                      <ChevronDown className={`size-3 transition-transform ${showHours ? "rotate-180" : ""}`} />
                    </button>

                    {showHours && (
                      <div className="mt-1.5 text-[10px] text-gray-600 bg-[#fdfbf6] p-2 rounded-lg border border-[#f0ebe4]">
                        <p className="font-semibold text-[#003749]">طوال أيام الأسبوع</p>
                        <p className="mt-0.5 text-gray-500">08:00 صباحاً - 11:00 مساءً</p>
                      </div>
                    )}
                  </div>

                  {/* Phone Call Pill Button */}
                  {phoneNum && (
                    <div className="pt-1">
                      <a
                        href={`tel:${phoneNum.replace(/\s+/g, "")}`}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#fdfbf6] border border-[#ebe4d3] text-[11px] font-bold text-[#003749] hover:bg-[#dbb878] hover:text-white transition-all shadow-sm"
                        dir="ltr"
                      >
                        <Phone className="size-3 text-[#dbb878]" />
                        <span>{phoneNum}</span>
                      </a>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-gray-400 text-[12px]">
                {isRTL ? "اختر فرعاً لعرض الخريطة" : "Select a branch to view map"}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>,
    document.body,
  );
}

