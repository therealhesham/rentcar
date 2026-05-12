import { redirect } from "next/navigation";
import { deactivateSubscriptionPlan, createSubscriptionPlan } from "@/app/admin/subscription-admin-actions";
import { verifyAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionPlansPage() {
  if (!(await verifyAdminSession())) redirect("/admin/login");

  const [plans, models] = await Promise.all([
    prisma.subscriptionPlan.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: {
        carModel: { include: { brand: true } },
      },
    }),
    prisma.carModel.findMany({
      select: {
        id: true,
        name: true,
        year: true,
        brand: { select: { name: true } },
      },
      orderBy: [{ id: "asc" }],
      take: 200,
    }),
  ]);

  async function deactivateAction(formData: FormData) {
    "use server";
    const id = Number(formData.get("planId"));
    await deactivateSubscriptionPlan(id);
  }

  async function createPlanWrapped(formData: FormData) {
    "use server";
    await createSubscriptionPlan(formData);
  }

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">باقات الاشتراك الشهري</h1>
        <p className="mt-3 max-w-2xl text-on-surface-variant">
          اربط الباقات بمركبات فعلية، وحدّد الأسعار خارج الضريبة، العربون، وهيكل بدلات شهرية لتظهر فى{" "}
          <code>/subscriptions</code>.
        </p>
      </header>

      <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-inner">
        <h2 className="text-xl font-black text-on-surface">إضافة خطة جديدة</h2>
        <form action={createPlanWrapped} className="mt-4 grid max-w-xl grid-cols-1 gap-4 text-sm font-bold">
          <label className="flex flex-col gap-1">
            المعرف المعروض في الرابط (slug لاتيني)
            <input name="slug" dir="ltr" placeholder="sedan-lite-2500" className="rounded-xl border px-3 py-2" required />
          </label>
          <label className="flex flex-col gap-1">
            الموديل
            <select name="carModelId" required className="rounded-xl border px-3 py-2">
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.brand.name} — {m.name} ({m.year}) #{m.id}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            عنوان تسويقي (اختياري)
            <input name="marketingTitleAr" className="rounded-xl border px-3 py-2" placeholder="سيارة حضرية مريحة للعائلات" />
          </label>
          <label className="flex flex-col gap-1">
            وصف مختصر (اختياري)
            <textarea name="descriptionAr" rows={3} className="rounded-xl border px-3 py-2 font-medium" />
          </label>
          <label className="flex flex-col gap-1">
            السعر الشهري (بدون ضريبة)
            <input name="monthlyPriceSar" type="number" min={1} className="rounded-xl border px-3 py-2" required />
          </label>
          <label className="flex flex-col gap-1">
            بدلات شهرية بالكيلومتر
            <input name="mileageKmPerMonth" type="number" min={800} step={50} defaultValue={3000} className="rounded-xl border px-3 py-2" required />
          </label>
          <label className="flex flex-col gap-1">
            عربون (مسترد)
            <input name="depositAmountSar" type="number" min={0} defaultValue={3000} className="rounded-xl border px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1">
            رسوم الزيادة / كيلومتر بعد البدلات
            <input name="extraKmFeeSarPerKm" type="number" min={0} defaultValue={4} className="rounded-xl border px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1">
            مدّد مخزّنة (فواصل)
            <input name="durationOptionsCsv" defaultValue="1,3,6" className="rounded-xl border px-3 py-2" dir="ltr" />
          </label>
          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 font-semibold">
              <input name="insuranceIncluded" type="checkbox" defaultChecked className="size-4" />
              شامل التأمين
            </label>
            <label className="inline-flex items-center gap-2 font-semibold">
              <input name="maintenanceIncluded" type="checkbox" defaultChecked className="size-4" />
              شامل صيانة وفق سياسة الاشتراك
            </label>
          </div>
          <button type="submit" className="mt-2 w-fit rounded-xl bg-primary px-6 py-2.5 font-extrabold text-on-primary shadow-sm">
            حفظ الباقة
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-black">خطط موجودة ({plans.length})</h2>
        <div className="overflow-auto rounded-2xl border border-outline-variant/30">
          <table className="w-full min-w-[720px] text-start text-xs">
            <thead className="bg-surface-container/80 font-black uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2">التسمية</th>
                <th className="px-3 py-2">المركبة</th>
                <th className="px-3 py-2">سعر شهر</th>
                <th className="px-3 py-2">بدلات</th>
                <th className="px-3 py-2">عربون</th>
                <th className="px-3 py-2">تفعّل</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id} className="border-t border-outline-variant/20 bg-surface-container-lowest/70">
                  <td className="px-3 py-2 align-top font-bold">{p.slug}</td>
                  <td className="px-3 py-2 align-top">{`${p.carModel.brand.name} ${p.carModel.name}`}</td>
                  <td dir="ltr" className="px-3 py-2 align-top">{p.monthlyPriceSar}</td>
                  <td dir="ltr" className="px-3 py-2 align-top">{p.mileageKmPerMonth}</td>
                  <td dir="ltr" className="px-3 py-2 align-top">{p.depositAmountSar}</td>
                  <td className="px-3 py-2 align-top">
                    <span className="font-bold">{p.isActive ? "نعم" : "لا"}</span>
                    {p.isActive ? (
                      <form action={deactivateAction} className="mt-1">
                        <input type="hidden" name="planId" value={p.id} />
                        <button type="submit" className="rounded-lg border border-outline-variant px-2 py-1 font-bold hover:bg-surface-container">
                          إخفاء
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
