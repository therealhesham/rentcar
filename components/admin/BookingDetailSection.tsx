import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  id?: string;
};

export function BookingDetailSection({
  icon: Icon,
  title,
  description,
  children,
  className = "",
  id,
}: Props) {
  return (
    <section
      id={id}
      className={`overflow-hidden rounded-2xl border border-outline-variant/25 bg-white shadow-[0_4px_24px_-10px_rgba(28,27,27,0.1)] ${className}`}
    >
      <div className="flex gap-3 border-b border-outline-variant/15 bg-gradient-to-l from-surface-container-low/80 to-white px-5 py-4 sm:px-6">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-container/50 text-primary"
          aria-hidden
        >
          <Icon className="h-5 w-5" strokeWidth={2.25} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-extrabold tracking-tight text-on-surface sm:text-lg">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-sm leading-relaxed text-on-surface-variant">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}
