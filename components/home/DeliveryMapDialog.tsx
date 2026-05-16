"use client";

import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { OVERLAY_BACKDROP_Z, OVERLAY_PANEL_Z } from "@/lib/overlay-z-index";

type LatLng = { lat: number; lng: number };

const SA_CENTER: LatLng = { lat: 24.7136, lng: 46.6753 };

type MapEngine = "google" | "osm";

type Props = {
  open: boolean;
  onClose: () => void;
  initial: LatLng | null;
  onConfirm: (lat: number, lng: number) => void;
};

/** إصلاح أيقونة Marker في Leaflet مع الحزم الحديثة */
function fixLeafletDefaultIcons(L: typeof import("leaflet")) {
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

function isValidLatLng(v: LatLng): boolean {
  return (
    Number.isFinite(v.lat) &&
    Number.isFinite(v.lng) &&
    v.lat >= -90 &&
    v.lat <= 90 &&
    v.lng >= -180 &&
    v.lng <= 180
  );
}

function formatCoord6(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(6);
}

export function DeliveryMapDialog({ open, onClose, initial, onConfirm }: Props) {
  const mapElRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [internal, setInternal] = useState<LatLng>(initial ?? SA_CENTER);
  const [mapReady, setMapReady] = useState(false);

  const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
  const hasGoogleKey = Boolean(googleApiKey);

  const [mapEngine, setMapEngine] = useState<MapEngine>(() =>
    hasGoogleKey ? "google" : "osm",
  );

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (open && initial) {
      setInternal(initial);
    }
    if (open && !initial) {
      setInternal(SA_CENTER);
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setMapReady(false);
      return;
    }
    setMapReady(false);
  }, [open, mapEngine]);

  /** Google Maps */
  useEffect(() => {
    if (!open || !mapElRef.current || mapEngine !== "google" || !hasGoogleKey) return;

    let cancelled = false;
    const el = mapElRef.current;
    const centerLat = internal.lat;
    const centerLng = internal.lng;

    void (async () => {
      try {
        const { setOptions, importLibrary } = await import("@googlemaps/js-api-loader");
        setOptions({ key: googleApiKey, v: "weekly" });
        const { Map } = await importLibrary("maps");
        const { Marker } = await importLibrary("marker");
        if (cancelled || !mapElRef.current) return;

        const center = { lat: centerLat, lng: centerLng };
        const map = new Map(mapElRef.current, {
          center,
          zoom: 14,
          streetViewControl: false,
          mapTypeControl: true,
          fullscreenControl: false,
        });

        const marker = new Marker({
          position: center,
          map,
          draggable: true,
        });

        marker.addListener("dragend", () => {
          const p = marker.getPosition();
          if (p) {
            setInternal({ lat: p.lat(), lng: p.lng() });
          }
        });

        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          marker.setPosition({ lat, lng });
          setInternal({ lat, lng });
        });

        if (!cancelled) setMapReady(true);
      } catch {
        if (!cancelled) setMapReady(true);
      }
    })();

    return () => {
      cancelled = true;
      el.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- إعادة بناء عند فتح الحوار أو تبديل المحرك؛ المركز يُلتقط عند تشغيل التأثير
  }, [open, mapEngine, hasGoogleKey, googleApiKey]);

  /** Leaflet + OpenStreetMap (مجاني، بدون مفتاح) */
  useEffect(() => {
    if (!open || !mapElRef.current || mapEngine !== "osm") return;

    const el = mapElRef.current;
    const state = {
      map: null as import("leaflet").Map | null,
      cancelled: false,
    };

    const centerLat = internal.lat;
    const centerLng = internal.lng;

    void (async () => {
      try {
        const L = (await import("leaflet")).default;
        fixLeafletDefaultIcons(L);
        if (state.cancelled || !el.isConnected) return;

        state.map = L.map(el, {
          center: [centerLat, centerLng],
          zoom: 14,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(state.map);

        const marker = L.marker([centerLat, centerLng], {
          draggable: true,
        }).addTo(state.map);

        marker.on("dragend", () => {
          const ll = marker.getLatLng();
          setInternal({ lat: ll.lat, lng: ll.lng });
        });

        state.map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
          marker.setLatLng(e.latlng);
          setInternal({ lat: e.latlng.lat, lng: e.latlng.lng });
        });

        state.map.whenReady(() => {
          state.map?.invalidateSize();
          if (!state.cancelled) setMapReady(true);
        });
      } catch {
        if (!state.cancelled) setMapReady(true);
      }
    })();

    const onResize = () => {
      state.map?.invalidateSize();
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      state.cancelled = true;
      state.map?.remove();
      state.map = null;
      el.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- المركز عند فتح الطبقة فقط
  }, [open, mapEngine]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      panelRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open) return null;

  const instructionsId = "delivery-map-instructions";
  const coordsValid = isValidLatLng(internal);

  const dialog = (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
      style={{ zIndex: OVERLAY_BACKDROP_Z }}
      role="presentation"
      onClick={handleClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delivery-map-title"
        aria-describedby={instructionsId}
        className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-outline-variant/20 bg-white shadow-[0_24px_80px_-24px_rgba(0,0,0,0.35)] outline-none ring-0 focus-visible:ring-2 focus-visible:ring-[#003749]/30"
        style={{ zIndex: OVERLAY_PANEL_Z }}
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/25 bg-gradient-to-l from-[#f8faf9] to-white px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <h2 id="delivery-map-title" className="text-lg font-extrabold tracking-tight text-[#003749]">
              موقع التوصيل
            </h2>
            <p className="mt-0.5 truncate text-[11px] font-semibold text-on-surface-variant">
              {formatCoord6(internal.lat)}، {formatCoord6(internal.lng)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasGoogleKey ? (
              <div
                className="flex rounded-xl border border-outline-variant/35 bg-white/80 p-0.5 text-[11px] font-bold shadow-sm"
                role="group"
                aria-label="نوع الخريطة"
              >
                <button
                  type="button"
                  onClick={() => setMapEngine("google")}
                  className={`rounded-lg px-2.5 py-1.5 transition ${
                    mapEngine === "google"
                      ? "bg-[#003749] text-white shadow-sm"
                      : "text-on-surface-variant hover:bg-surface-container-low"
                  }`}
                >
                  Google
                </button>
                <button
                  type="button"
                  onClick={() => setMapEngine("osm")}
                  className={`rounded-lg px-2.5 py-1.5 transition ${
                    mapEngine === "osm"
                      ? "bg-[#003749] text-white shadow-sm"
                      : "text-on-surface-variant hover:bg-surface-container-low"
                  }`}
                >
                  OpenStreetMap
                </button>
              </div>
            ) : (
              <span className="rounded-lg bg-surface-container-low px-2 py-1 text-[10px] font-bold text-on-surface-variant ring-1 ring-outline-variant/20">
                خريطة مجانية (OSM)
              </span>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-transparent px-3 py-2 text-sm font-bold text-on-surface-variant transition hover:border-outline-variant/30 hover:bg-surface-container-low"
              aria-label="إغلاق نافذة الخريطة"
            >
              إغلاق
            </button>
          </div>
        </div>

        <p
          id={instructionsId}
          className="border-b border-outline-variant/15 bg-surface-container-low/30 px-4 py-2.5 text-xs leading-relaxed text-on-surface-variant sm:px-5"
        >
          انقر على الخريطة أو اسحب الدبوس لتحديد عنوان التوصيل. يمكنك أيضاً ضبط الإحداثيات يدوياً أدناه ثم الضغط على
          «تأكيد الموقع».
        </p>

        <div className="relative shrink-0">
          <div
            key={mapEngine}
            ref={mapElRef}
            className="z-0 h-[min(52vh,400px)] w-full bg-surface-container sm:h-[min(55vh,420px)] [&_.leaflet-container]:z-0 [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full"
            aria-hidden={!mapReady}
          />
          {!mapReady ? (
            <div
              className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2 bg-white/85 text-on-surface-variant"
              aria-live="polite"
              aria-busy="true"
            >
              <span
                className="h-9 w-9 animate-spin rounded-full border-2 border-[#003749]/20 border-t-[#003749]"
                aria-hidden
              />
              <span className="text-sm font-bold text-[#003749]">جاري تحميل الخريطة…</span>
            </div>
          ) : null}
        </div>

        <ManualLatLng
          value={internal}
          onChange={setInternal}
          onConfirm={() => onConfirm(internal.lat, internal.lng)}
          coordsValid={coordsValid}
          compact
        />
      </div>
    </div>
  );

  if (typeof document === "undefined") return dialog;
  return createPortal(dialog, document.body);
}

function ManualLatLng({
  value,
  onChange,
  onConfirm,
  coordsValid,
  compact,
}: {
  value: LatLng;
  onChange: (v: LatLng) => void;
  onConfirm: () => void;
  coordsValid: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={`grid gap-3 ${compact ? "border-t border-outline-variant/25 bg-surface-container-low/20 p-4 sm:grid-cols-2" : ""}`}
    >
      <label className="flex flex-col gap-1.5 text-sm font-bold text-on-surface">
        خط العرض (lat)
        <input
          type="number"
          step="any"
          inputMode="decimal"
          value={Number.isFinite(value.lat) ? value.lat : ""}
          onChange={(e) => onChange({ ...value, lat: Number(e.target.value) })}
          className="rounded-xl border border-outline-variant/40 bg-white px-3 py-2.5 text-start font-mono text-sm shadow-inner outline-none ring-primary/0 transition focus:border-[#003749]/40 focus:ring-2 focus:ring-[#003749]/25"
          dir="ltr"
          aria-invalid={!coordsValid}
          aria-describedby="delivery-map-coord-hint"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-bold text-on-surface">
        خط الطول (lng)
        <input
          type="number"
          step="any"
          inputMode="decimal"
          value={Number.isFinite(value.lng) ? value.lng : ""}
          onChange={(e) => onChange({ ...value, lng: Number(e.target.value) })}
          className="rounded-xl border border-outline-variant/40 bg-white px-3 py-2.5 text-start font-mono text-sm shadow-inner outline-none ring-primary/0 transition focus:border-[#003749]/40 focus:ring-2 focus:ring-[#003749]/25"
          dir="ltr"
          aria-invalid={!coordsValid}
          aria-describedby="delivery-map-coord-hint"
        />
      </label>
      <p
        id="delivery-map-coord-hint"
        className={`text-xs font-medium sm:col-span-2 ${coordsValid ? "text-on-surface-variant" : "text-red-700"}`}
      >
        {coordsValid
          ? "خط العرض بين −90 و 90، وخط الطول بين −180 و 180."
          : "الإحداثيات غير صالحة — راجع القيم قبل التأكيد."}
      </p>
      <div className={compact ? "sm:col-span-2" : ""}>
        <button
          type="button"
          disabled={!coordsValid}
          onClick={onConfirm}
          className="w-full rounded-xl bg-[#163332] py-3.5 text-sm font-extrabold text-white shadow-[0_8px_24px_-8px_rgba(22,51,50,0.45)] transition enabled:hover:bg-[#1a4543] enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-outline-variant/40 disabled:text-on-surface-variant disabled:shadow-none"
        >
          تأكيد الموقع
        </button>
      </div>
    </div>
  );
}
