"use client";

import { ExternalLink, Map as MapIcon, MapPin, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DeliveryFeeSnap } from "@/lib/delivery-fee";
import {
  GOOGLE_MAPS_BROWSER_KEY,
  GOOGLE_MAPS_UNAVAILABLE_MESSAGE,
  getGoogleMapsImporter,
} from "@/lib/google-maps-client";

const TEAL = "#003749";
const GOLD = "#dbb878";
const GREEN = "#0f7a3d";

export type DeliveryMapPoint = {
  lat: number;
  lng: number;
  address: string | null;
};

type Props = {
  /** فرع الإرجاع (مرجع الحساب). */
  branch: { name: string; lat: number | null; lng: number | null } | null;
  /** موقع توصيل السيارة للعميل (الاستلام). */
  pickup: DeliveryMapPoint | null;
  /** موقع استلام السيارة من العميل (الإرجاع). */
  ret: DeliveryMapPoint | null;
  /** لقطات الرسوم المجمَّدة وقت الحجز (قد تكون فارغة في الحجوزات القديمة). */
  fees: DeliveryFeeSnap[];
};

type MapMarker = {
  kind: "branch" | "pickup" | "return";
  lat: number;
  lng: number;
  title: string;
  address: string | null;
};

const MARKER_STYLE = {
  branch: { color: TEAL, text: "الفرع" },
  pickup: { color: GOLD, text: "التسليم" },
  return: { color: GREEN, text: "الإرجاع" },
} as const;

function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function sourceLabel(s: DeliveryFeeSnap["source"]): string {
  return s === "GOOGLE_ROUTES" ? "طريق فعلي (جوجل)" : "خط مستقيم";
}

