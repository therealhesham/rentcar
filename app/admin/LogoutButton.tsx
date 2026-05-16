import { logoutAdmin } from "@/app/admin/actions";

type Props = {
  variant?: "default" | "sidebar";
};

export function LogoutButton({ variant = "default" }: Props) {
  const className =
    variant === "sidebar"
      ? "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold text-white/85 transition-colors hover:bg-white/10 hover:text-white"
      : "rounded-xl border border-outline-variant px-4 py-2 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container";

  return (
    <form action={logoutAdmin} className={variant === "sidebar" ? "w-full" : undefined}>
      <button type="submit" className={className}>
        تسجيل الخروج
      </button>
    </form>
  );
}
