"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { GeoCluster } from "@/lib/geo-ip";

/** ألوان الهوية — نفس تدرّج الموقع العام. */
const TEAL = "#003749";
const GOLD = "#dbb878";

/**
 * نصف قطر النقطة بجذر عدد الجلسات لا بالعدد نفسه: العين تقارن **مساحة** الدائرة،
 * فالتناسب الخطي مع نصف القطر يضخّم المدن الكبيرة بصورة مضلِّلة.
 */
function radiusFor(sessions: number, max: number): number {
  const ratio = Math.sqrt(sessions) / Math.sqrt(Math.max(1, max));
  return 9 + ratio * 19;
}

function markerHtml(cluster: GeoCluster, radius: number): string {
  // اللون يحمل معنى: ذهبي = وصل صفحة الحجز من هذه المدينة، رمادي‑أزرق = تصفّح فقط.
  const converted = cluster.reachedCheckout > 0;
  const color = converted ? GOLD : TEAL;
  const size = radius * 2;
  return `
    <div style="position:relative;width:${size}px;height:${size}px;">
      <div style="
        position:absolute;inset:0;border-radius:9999px;
        background:${color};opacity:.16;
        animation:visitor-pulse 2.8s ease-out infinite;
      "></div>
      <div style="
        position:absolute;inset:${radius * 0.28}px;border-radius:9999px;
        background:${color};opacity:.9;
        border:2px solid rgba(255,255,255,.9);
        box-shadow:0 2px 10px -2px ${color}cc;
      "></div>
    </div>`;
}

export function VisitorMap({ clusters }: { clusters: GeoCluster[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || clusters.length === 0) return;

    const state = { map: null as import("leaflet").Map | null, cancelled: false };

    void (async () => {
      const L = (await import("leaflet")).default;
      if (state.cancelled || !containerRef.current) return;

      const map = L.map(el, {
        zoomControl: true,
        // عجلة الفأرة معطّلة ابتداءً حتى لا تبتلع تمرير الصفحة أثناء المرور فوق الخريطة.
        scrollWheelZoom: false,
        attributionControl: true,
      });
      state.map = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; OpenStreetMap &copy; CARTO — تحديد المواقع: MaxMind GeoLite2',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      const maxSessions = Math.max(...clusters.map((c) => c.sessions));
      const points: Array<[number, number]> = [];

      for (const cluster of clusters) {
        const radius = radiusFor(cluster.sessions, maxSessions);
        const marker = L.marker([cluster.lat, cluster.lng], {
          icon: L.divIcon({
            html: markerHtml(cluster, radius),
            className: "visitor-map-marker",
            iconSize: [radius * 2, radius * 2],
            iconAnchor: [radius, radius],
          }),
          title: `${cluster.label} — ${cluster.sessions} جلسة`,
        });

        const rate = Math.round((cluster.reachedCheckout / cluster.sessions) * 100);
        marker.bindPopup(
          `<div style="font-family:inherit;min-width:150px;text-align:right;" dir="rtl">
             <div style="font-weight:800;color:${TEAL};font-size:14px;">${cluster.label}</div>
             ${cluster.country ? `<div style="color:#8a7752;font-size:11px;margin-top:1px;">${cluster.country}</div>` : ""}
             <div style="margin-top:7px;font-size:12px;color:#3f4b52;">
               <div>الجلسات: <b style="font-variant-numeric:tabular-nums;">${cluster.sessions}</b></div>
               <div style="margin-top:2px;">وصلوا صفحة الحجز: <b style="font-variant-numeric:tabular-nums;">${cluster.reachedCheckout}</b> <span style="color:#8a7752;">(${rate}%)</span></div>
             </div>
           </div>`,
          { closeButton: false, className: "visitor-map-popup" },
        );

        marker.addTo(map);
        points.push([cluster.lat, cluster.lng]);
      }

      map.fitBounds(L.latLngBounds(points).pad(0.25), { maxZoom: 9, animate: false });

      // عجلة الفأرة تُفعَّل بنقرة صريحة على الخريطة وتُعطَّل عند مغادرتها.
      map.on("click", () => map.scrollWheelZoom.enable());
      map.on("mouseout", () => map.scrollWheelZoom.disable());
    })();

    return () => {
      state.cancelled = true;
      state.map?.remove();
      state.map = null;
    };
  }, [clusters]);

  if (clusters.length === 0) {
    return (
      <p className="mt-4 text-sm text-on-surface-variant">
        لا توجد عناوين يمكن تحديد مواقعها في هذه الفترة.
      </p>
    );
  }

  return (
    <>
      <style>{`
        @keyframes visitor-pulse {
          0%   { transform: scale(.65); opacity: .30; }
          70%  { transform: scale(1.25); opacity: 0; }
          100% { transform: scale(1.25); opacity: 0; }
        }
        .visitor-map-marker { background: transparent; border: 0; }
        .visitor-map-popup .leaflet-popup-content-wrapper {
          border-radius: 14px;
          box-shadow: 0 12px 32px -12px rgba(15,61,71,.35);
        }
        .visitor-map-popup .leaflet-popup-content { margin: 12px 14px; }
        .visitor-map-canvas .leaflet-control-attribution {
          font-size: 10px; background: rgba(255,255,255,.82);
        }
        .visitor-map-canvas .leaflet-bar a {
          border-radius: 8px; color: ${TEAL}; font-weight: 700;
        }
      `}</style>
      <div
        ref={containerRef}
        className="visitor-map-canvas mt-4 h-[420px] w-full overflow-hidden rounded-2xl border border-outline-variant/25"
        style={{ background: "#f4f6f7" }}
      />
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-on-surface-variant">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: GOLD }} />
          وصلوا صفحة الحجز
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: TEAL }} />
          تصفّح فقط
        </span>
        <span>حجم النقطة يتناسب مع عدد الجلسات</span>
      </div>
    </>
  );
}
