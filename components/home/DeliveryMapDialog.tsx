"use client";

import "leaflet/dist/leaflet.css";
import { ChevronDown, LocateFixed, MapPin, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DELIVERY_ADDRESS_MAX_CHARS } from "@/lib/delivery-address";
import { createGeocoding, type GeoPlace } from "@/lib/geocoding";
import { OVERLAY_BACKDROP_Z, OVERLAY_PANEL_Z } from "@/lib/overlay-z-index";

type LatLng = { lat: number; lng: number };

const SA_CENTER: LatLng = { lat: 24.7136, lng: 46.6753 };

/** تقريب افتراضي: نقطة محدّدة مسبقاً ← شارع، مركز مدينة ← حي، بلا مرجع ← الدولة. */
const ZOOM_PINNED = 16;
const ZOOM_CITY = 12;
const ZOOM_COUNTRY = 6;

const SEARCH_DEBOUNCE_MS = 450;
const REVERSE_DEBOUNCE_MS = 700;

type MapEngine = "google" | "osm";

type Props = {
  open: boolean;
  onClose: () => void;
  initial: LatLng | null;
  /** مركز بديل عند غياب `initial` — مثلاً مركز مدينة الفرع المختار. */
  fallbackCenter?: LatLng | null;
  /** إظهار حقل تفاصيل العنوان (وضع توصيل العميل، وليس تحديد موقع فرع). */
  addressField?: boolean;
  initialAddress?: string;
  onConfirm: (lat: number, lng: number, address: string) => void;
};

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

