import { logoutAdmin } from "@/app/admin/actions";

export function LogoutButton() {
  return (
    <form action={logoutAdmin}>
      <button
        type="submit"
        className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container"
      >
        خروج
      </button>
    </form>
  );
}
