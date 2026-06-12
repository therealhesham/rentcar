"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { ChangeEvent, useTransition } from "react";

export function LanguageSwitcher() {
  const [isPending, startTransition] = useTransition();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function onSelectChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value;
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  }

  return (
    <label className="relative text-gray-800 dark:text-gray-200">
      <span className="sr-only">Change language</span>
      <select
        className="appearance-none bg-transparent py-2 pl-2 pr-6 text-sm font-semibold focus:outline-none disabled:opacity-50"
        defaultValue={locale}
        disabled={isPending}
        onChange={onSelectChange}
      >
        <option value="ar">العربية</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}
