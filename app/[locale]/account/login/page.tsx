import { AccountLoginClient } from "@/components/account/AccountLoginClient";
import { safeCustomerReturnPath } from "@/lib/customer-booking-access";

export default async function AccountLoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : {};
  const raw = sp.next;
  const nextRaw = Array.isArray(raw) ? raw[0] : raw;
  const returnTo = safeCustomerReturnPath(nextRaw);

  return <AccountLoginClient returnTo={returnTo} />;
}
