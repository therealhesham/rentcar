import type { ReactNode } from "react";

type Props = {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
};

/** بطاقة محتوى موحّدة في صفحات الإدارة */
export function AdminCard({ title, description, children, className = "", noPadding }: Props) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-outline-variant/25 bg-white shadow-[0_4px_24px_-10px_rgba(28,27,27,0.1)] ${className}`}
    >
      {title ? (
        <div className="border-b border-outline-variant/15 bg-surface-container-low/40 px-5 py-4 sm:px-6">
          <h2 className="text-lg font-extrabold tracking-tight text-on-surface">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">{description}</p>
          ) : null}
        </div>
      ) : null}
      <div className={noPadding ? undefined : "p-5 sm:p-6"}>{children}</div>
    </section>
  );
}