export function DeliveryMapPanel({ branch, pickup, ret, fees }: Props) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(!GOOGLE_MAPS_BROWSER_KEY);
  const containerRef = useRef<HTMLDivElement>(null);

  const markers: MapMarker[] = [];
  if (branch && branch.lat != null && branch.lng != null) {
    markers.push({
      kind: "branch",
      lat: branch.lat,
      lng: branch.lng,
      title: `فرع ${branch.name}`,
      address: null,
    });
  }
  if (pickup) {
    markers.push({
      kind: "pickup",
      lat: pickup.lat,
      lng: pickup.lng,
      title: "موقع تسليم السيارة للعميل",
      address: pickup.address,
    });
  }
  if (ret) {
    markers.push({
      kind: "return",
      lat: ret.lat,
      lng: ret.lng,
      title: "موقع استلام السيارة من العميل",
      address: ret.address,
    });
  }
  const markersKey = markers.map((m) => `${m.kind}:${m.lat},${m.lng}`).join("|");

  useEffect(() => {
    const el = containerRef.current;
    if (!open || failed || !el || markers.length === 0) return;

    const state = { cancelled: false, cleanup: [] as Array<() => void> };
    const w = window as unknown as { gm_authFailure?: () => void };
    w.gm_authFailure = () => setFailed(true);

    void (async () => {
      try {
        const importLibrary = await getGoogleMapsImporter();
        const { Map, InfoWindow, Polyline } = await importLibrary("maps");
        const { Marker } = await importLibrary("marker");
        if (state.cancelled || !containerRef.current) return;

        const map = new Map(el, {
          center: { lat: markers[0].lat, lng: markers[0].lng },
          zoom: 14,
          streetViewControl: false,
          fullscreenControl: true,
          mapTypeControl: true,
          clickableIcons: false,
          gestureHandling: "cooperative",
        });
        const info = new InfoWindow();
        const branchMarker = markers.find((m) => m.kind === "branch");
        const bounds = new google.maps.LatLngBounds();

        for (const m of markers) {
          const style = MARKER_STYLE[m.kind];
          const position = { lat: m.lat, lng: m.lng };
          const marker = new Marker({
            map,
            position,
            title: m.title,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: style.color,
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 3,
              scale: 11,
              labelOrigin: new google.maps.Point(0, -2.4),
            },
            label: { text: style.text, color: style.color, fontWeight: "800", fontSize: "12px" },
          });
          state.cleanup.push(() => marker.setMap(null));

          // النص من بيانات العميل — نبني العقدة بـ textContent لا innerHTML.
          const popup = document.createElement("div");
          popup.dir = "rtl";
          popup.style.textAlign = "right";
          const h = document.createElement("div");
          h.style.fontWeight = "800";
          h.style.color = TEAL;
          h.textContent = m.title;
          popup.appendChild(h);
          if (m.address) {
            const a = document.createElement("div");
            a.style.marginTop = "4px";
            a.style.fontSize = "12px";
            a.textContent = m.address;
            popup.appendChild(a);
          }
          marker.addListener("click", () => {
            info.setContent(popup);
            info.open({ map, anchor: marker });
          });

          bounds.extend(position);

          if (branchMarker && m.kind !== "branch") {
            const line = new Polyline({
              map,
              path: [
                { lat: branchMarker.lat, lng: branchMarker.lng },
                position,
              ],
              strokeOpacity: 0,
              icons: [
                {
                  icon: {
                    path: "M 0,-1 0,1",
                    strokeColor: style.color,
                    strokeOpacity: 0.9,
                    strokeWeight: 3,
                    scale: 2,
                  },
                  offset: "0",
                  repeat: "12px",
                },
              ],
            });
            state.cleanup.push(() => line.setMap(null));
          }
        }

        if (markers.length === 1) {
          map.setCenter({ lat: markers[0].lat, lng: markers[0].lng });
          map.setZoom(15);
        } else {
          map.fitBounds(bounds, 60);
        }

        // الفوترة المعطّلة: جوجل يرسم صورة ثابتة بلا .gm-style ولا يرمي خطأ.
        window.setTimeout(() => {
          if (state.cancelled) return;
          if (!el.querySelector(".gm-style") || el.querySelector('img[src*="StaticMapService"]')) {
            setFailed(true);
          }
        }, 3000);
      } catch {
        if (!state.cancelled) setFailed(true);
      }
    })();

    return () => {
      state.cancelled = true;
      state.cleanup.forEach((fn) => fn());
      delete w.gm_authFailure;
      el.innerHTML = "";
    };
    // markersKey يلخّص المحتوى؛ markers نفسها تُعاد بناؤها كل رندر.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, failed, markersKey]);

  if (markers.filter((m) => m.kind !== "branch").length === 0) return null;

  return (
    <div className="mt-3 space-y-3">
      {fees.length > 0 ? (
        <ul className="space-y-2">
          {fees.map((f) => (
            <li
              key={f.leg}
              className="rounded-xl border border-outline-variant/40 bg-surface-container-low/60 px-4 py-3 text-sm"
            >
              <p className="font-bold text-on-surface">{f.labelAr}</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                المسافة الفعلية {f.distanceKm.toFixed(1)} كم · المحتسبة {f.billedKm.toFixed(1)} كم ×{" "}
                {f.ratePerKmSar} ر.س/كم = <b className="text-on-surface">{f.feeExclVatSar} ر.س</b> قبل
                الضريبة · {sourceLabel(f.source)}
              </p>
              <p className="mt-1 text-[11px] text-on-surface-variant">
                الرسوم مجمَّدة وقت الحجز ولا يُعاد حسابها.
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary hover:opacity-95"
        >
          {open ? <X className="h-4 w-4" aria-hidden /> : <MapIcon className="h-4 w-4" aria-hidden />}
          {open ? "إخفاء الخريطة" : "معاينة على الخريطة"}
        </button>
        {pickup ? (
          <a
            href={googleMapsUrl(pickup.lat, pickup.lng)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-3 py-2.5 text-xs font-bold text-primary hover:bg-surface-container-low"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            موقع التسليم في Google Maps
          </a>
        ) : null}
        {ret ? (
          <a
            href={googleMapsUrl(ret.lat, ret.lng)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-3 py-2.5 text-xs font-bold text-primary hover:bg-surface-container-low"
          >
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            موقع الاستلام عند الإرجاع في Google Maps
          </a>
        ) : null}
      </div>

      {open && failed ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700"
        >
          {GOOGLE_MAPS_UNAVAILABLE_MESSAGE}
        </p>
      ) : null}
      {open && !failed ? (
        <div
          ref={containerRef}
          className="z-0 h-[360px] w-full overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container"
        />
      ) : null}
    </div>
  );
}
