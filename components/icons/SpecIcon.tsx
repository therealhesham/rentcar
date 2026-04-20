import type { LucideIcon } from "lucide-react";
import { Armchair, DoorOpen, Fan, Gauge, Luggage, Timer, Zap } from "lucide-react";

/** مفاتيح تطابق أسماء أيقونات Material السابقة — تُعرَض الآن عبر Lucide */
const SPEC_ICONS: Record<string, LucideIcon> = {
  bolt: Zap,
  timer: Timer,
  speed: Gauge,
  mode_fan: Fan,
  airline_seat_recline_extra: Armchair,
  door_open: DoorOpen,
  luggage: Luggage,
};

type SpecIconProps = {
  name: string;
  className?: string;
};

export function SpecIcon({ name, className }: SpecIconProps) {
  const Icon = SPEC_ICONS[name] ?? Armchair;
  return <Icon className={className} strokeWidth={1.75} aria-hidden />;
}
