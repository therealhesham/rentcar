"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";

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

export function DeliveryMapDialog({ open, onClose, initial, onConfirm }: Props) {
  const mapElRef = useRef<HTMLDivElement>(null);
  const [internal, setInternal] = useState<LatLng>(initial ?? SA_CENTER);

  const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
  const hasGoogleKey = Boolean(googleApiKey);

  const [mapEngine, setMapEngine] = useState<MapEngine>(() =>
    hasGoogleKey ? "google" : "osm",
  );

  useEffect(() => {
    if (open && initial) {
      setInternal(initial);
    }
    if (open && !initial) {
      setInternal(SA_CENTER);
    }
  }, [open, initial]);

  /** Google Maps */
  useEffect(() => {
    if (!open || !mapElRef.current || mapEngine !== "google" || !hasGoogleKey) return;

    let cancelled = false;
    const el = mapElRef.current;
    const centerLat = internal.lat;
    const centerLng = internal.lng;

    (async () => {
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
      });
    })();

    return () => {
      state.cancelled = true;
      state.map?.remove();
      state.map = null;
      el.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- المركز عند فتح الطبقة فقط
  }, [open, mapEngine]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delivery-map-title"
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        dir="rtl"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/30 px-4 py-3">
          <h2 id="delivery-map-title" className="text-lg font-extrabold text-[#003749]">
            موقع التوصيل
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {hasGoogleKey ? (
              <div className="flex rounded-lg border border-outline-variant/40 p-0.5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setMapEngine("google")}
                  className={`rounded-md px-2 py-1 transition ${
                    mapEngine === "google"
                      ? "bg-[#f97316] text-white"
                      : "text-on-surface-variant hover:bg-surface-container"
                  }`}
                >
                  Google
                </button>
                <button
                  type="button"
                  onClick={() => setMapEngine("osm")}
                  className={`rounded-md px-2 py-1 transition ${
                    mapEngine === "osm"
                      ? "bg-[#f97316] text-white"
                      : "text-on-surface-variant hover:bg-surface-container"
                  }`}
                >
                  OpenStreetMap (مجاني)
                </button>
              </div>
            ) : (
              <span className="text-[11px] font-semibold text-on-surface-variant">
                {/* خريطة OpenStreetMap — بدون مفتاح API */}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm font-bold text-on-surface-variant hover:bg-surface-container"
            >
              إغلاق
            </button>
          </div>
        </div>

        <p className="border-b border-outline-variant/20 px-4 py-2 text-[11px] text-on-surface-variant">
          انقر على الخريطة أو اسحب الدبوس لتحديد عنوان التوصيل. يمكنك أيضاً ضبط الإحداثيات يدوياً أدناه.
        </p>

        <div
          key={mapEngine}
          ref={mapElRef}
          className="z-0 h-[min(55vh,420px)] w-full shrink-0 bg-surface-container [&_.leaflet-container]:z-0 [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full"
        />

        <ManualLatLng
          value={internal}
          onChange={setInternal}
          onConfirm={() => onConfirm(internal.lat, internal.lng)}
          compact
        />
      </div>
    </div>
  );
}

function ManualLatLng({
  value,
  onChange,
  onConfirm,
  compact,
}: {
  value: LatLng;
  onChange: (v: LatLng) => void;
  onConfirm: () => void;
  compact?: boolean;
}) {
  return (
    <div className={`grid gap-3 ${compact ? "border-t border-outline-variant/30 p-4 sm:grid-cols-2" : ""}`}>
      <label className="flex flex-col gap-1 text-sm font-medium">
        خط العرض (lat)
        <input
          type="number"
          step="any"
          value={Number.isFinite(value.lat) ? value.lat : ""}
          onChange={(e) =>
            onChange({ ...value, lat: Number(e.target.value) })
          }
          className="rounded-lg border border-outline-variant px-3 py-2 text-start font-mono text-sm"
          dir="ltr"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        خط الطول (lng)
        <input
          type="number"
          step="any"
          value={Number.isFinite(value.lng) ? value.lng : ""}
          onChange={(e) =>
            onChange({ ...value, lng: Number(e.target.value) })
          }
          className="rounded-lg border border-outline-variant px-3 py-2 text-start font-mono text-sm"
          dir="ltr"
        />
      </label>
      <div className={compact ? "sm:col-span-2" : ""}>
        <button
          type="button"
          onClick={onConfirm}
          className="w-full rounded-xl bg-[#f97316] py-3 text-sm font-extrabold text-white hover:bg-[#ea580c]"
        >
          تأكيد الموقع
        </button>
      </div>
    </div>
  );
}
