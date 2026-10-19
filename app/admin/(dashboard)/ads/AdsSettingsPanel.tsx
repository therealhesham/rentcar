"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  deleteAdsSpendAction,
  saveAdsSpendAction,
  saveCampaignNameAction,
} from "@/app/admin/ads-actions";
import { AD_NETWORK_OPTIONS, type AdsSettings } from "@/lib/ads-settings";

type Props = {
  settings: AdsSettings;
  /** مفاتيح الحملات التي ظهرت في الفترة — اقتراحات للإكمال التلقائي. */
  campaignKeys: string[];
  defaultFrom: string;
  defaultTo: string;
};

const INPUT =
  "w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3.5 py-2.5 text-sm font-medium text-on-surface outline-none ring-primary/50 transition-all focus:border-primary focus:ring-2";
const LABEL = "mb-1.5 block text-xs font-bold text-on-surface-variant";
const BUTTON =
  "inline-flex items-center justify-center rounded-xl bg-[#003749] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#00506b] disabled:opacity-50";

const sar = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 2 });

function useRefreshOnSuccess(state: { ok: boolean } | null, formRef: React.RefObject<HTMLFormElement | null>) {
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router, formRef]);
}

export function AdsSettingsPanel({ settings, campaignKeys, defaultFrom, defaultTo }: Props) {
  const router = useRouter();
  const [spendState, spendAction, spendPending] = useActionState(saveAdsSpendAction, null);
  const [nameState, nameAction, namePending] = useActionState(saveCampaignNameAction, null);
  const [isDeleting, startDelete] = useTransition();
  const spendFormRef = useRef<HTMLFormElement>(null);
  const nameFormRef = useRef<HTMLFormElement>(null);

  useRefreshOnSuccess(spendState, spendFormRef);
  useRefreshOnSuccess(nameState, nameFormRef);

  function removeSpend(id: string) {
    if (!confirm("حذف قيد الإنفاق هذا؟")) return;
    startDelete(async () => {
      const res = await deleteAdsSpendAction(id);
      if (res.ok) router.refresh();
      else alert(res.error || "تعذّر الحذف.");
    });
  }

  const names = Object.entries(settings.campaignNames);
  const spendSorted = [...settings.spend].sort((a, b) => b.from.localeCompare(a.from));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-outline-variant/25 bg-white p-5 sm:p-6">
        <h3 className="text-base font-extrabold text-on-surface">إدخال الإنفاق</h3>
        <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">
          انسخ الإنفاق والنقرات من تقرير الحساب الإعلاني لكل حملة وفترة. يُوزَّع القيد على الأيام
          تلقائياً فيظهر في أي فترة تعرضها اللوحة. اترك «الحملة» فارغة إن كان الرقم لإجمالي الشبكة.
        </p>

        <form ref={spendFormRef} action={spendAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="ads-network">الشبكة</label>
            <select id="ads-network" name="network" className={INPUT} defaultValue="Google Ads">
              {AD_NETWORK_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="ads-campaign">الحملة (اختياري)</label>
            <input
              id="ads-campaign"
              name="campaign"
              list="ads-campaign-keys"
              className={INPUT}
              dir="ltr"
              placeholder="رقم الحملة أو utm_campaign"
              autoComplete="off"
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="ads-from">من</label>
            <input id="ads-from" type="date" name="from" defaultValue={defaultFrom} required className={INPUT} />
          </div>
          <div>
            <label className={LABEL} htmlFor="ads-to">إلى</label>
            <input id="ads-to" type="date" name="to" defaultValue={defaultTo} required className={INPUT} />
          </div>
          <div>
            <label className={LABEL} htmlFor="ads-amount">الإنفاق (ر.س)</label>
            <input id="ads-amount" name="amountSar" inputMode="decimal" required className={INPUT} dir="ltr" placeholder="0" />
          </div>
          <div>
            <label className={LABEL} htmlFor="ads-clicks">النقرات حسب المنصة (اختياري)</label>
            <input id="ads-clicks" name="clicks" inputMode="numeric" className={INPUT} dir="ltr" placeholder="0" />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <button type="submit" disabled={spendPending} className={BUTTON}>
              {spendPending ? "جارٍ الحفظ…" : "إضافة قيد إنفاق"}
            </button>
            {spendState && !spendState.ok ? (
              <span className="text-sm font-bold text-error">{spendState.error}</span>
            ) : null}
          </div>
        </form>

        <datalist id="ads-campaign-keys">
          {campaignKeys.map((k) => (
            <option key={k} value={k} />
          ))}
        </datalist>

        {spendSorted.length > 0 ? (
          <div className="mt-5 overflow-x-auto rounded-xl border border-outline-variant/25">
            <table className="w-full min-w-[460px] text-start text-sm">
              <thead>
                <tr className="bg-surface-container text-xs font-extrabold text-on-surface-variant">
                  <th className="px-3 py-2 text-start">الفترة</th>
                  <th className="px-3 py-2 text-start">الشبكة / الحملة</th>
                  <th className="px-3 py-2 text-start">الإنفاق</th>
                  <th className="px-3 py-2 text-start">النقرات</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {spendSorted.map((e) => (
                  <tr key={e.id} className="border-t border-outline-variant/15">
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums" dir="ltr">
                      {e.from} → {e.to}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-bold">{e.network}</span>
                      <span className="text-on-surface-variant" dir="ltr">
                        {e.campaign ? ` · ${settings.campaignNames[e.campaign] ?? e.campaign}` : " · الشبكة كلها"}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-bold tabular-nums">{sar(e.amountSar)}</td>
                    <td className="px-3 py-2 tabular-nums">{e.clicks ?? "—"}</td>
                    <td className="px-3 py-2 text-end">
                      <button
                        type="button"
                        onClick={() => removeSpend(e.id)}
                        disabled={isDeleting}
                        aria-label="حذف القيد"
                        className="rounded-lg p-1.5 text-error transition-colors hover:bg-error-container/40 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-outline-variant/25 bg-white p-5 sm:p-6">
        <h3 className="text-base font-extrabold text-on-surface">أسماء الحملات</h3>
        <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">
          جوجل يمرّر <span className="font-mono text-xs" dir="ltr">gad_campaignid</span> رقماً فقط. اربط كل رقم باسمه من حسابك
          ليظهر في الجدول مقروءاً. اترك الاسم فارغاً لحذف التسمية.
        </p>

        <form ref={nameFormRef} action={nameAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="ads-key">رقم الحملة</label>
            <input
              id="ads-key"
              name="key"
              list="ads-campaign-keys"
              required
              className={INPUT}
              dir="ltr"
              placeholder="24031470190"
              autoComplete="off"
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="ads-name">الاسم</label>
            <input id="ads-name" name="name" className={INPUT} placeholder="مثال: بحث — جدة — سيارات اقتصادية" />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <button type="submit" disabled={namePending} className={BUTTON}>
              {namePending ? "جارٍ الحفظ…" : "حفظ التسمية"}
            </button>
            {nameState && !nameState.ok ? (
              <span className="text-sm font-bold text-error">{nameState.error}</span>
            ) : null}
          </div>
        </form>

        {names.length > 0 ? (
          <ul className="mt-5 divide-y divide-outline-variant/15 rounded-xl border border-outline-variant/25">
            {names.map(([key, name]) => (
              <li key={key} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
                <span className="font-bold">{name}</span>
                <span className="font-mono text-xs text-on-surface-variant" dir="ltr">{key}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 rounded-xl bg-surface-container-low/60 px-4 py-3 text-sm text-on-surface-variant">
            لا تسميات بعد. الأرقام التي ظهرت في هذه الفترة متاحة في قائمة الإكمال أعلاه.
          </p>
        )}
      </section>
    </div>
  );
}
