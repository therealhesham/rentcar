"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

function buildHref(base: string, q?: string): string {
  const trimmed = q?.trim();
  return trimmed ? `${base}?q=${encodeURIComponent(trimmed)}` : base;
}

type Props = {
  basePath: string;
  currentQ?: string;
};

export function CancelledBookingsFilters({ basePath, currentQ }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onSearch = useCallback(
    (formData: FormData) => {
      const q = String(formData.get("q") ?? "").trim();
      startTransition(() => {
        router.push(buildHref(basePath, q || undefined));
      });
    },
    [basePath, router],
  );

  return (
    <form
      className="flex max-w-md flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(new FormData(e.currentTarget));
      }}
    >
      <label className="sr-only" htmlFor="cancelled-q">
        بحث بالاسم أو الجوال أو رقم الطلب
      </label>
      <input
        id="cancelled-q"
        name="q"
        type="search"
        defaultValue={currentQ ?? ""}
        placeholder="بحث: اسم، جوال، رقم الطلب…"
        className="min-w-0 flex-1 rounded-xl border border-outline-variant/35 bg-white px-4 py-2.5 text-sm outline-none transition-shadow focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
        dir="auto"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "…" : "بحث"}
      </button>
      {currentQ ? (
        <Link
          href={basePath}
          className="self-center text-xs font-bold text-primary hover:underline"
        >
          مسح
        </Link>
      ) : null}
    </form>
  );
}
