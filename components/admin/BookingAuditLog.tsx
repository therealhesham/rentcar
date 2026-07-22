import { BOOKING_EVENT_LABELS, type BookingEvent } from "@/lib/booking-audit";

export type BookingLogEntry = {
  id: number;
  event: string;
  actorKind: string;
  actorName: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  notes: string | null;
  createdAt: Date;
};

const STATUS_LABELS: Record<string, string> = {
  NEW: "جديد",
  UNDER_REVIEW: "قيد المراجعة",
  CONFIRMED: "مؤكد",
  PICKED_UP: "مستلَم",
  RETURNED: "مُرجَع",
  CANCELLED: "ملغى",
  REJECTED: "مرفوض",
  COMPLETED: "مكتمل",
};

const ACTOR_COLORS: Record<string, string> = {
  ADMIN: "bg-primary text-on-primary",
  CUSTOMER: "bg-secondary text-on-secondary",
  SYSTEM: "bg-surface-container-high text-on-surface-variant",
};

const ACTOR_LABELS: Record<string, string> = {
  ADMIN: "أدمن",
  CUSTOMER: "عميل",
  SYSTEM: "النظام",
};

const EVENT_ICONS: Record<string, string> = {
  BOOKING_CREATED: "✦",
  BOOKING_UPDATED: "✎",
  STATUS_CHANGED: "⇄",
  PAYMENT_RECORDED: "＄",
  BALANCE_PAID: "＄",
  PAYMENT_CONFIRMED: "✔",
  REFUND_PROCESSED: "↩",
  CUSTOMER_DUES_SETTLED: "✔",
  VEHICLE_PICKED_UP: "↑",
  VEHICLE_RETURNED: "↓",
  BOOKING_CANCELLED: "✕",
  CUSTOMER_CANCELLED: "✕",
  CONVERTED_TO_DIRECT: "⇒",
  REVERTED_TO_INQUIRY: "⇐",
  INTER_BRANCH_RETURN: "↔",
};

function statusLabel(s: string | null) {
  if (!s) return null;
  return STATUS_LABELS[s.toUpperCase()] ?? s;
}

export function BookingAuditLog({ logs }: { logs: BookingLogEntry[] }) {
  if (logs.length === 0) {
    return (
      <p className="text-sm text-on-surface-variant">لا توجد أحداث مسجّلة لهذا الحجز.</p>
    );
  }

  return (
    <ol className="relative border-r-2 border-outline-variant/30 pr-5 space-y-5">
      {logs.map((log) => {
        const label =
          BOOKING_EVENT_LABELS[log.event as BookingEvent] ?? log.event;
        const icon = EVENT_ICONS[log.event] ?? "•";
        const actorColor = ACTOR_COLORS[log.actorKind] ?? ACTOR_COLORS.SYSTEM;
        const actorLabel = ACTOR_LABELS[log.actorKind] ?? log.actorKind;

        return (
          <li key={log.id} className="relative">
            {/* نقطة على الخط الزمني */}
            <span className="absolute -right-[1.45rem] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-surface-container text-[10px] font-bold text-on-surface-variant ring-2 ring-surface">
              {icon}
            </span>

            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-4 py-3 text-sm">
              {/* رأس الحدث */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-on-surface">{label}</span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${actorColor}`}
                >
                  {actorLabel}
                </span>
                {log.actorName && (
                  <span className="text-xs text-on-surface-variant">{log.actorName}</span>
                )}
                <span className="mr-auto text-xs text-on-surface-variant/60 tabular-nums">
                  {log.createdAt.toLocaleString("ar-SA", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {/* تغيير الحالة */}
              {(log.fromStatus || log.toStatus) && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-on-surface-variant">
                  {log.fromStatus && (
                    <span className="rounded bg-surface-container px-1.5 py-0.5 font-mono">
                      {statusLabel(log.fromStatus)}
                    </span>
                  )}
                  {log.fromStatus && log.toStatus && (
                    <span className="text-outline">←</span>
                  )}
                  {log.toStatus && (
                    <span className="rounded bg-primary-container px-1.5 py-0.5 font-mono text-on-primary-container font-bold">
                      {statusLabel(log.toStatus)}
                    </span>
                  )}
                </div>
              )}

              {/* ملاحظات */}
              {log.notes && (
                <p className="mt-1.5 text-xs text-on-surface-variant">{log.notes}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
