import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
};

export function AdminPageHeader({
  title,
  description,
  backHref,
  backLabel = "لوحة التحكم",
  actions,
}: Props) {
  const showBack = backHref !== undefined && backHref !== "";
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        {showBack ? (
          <Link
            href={backHref!}
            className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-primary transition-colors hover:text-[#5d4211]"
          >
            <span aria-hidden>←</span>
            {backLabel}
          </Link>
        ) : null}
        <h1 className="text-2xl font-extrabold tracking-tight text-[#1c1b1b] sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <div className="mt-2 max-w-3xl text-sm leading-relaxed text-on-surface-variant sm:text-[15px]">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
