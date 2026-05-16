const STATUS_STYLES: Record<string, string> = {
  NEW: "bg-[#fff7ed] text-[#9a3412] ring-[#fdba74]/40",
  CONTACTED: "bg-[#eff6ff] text-[#1d4ed8] ring-[#93c5fd]/40",
  CONFIRMED: "bg-[#ecfdf5] text-[#047857] ring-[#6ee7b7]/40",
  CANCELLED: "bg-[#fef2f2] text-[#b91c1c] ring-[#fecaca]/40",
  COMPLETED: "bg-surface-container-low text-on-surface-variant ring-outline-variant/30",
};

export function AdminStatusBadge({ status }: { status: string }) {
  const style =
    STATUS_STYLES[status] ?? "bg-surface-container-low text-on-surface ring-outline-variant/25";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${style}`}
    >
      {status}
    </span>
  );
}

export function AdminKindBadge({ kind }: { kind: string }) {
  const isDirect = kind === "DIRECT";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${
        isDirect
          ? "bg-[#ecfdf5] text-[#047857] ring-[#6ee7b7]/40"
          : "bg-[#f5f3ff] text-[#6d28d9] ring-[#c4b5fd]/40"
      }`}
    >
      {isDirect ? "حجز مباشر" : "استفسار"}
    </span>
  );
}
