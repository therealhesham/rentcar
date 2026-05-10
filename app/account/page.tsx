import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutCustomer } from "@/app/account/actions";
import { SiteFooter } from "@/components/home/SiteFooter";
import { SiteNav } from "@/components/shared/SiteNav";
import { getCustomerProfile } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AccountDashboardPage() {
  const profile = await getCustomerProfile();
  if (!profile) redirect("/account/login");

  const bookings = await prisma.bookingRequest.findMany({
    where: {
      OR: [
        { customerId: profile.id },
        ...(profile.phone ? [{ phone: profile.phone }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      carModel: { include: { brand: true } },
    },
  });

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f4f5] text-on-surface">
      <SiteNav active="home" />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16 pt-28">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[#003749]">حسابي</h1>
            <p className="mt-1 text-sm font-semibold text-on-surface">{profile.name ?? "—"}</p>
            <p className="text-sm tabular-nums text-on-surface-variant" dir="ltr">
              {profile.email}
            </p>
            {profile.phone ? (
              <p className="mt-1 text-sm font-bold tabular-nums text-[#003749]" dir="ltr">
                {profile.phone}
              </p>
            ) : null}
          </div>
          <form action={logoutCustomer}>
            <button
              type="submit"
              className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-on-surface hover:bg-neutral-50"
            >
              خروج
            </button>
          </form>
        </div>

        <section className="mt-10">
          <h2 className="text-lg font-extrabold text-[#003749]">حجوزاتي</h2>
          <p className="mt-1 text-xs text-on-surface-variant">
            تظهر الطلبات المرتبطة بحسابك أو بنفس رقم الجوال المسجّل.
          </p>

          {bookings.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-10 text-center text-sm text-on-surface-variant">
              لا توجد حجوزات بعد.{" "}
              <Link href="/fleet" className="font-bold text-[#003749] underline">
                تصفح الأسطول
              </Link>
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {bookings.map((b) => (
                <li
                  key={b.id}
                  className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-extrabold text-[#003749]">
                        {b.kind === "DIRECT" && b.carModel
                          ? `${b.carModel.brand.name} ${b.carModel.name}`
                          : b.carType}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {b.kind === "DIRECT" ? "حجز مباشر" : "طلب حجز"} · رقم{" "}
                        <span dir="ltr" className="tabular-nums font-bold">
                          #{b.id}
                        </span>
                      </p>
                    </div>
                    <div className="text-end text-xs">
                      <p className="font-bold text-on-surface">{b.status}</p>
                      {b.kind === "DIRECT" ? (
                        <p className="text-on-surface-variant">
                          الدفع: {b.paymentStatus === "PAID" ? "مدفوع" : "بانتظار الدفع"}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 text-xs tabular-nums text-on-surface-variant" dir="ltr">
                    الاستلام: {b.pickupDate.toLocaleString("ar-SA")} · {b.numberOfDays} يوم
                  </p>
                  {b.kind === "DIRECT" && b.paymentStatus === "PENDING" ? (
                    <Link
                      href={`/fleet/payment/${b.id}`}
                      className="mt-3 inline-block text-sm font-bold text-[#ea580c] underline"
                    >
                      إتمام الدفع
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
