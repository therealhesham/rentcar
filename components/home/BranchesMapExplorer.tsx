"use client";

import { MapPin, Phone, Navigation } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { parseLatLngFromMapUrl } from "@/lib/delivery-origin-city";

export type ExplorerBranch = {
  id: number;
  slug: string;
  name: string;
  tagline: string | null;
  address: string | null;
  phone: string | null;
  mapUrl: string | null;
  resolvedMapUrl?: string | null;
};

export type ExplorerCityGroup = {
  cityName: string;
  branches: ExplorerBranch[];
};

function resolveBranchMapUrl(branch: ExplorerBranch) {
  const direct = branch.mapUrl?.trim();
  if (direct) return direct;
  return `https://maps.google.com/?q=${encodeURIComponent(branch.name)}`;
}

function resolveBranchEmbedUrl(branch: ExplorerBranch, locale: string) {
  // نعتمد على الرابط الذي تم تحليله إذا كان موجوداً
  const mapUrl = branch.resolvedMapUrl?.trim() || branch.mapUrl?.trim();
  
  if (mapUrl) {
    if (mapUrl.includes("output=embed") || mapUrl.includes("/embed")) {
      return mapUrl;
    }

    const coords = parseLatLngFromMapUrl(mapUrl);
    if (coords) {
      return `https://maps.google.com/maps?q=${coords.lat},${coords.lng}&hl=${locale}&z=15&output=embed`;
    }

    const cidMatch = mapUrl.match(/[?&]cid=(\d+)/i);
    if (cidMatch) {
      return `https://maps.google.com/maps?cid=${cidMatch[1]}&hl=${locale}&z=15&output=embed`;
    }

    const placeMatch = mapUrl.match(/\/maps\/place\/([^/@?]+)/i);
    if (placeMatch && placeMatch[1]) {
      const placeName = decodeURIComponent(placeMatch[1]).replace(/\+/g, " ");
      return `https://maps.google.com/maps?q=${encodeURIComponent(placeName)}&hl=${locale}&z=15&output=embed`;
    }

    try {
      const u = new URL(mapUrl);
      const qParam = u.searchParams.get("q")?.trim() || u.searchParams.get("query")?.trim();
      if (qParam && !qParam.startsWith("http")) {
        return `https://maps.google.com/maps?q=${encodeURIComponent(qParam)}&hl=${locale}&z=15&output=embed`;
      }
    } catch {}
  }

  const queryParts = [branch.name, branch.address?.trim()].filter(Boolean);
  const query = queryParts.join(" ، ") || branch.name;
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&hl=${locale}&z=14&output=embed`;
}

export function BranchesMapExplorer({ groups }: { groups: ExplorerCityGroup[] }) {
  const t = useTranslations("Branches");
  const locale = useLocale();

  const allBranches = useMemo(() => groups.flatMap((g) => g.branches), [groups]);
  const [selectedId, setSelectedId] = useState<number | null>(allBranches[0]?.id ?? null);
  const selected = allBranches.find((b) => b.id === selectedId) ?? allBranches[0];

  if (!selected) return null;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-5 lg:gap-6">
      <div
        role="listbox"
        aria-label={t("branchesList")}
        className="order-2 flex max-h-[300px] flex-col gap-4 overflow-y-auto pe-1 lg:order-1 lg:col-span-2 lg:max-h-[560px] [scrollbar-width:thin] [scrollbar-color:#dbb878_transparent]"
      >
        {groups.map((group) => (
          <div key={group.cityName}>
            <p className="sticky top-0 z-10 flex items-center gap-2 bg-gradient-to-b from-[#fdfbf6] via-[#fdfbf6]/95 to-transparent pb-2 pt-1 text-xs font-extrabold tracking-widest text-[#775927]">
              <span className="h-px w-4 bg-[#dbb878]" aria-hidden />
              {group.cityName}
            </p>
            <div className="flex flex-col gap-2">
              {group.branches.map((branch) => {
                const isActive = branch.id === selected.id;
                return (
                  <button
                    key={branch.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => setSelectedId(branch.id)}
                    className={`group flex items-start gap-3 rounded-2xl border p-4 text-start transition-all duration-300 ${
                      isActive
                        ? "border-[#dbb878] bg-white shadow-[0_12px_32px_-12px_rgba(219,184,120,0.35)]"
                        : "border-[#ebe4d3]/70 bg-white/60 hover:border-[#dbb878]/50 hover:bg-white"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-300 ${
                        isActive
                          ? "bg-[#003749] text-[#dbb878]"
                          : "bg-[#fdfbf6] text-[#003749] ring-1 ring-[#ebe4d3] group-hover:text-[#dbb878]"
                      }`}
                    >
                      <MapPin className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-extrabold text-[#003749]">
                        {branch.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs leading-relaxed text-[#8a7752]">
                        {branch.address?.trim() || branch.tagline?.trim() || t("defaultAddress")}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="order-1 lg:order-2 lg:col-span-3">
        <div className="relative h-[320px] overflow-hidden rounded-3xl border border-[#ebe4d3] bg-[#fdfbf6] shadow-[0_24px_60px_-24px_rgba(15,61,71,0.25)] sm:h-[440px] lg:h-[560px]">
          <iframe
            key={selected.id}
            title={t("mapTitle", { name: selected.name })}
            src={resolveBranchEmbedUrl(selected, locale)}
            className="block h-full w-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />

          <div className="pointer-events-none absolute inset-x-3 bottom-3 sm:inset-x-4 sm:bottom-4">
            <div className="pointer-events-auto flex flex-col gap-3 rounded-2xl border border-white/60 bg-white/90 p-4 shadow-[0_16px_40px_-16px_rgba(15,61,71,0.3)] backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-[#003749]">{selected.name}</p>
                <p className="mt-0.5 truncate text-xs text-[#8a7752]">
                  {selected.address?.trim() || selected.tagline?.trim() || t("defaultAddress")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {selected.phone?.trim() ? (
                  <a
                    href={`tel:${selected.phone.trim()}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#003749] px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90"
                  >
                    <Phone className="size-3.5" aria-hidden />
                    {t("call")}
                  </a>
                ) : null}
                <a
                  href={resolveBranchMapUrl(selected)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#dbb878] bg-[#dbb878]/15 px-4 py-2 text-xs font-bold text-[#775927] transition-colors hover:bg-[#dbb878]/30"
                >
                  <Navigation className="size-3.5" aria-hidden />
                  {t("directions")}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