export function DeliveryMapDialog({
  open,
  onClose,
  initial,
  fallbackCenter = null,
  addressField = false,
  initialAddress = "",
  onConfirm,
}: Props) {
  const mapElRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /** تحريك الخريطة برمجياً (بحث / تحديد موقعي / إدخال يدوي). */
  const panToRef = useRef<((p: LatLng, zoom?: number) => void) | null>(null);
  const googleGeocoderRef = useRef<google.maps.Geocoder | null>(null);
  /** آخر عنوان عبّأناه تلقائياً — لا نكتب فوق ما كتبه العميل بنفسه. */
  const autoAddressRef = useRef("");

  const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
  const [mapEngine, setMapEngine] = useState<MapEngine>(
    googleApiKey ? "google" : "osm",
  );

  /** مركز البدء — قيم أوّلية ثابتة تمنع إعادة بناء الخريطة عند تحريك الدبوس. */
  const initLat = initial?.lat ?? fallbackCenter?.lat ?? SA_CENTER.lat;
  const initLng = initial?.lng ?? fallbackCenter?.lng ?? SA_CENTER.lng;
  const initZoom = initial ? ZOOM_PINNED : fallbackCenter ? ZOOM_CITY : ZOOM_COUNTRY;
  const hasInitialPin = initial != null;

  const [internal, setInternal] = useState<LatLng>({ lat: initLat, lng: initLng });
  const [mapReady, setMapReady] = useState(false);
  const [moving, setMoving] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);

  const [address, setAddress] = useState(initialAddress);
  const [addressLoading, setAddressLoading] = useState(false);

  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState("");

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  /** تحريك الخريطة + مزامنة الحالة. المصدر الوحيد للحركة البرمجية. */
  const panTo = useCallback((p: LatLng, zoom?: number) => {
    setInternal(p);
    panToRef.current?.(p, zoom);
  }, []);

  /* ── إعادة الضبط عند كل فتح ── */
  useEffect(() => {
    if (!open) return;
    setInternal({ lat: initLat, lng: initLng });
    setQuery("");
    setResults([]);
    setResultsOpen(false);
    setNotice("");
    autoAddressRef.current = "";
  }, [open, initLat, initLng]);

  useEffect(() => {
    if (!open) return;
    setAddress(initialAddress);
  }, [open, initialAddress]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (resultsOpen) {
        setResultsOpen(false);
        return;
      }
      handleClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, handleClose, resultsOpen]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) setMapReady(false);
  }, [open]);

  /* ── Google Maps ── */
  useEffect(() => {
    if (!open || !mapElRef.current || mapEngine !== "google" || !googleApiKey) return;

    let cancelled = false;
    let interactive = false;
    let watchdog = 0;
    const el = mapElRef.current;
    setMapReady(false);

    /** جوجل يستدعي هذا عند فشل المصادقة بمفتاح خاطئ. */
    const w = window as unknown as { gm_authFailure?: () => void };
    w.gm_authFailure = () => setMapEngine("osm");

    void (async () => {
      try {
        const { setOptions, importLibrary } = await import("@googlemaps/js-api-loader");
        setOptions({ key: googleApiKey, v: "weekly", language: "ar", region: "SA" });
        const { Map } = await importLibrary("maps");
        const { Geocoder } = await importLibrary("geocoding");
        if (cancelled || !el.isConnected) return;

        const map = new Map(el, {
          center: { lat: initLat, lng: initLng },
          zoom: initZoom,
          streetViewControl: false,
          mapTypeControl: true,
          fullscreenControl: false,
          clickableIcons: false,
          // تمرير بإصبع واحد على الجوال بدل إصبعين
          gestureHandling: "greedy",
        });

        googleGeocoderRef.current = new Geocoder();

        panToRef.current = (p, zoom) => {
          map.setCenter(p);
          if (zoom != null) map.setZoom(zoom);
        };

        map.addListener("dragstart", () => setMoving(true));
        map.addListener("idle", () => {
          interactive = true;
          setMoving(false);
          setMapReady(true);
          const c = map.getCenter();
          if (c) setInternal({ lat: c.lat(), lng: c.lng() });
        });
        // نقرة على الخريطة تُركّز النقطة تحت الإصبع
        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (e.latLng) map.panTo(e.latLng);
        });

        /**
         * عند تعطّل الفوترة لا يرمي جوجل خطأ ولا ينادي gm_authFailure — بل يرسم
         * صورة ثابتة (StaticMapService) بلا `.gm-style` و`idle` لا يقع أبداً.
         * فننتظر إشارة التفاعل، وإن لم تأتِ ننزل للخريطة المجانية.
         */
        watchdog = window.setTimeout(() => {
          if (cancelled) return;
          const staticFallback = el.querySelector('img[src*="StaticMapService"]');
          if (!interactive || !el.querySelector(".gm-style") || staticFallback) {
            setMapEngine("osm");
          }
        }, 3000);
      } catch {
        // مفتاح غير صالح أو تحميل فاشل — ننزل إلى الخريطة المجانية بدل شاشة فارغة
        if (!cancelled) setMapEngine("osm");
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(watchdog);
      panToRef.current = null;
      googleGeocoderRef.current = null;
      delete w.gm_authFailure;
      el.innerHTML = "";
    };
  }, [open, mapEngine, googleApiKey, initLat, initLng, initZoom]);

  /* ── Leaflet + OpenStreetMap (مجاني، بلا مفتاح) ── */
  useEffect(() => {
    if (!open || !mapElRef.current || mapEngine !== "osm") return;

    const el = mapElRef.current;
    const state = { map: null as import("leaflet").Map | null, cancelled: false };
    setMapReady(false);

    void (async () => {
      try {
        const L = (await import("leaflet")).default;
        if (state.cancelled || !el.isConnected) return;

        const map = L.map(el, {
          center: [initLat, initLng],
          zoom: initZoom,
          zoomControl: true,
          attributionControl: true,
        });
        state.map = map;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        panToRef.current = (p, zoom) => {
          map.setView([p.lat, p.lng], zoom ?? map.getZoom());
        };

        map.on("movestart", () => setMoving(true));
        map.on("moveend", () => {
          setMoving(false);
          const c = map.getCenter();
          setInternal({ lat: c.lat, lng: c.lng });
        });
        map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
          map.panTo(e.latlng);
        });

        map.whenReady(() => {
          map.invalidateSize();
          if (!state.cancelled) setMapReady(true);
        });
      } catch {
        if (!state.cancelled) setMapReady(true);
      }
    })();

    const onResize = () => state.map?.invalidateSize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      state.cancelled = true;
      panToRef.current = null;
      state.map?.remove();
      state.map = null;
      el.innerHTML = "";
    };
  }, [open, mapEngine, initLat, initLng, initZoom]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => panelRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  const geocoding = useMemo(
    () => createGeocoding({ googleGeocoder: googleGeocoderRef.current, lang: "ar" }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- الـ geocoder يُملأ بعد تحميل الخريطة؛ mapReady هو إشارة الجاهزية
    [mapReady],
  );

  /* ── البحث عن عنوان (debounced) ── */
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    setSearching(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const hits = await geocoding.search(q, controller.signal);
          if (controller.signal.aborted) return;
          setResults(hits);
          setResultsOpen(true);
        } catch {
          if (!controller.signal.aborted) setResults([]);
        } finally {
          if (!controller.signal.aborted) setSearching(false);
        }
      })();
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, open, geocoding]);

  /* ── تعبئة العنوان تلقائياً من موضع الدبوس (debounced) ── */
  useEffect(() => {
    if (!open || !addressField || moving || !isValidLatLng(internal)) return;

    const controller = new AbortController();
    setAddressLoading(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const label = await geocoding.reverse(
            internal.lat,
            internal.lng,
            controller.signal,
          );
          if (controller.signal.aborted || !label) return;
          const prevAuto = autoAddressRef.current;
          autoAddressRef.current = label;
          // نحترم ما كتبه العميل: نستبدل الفارغ أو الاقتراح السابق فقط
          setAddress((cur) => (cur.trim() === "" || cur === prevAuto ? label : cur));
        } catch {
          /* تجاهُل — العنوان اليدوي يبقى متاحاً */
        } finally {
          if (!controller.signal.aborted) setAddressLoading(false);
        }
      })();
    }, REVERSE_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
      setAddressLoading(false);
    };
  }, [open, addressField, moving, internal, geocoding]);

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setNotice("المتصفح لا يدعم تحديد الموقع.");
      return;
    }
    setLocating(true);
    setNotice("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude }, ZOOM_PINNED);
      },
      (err) => {
        setLocating(false);
        setNotice(
          err.code === err.PERMISSION_DENIED
            ? "تم رفض إذن الموقع — فعّله من إعدادات المتصفح أو حدّد الموقع يدوياً."
            : "تعذّر تحديد موقعك الحالي. حرّك الخريطة يدوياً.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, [panTo]);

  if (!open) return null;

  const instructionsId = "delivery-map-instructions";
  const coordsValid = isValidLatLng(internal);

  const dialog = (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/55 p-0 backdrop-blur-[2px] sm:p-4"
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
        className="flex h-full max-h-full w-full flex-col overflow-hidden border-outline-variant/20 bg-white shadow-[0_24px_80px_-24px_rgba(0,0,0,0.35)] outline-none ring-0 focus-visible:ring-2 focus-visible:ring-[#003749]/30 sm:h-auto sm:max-h-[92dvh] sm:max-w-2xl sm:rounded-2xl sm:border"
        style={{ zIndex: OVERLAY_PANEL_Z }}
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── الرأس ── */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-outline-variant/25 bg-gradient-to-l from-[#f8faf9] to-white px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <h2
              id="delivery-map-title"
              className="text-lg font-extrabold tracking-tight text-[#003749]"
            >
              موقع التوصيل
            </h2>
            <p
              id={instructionsId}
              className="mt-0.5 text-[11px] font-semibold text-on-surface-variant"
            >
              ابحث عن عنوانك أو حرّك الخريطة حتى يستقر الدبوس على المكان.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-transparent text-on-surface-variant transition hover:border-outline-variant/30 hover:bg-surface-container-low"
            aria-label="إغلاق نافذة الخريطة"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        {/* ── البحث ── */}
        <div className="relative z-20 shrink-0 border-b border-outline-variant/15 px-4 py-3 sm:px-5">
          <div className="relative">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                if (results.length > 0) setResultsOpen(true);
              }}
              placeholder="ابحث عن حي أو شارع أو معلَم…"
              aria-label="البحث عن عنوان"
              autoComplete="off"
              className="w-full rounded-xl border border-outline-variant/40 bg-white py-2.5 pe-10 ps-9 text-sm font-semibold shadow-inner outline-none transition focus:border-[#003749]/40 focus:ring-2 focus:ring-[#003749]/25"
            />
            {searching ? (
              <span
                className="absolute end-3 top-1/2 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-[#003749]/20 border-t-[#003749]"
                aria-label="جاري البحث"
              />
            ) : null}
          </div>

          {resultsOpen && results.length > 0 ? (
            <ul
              role="listbox"
              aria-label="نتائج البحث"
              className="absolute inset-x-4 top-full z-30 max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-outline-variant/30 bg-white py-1 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.35)] sm:inset-x-5"
            >
              {results.map((p) => (
                <li key={`${p.lat},${p.lng},${p.label}`}>
                  <button
                    type="button"
                    onClick={() => {
                      panTo({ lat: p.lat, lng: p.lng }, ZOOM_PINNED);
                      setResultsOpen(false);
                      setQuery("");
                    }}
                    className="flex w-full items-start gap-2 px-3 py-2.5 text-start text-[13px] font-semibold leading-snug text-on-surface transition hover:bg-surface-container-low"
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-[#dbb878]" aria-hidden />
                    <span className="min-w-0">{p.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          {/* ── الخريطة + الدبوس الثابت في المنتصف ── */}
          <div className="relative shrink-0">
            <div
              ref={mapElRef}
              className="z-0 h-[38vh] min-h-[240px] w-full bg-surface-container sm:h-[min(52vh,400px)] [&_.leaflet-container]:z-0 [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full"
            />

            {/* الدبوس: ثابت في مركز الخريطة، طرفه السفلي على نقطة التحديد */}
            {mapReady ? (
              <div
                className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center"
                aria-hidden
              >
                <div
                  className={`-translate-y-[18px] transition-transform duration-200 ${
                    moving ? "-translate-y-[26px] scale-110" : ""
                  }`}
                >
                  <MapPin
                    className="size-9 fill-[#dbb878] text-[#003749] drop-shadow-[0_4px_6px_rgba(0,0,0,0.35)]"
                    strokeWidth={1.5}
                  />
                </div>
                <span
                  className={`absolute size-2 rounded-full bg-[#003749]/35 transition-transform duration-200 ${
                    moving ? "scale-75" : ""
                  }`}
                />
              </div>
            ) : null}

            {/* زر «موقعي الحالي» */}
            {mapReady ? (
              <button
                type="button"
                onClick={handleLocateMe}
                disabled={locating}
                className="absolute bottom-3 start-3 z-[3] inline-flex items-center gap-2 rounded-full bg-white/95 px-3.5 py-2 text-[12px] font-extrabold text-[#003749] shadow-[0_6px_20px_-6px_rgba(0,0,0,0.4)] ring-1 ring-outline-variant/25 transition enabled:hover:bg-white enabled:active:scale-[0.97] disabled:opacity-60"
              >
                {locating ? (
                  <span
                    className="size-4 animate-spin rounded-full border-2 border-[#003749]/20 border-t-[#003749]"
                    aria-hidden
                  />
                ) : (
                  <LocateFixed className="size-4" aria-hidden />
                )}
                موقعي الحالي
              </button>
            ) : null}

            {!mapReady ? (
              <div
                className="absolute inset-0 z-[4] flex flex-col items-center justify-center gap-2 bg-white/85 text-on-surface-variant"
                aria-live="polite"
                aria-busy="true"
              >
                <span
                  className="size-9 animate-spin rounded-full border-2 border-[#003749]/20 border-t-[#003749]"
                  aria-hidden
                />
                <span className="text-sm font-bold text-[#003749]">جاري تحميل الخريطة…</span>
              </div>
            ) : null}
          </div>

          {notice ? (
            <p
              role="status"
              className="border-b border-amber-200/60 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900 sm:px-5"
            >
              {notice}
            </p>
          ) : null}

          {/* ── تفاصيل العنوان ── */}
          {addressField ? (
            <div className="border-t border-outline-variant/20 px-4 py-3.5 sm:px-5">
              <label
                htmlFor="delivery-address-text"
                className="mb-1.5 flex items-center gap-2 text-[13px] font-extrabold text-[#003749]"
              >
                تفاصيل العنوان
                {addressLoading ? (
                  <span className="text-[10px] font-bold text-on-surface-variant">
                    جاري جلب العنوان…
                  </span>
                ) : null}
              </label>
              <textarea
                id="delivery-address-text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                maxLength={DELIVERY_ADDRESS_MAX_CHARS}
                placeholder="رقم المبنى، الدور، الشقة، أقرب علامة مميزة…"
                className="w-full resize-y rounded-xl border border-outline-variant/40 bg-white px-3 py-2.5 text-sm leading-relaxed shadow-inner outline-none transition focus:border-[#003749]/40 focus:ring-2 focus:ring-[#003749]/25"
              />
              <p className="mt-1 text-[11px] font-medium text-on-surface-variant">
                يساعد المندوب على الوصول لبابك بالضبط — نملؤه تلقائياً ويمكنك تعديله.
              </p>
            </div>
          ) : null}

          {/* ── الإحداثيات: لأدوات الإدارة فقط — العميل لا يحتاج أرقاماً ── */}
          {!addressField ? (
            <details className="group border-t border-outline-variant/20 px-4 py-2.5 sm:px-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[12px] font-bold text-on-surface-variant transition hover:text-[#003749]">
                <span>
                  الإحداثيات: {formatCoord6(internal.lat)}، {formatCoord6(internal.lng)}
                </span>
                <ChevronDown
                  className="size-4 shrink-0 transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <ManualLatLng value={internal} onChange={panTo} coordsValid={coordsValid} />
            </details>
          ) : null}
        </div>

        {/* ── التأكيد ── */}
        <div className="shrink-0 border-t border-outline-variant/25 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
          <button
            type="button"
            disabled={!coordsValid || !mapReady}
            onClick={() => onConfirm(internal.lat, internal.lng, address.trim())}
            className="w-full rounded-xl bg-[#163332] py-3.5 text-sm font-extrabold text-white shadow-[0_8px_24px_-8px_rgba(22,51,50,0.45)] transition enabled:hover:bg-[#1a4543] enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-outline-variant/40 disabled:text-on-surface-variant disabled:shadow-none"
          >
            {hasInitialPin ? "تحديث الموقع" : "تأكيد الموقع"}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return dialog;
  return createPortal(dialog, document.body);
}

function ManualLatLng({
  value,
  onChange,
  coordsValid,
}: {
  value: LatLng;
  onChange: (v: LatLng) => void;
  coordsValid: boolean;
}) {
  return (
    <div className="grid gap-3 pb-3 pt-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 text-xs font-bold text-on-surface">
        خط العرض (lat)
        <input
          type="number"
          step="any"
          inputMode="decimal"
          value={Number.isFinite(value.lat) ? value.lat : ""}
          onChange={(e) => onChange({ ...value, lat: Number(e.target.value) })}
          className="rounded-xl border border-outline-variant/40 bg-white px-3 py-2 text-start font-mono text-sm shadow-inner outline-none transition focus:border-[#003749]/40 focus:ring-2 focus:ring-[#003749]/25"
          dir="ltr"
          aria-invalid={!coordsValid}
          aria-describedby="delivery-map-coord-hint"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-bold text-on-surface">
        خط الطول (lng)
        <input
          type="number"
          step="any"
          inputMode="decimal"
          value={Number.isFinite(value.lng) ? value.lng : ""}
          onChange={(e) => onChange({ ...value, lng: Number(e.target.value) })}
          className="rounded-xl border border-outline-variant/40 bg-white px-3 py-2 text-start font-mono text-sm shadow-inner outline-none transition focus:border-[#003749]/40 focus:ring-2 focus:ring-[#003749]/25"
          dir="ltr"
          aria-invalid={!coordsValid}
          aria-describedby="delivery-map-coord-hint"
        />
      </label>
      <p
        id="delivery-map-coord-hint"
        className={`text-[11px] font-medium sm:col-span-2 ${coordsValid ? "text-on-surface-variant" : "text-red-700"}`}
      >
        {coordsValid
          ? "خط العرض بين −90 و 90، وخط الطول بين −180 و 180."
          : "الإحداثيات غير صالحة — راجع القيم قبل التأكيد."}
      </p>
    </div>
  );
}
