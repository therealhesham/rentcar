import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function patch(rel, replacers) {
  const p = path.join(root, rel);
  let s = fs.readFileSync(p, "utf8");
  const orig = s;
  for (const [a, b] of replacers) {
    if (!s.includes(a)) {
      console.error("MISSING in", rel, ":", JSON.stringify(a.slice(0, 80)));
      process.exit(1);
    }
    s = s.split(a).join(b);
  }
  if (s === orig) console.warn("no change", rel);
  fs.writeFileSync(p, s);
  console.log("ok", rel);
}

patch("components/fleet/FleetCheckoutClient.tsx", [
  [
    'import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";',
    'import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";',
  ],
  [
    `                              <span className="text-[16px] font-extrabold tracking-wide text-[#003749] tabular-nums" dir="ltr">
                                {formatSarAmount(a.pricePerDay)} <SarCurrencyGlyph />
                              </span>`,
    `                              <SarAmountWithSymbol
                                amountClassName="text-[16px] font-extrabold tracking-wide text-[#003749]"
                              >
                                {formatSarAmount(a.pricePerDay)}
                              </SarAmountWithSymbol>`,
  ],
  [
    `                        <span className="font-extrabold text-[#003749]">
                          {formatSarAmount(
                            dailyRentalInclTaxSar(car.pricePerDayExclTax, car.vatRatePercent),
                          )}{" "}
                          <SarCurrencyGlyph />
                        </span>{" "}`,
    `                        <span className="font-extrabold text-[#003749]">
                          <SarAmountWithSymbol>
                            {formatSarAmount(
                              dailyRentalInclTaxSar(car.pricePerDayExclTax, car.vatRatePercent),
                            )}
                          </SarAmountWithSymbol>
                        </span>{" "}`,
  ],
  [
    `                          <span className="font-extrabold text-[#003749]">
                            {formatSarAmount(car.pricePerDayExclTax)} <SarCurrencyGlyph />
                          </span>`,
    `                          <span className="font-extrabold text-[#003749]">
                            <SarAmountWithSymbol>{formatSarAmount(car.pricePerDayExclTax)}</SarAmountWithSymbol>
                          </span>`,
  ],
  [
    `                          <span className="font-extrabold text-[#003749]">
                            {formatSarAmount(
                              dailyRentalInclTaxSar(car.pricePerDayExclTax, car.vatRatePercent),
                            )}{" "}
                            <SarCurrencyGlyph />
                          </span>`,
    `                          <span className="font-extrabold text-[#003749]">
                            <SarAmountWithSymbol>
                              {formatSarAmount(
                                dailyRentalInclTaxSar(car.pricePerDayExclTax, car.vatRatePercent),
                              )}
                            </SarAmountWithSymbol>
                          </span>`,
  ],
  [
    `                        <span className="font-extrabold text-[#003749]">
                          {formatSarAmount(car.pricePerDayExclTax)} <SarCurrencyGlyph />
                        </span>{" "}`,
    `                        <span className="font-extrabold text-[#003749]">
                          <SarAmountWithSymbol>{formatSarAmount(car.pricePerDayExclTax)}</SarAmountWithSymbol>
                        </span>{" "}`,
  ],
  [
    `                        <span className="font-bold text-[#003749] tabular-nums" dir="ltr">
                          {formatSarAmount(totals.rentalExclTax)} <SarCurrencyGlyph />
                        </span>`,
    `                        <span className="font-bold text-[#003749] tabular-nums">
                          <SarAmountWithSymbol>{formatSarAmount(totals.rentalExclTax)}</SarAmountWithSymbol>
                        </span>`,
  ],
  [
    `                          <span className="font-bold text-[#003749] tabular-nums" dir="ltr">
                            {formatSarAmount(totals.addonsExclTax)} <SarCurrencyGlyph />
                          </span>`,
    `                          <span className="font-bold text-[#003749] tabular-nums">
                            <SarAmountWithSymbol>{formatSarAmount(totals.addonsExclTax)}</SarAmountWithSymbol>
                          </span>`,
  ],
  [
    `                        <span className="font-bold text-[#003749] tabular-nums" dir="ltr">
                          {formatSarAmount(totals.vatAmount)} <SarCurrencyGlyph />
                        </span>`,
    `                        <span className="font-bold text-[#003749] tabular-nums">
                          <SarAmountWithSymbol>{formatSarAmount(totals.vatAmount)}</SarAmountWithSymbol>
                        </span>`,
  ],
  [
    `                          <p
                            className="text-2xl font-extrabold tabular-nums tracking-tight"
                            dir="ltr"
                            aria-label={\`\${formatSarAmount(totals.totalInclTax)} ريال سعودي\`}
                          >
                            {formatSarAmount(totals.totalInclTax)}{" "}
                            <span className="text-[#dbb878]" aria-hidden>
                              <SarCurrencyGlyph />
                            </span>
                          </p>`,
    `                          <p
                            className="text-2xl font-extrabold tabular-nums tracking-tight"
                            dir="ltr"
                            aria-label={\`\${formatSarAmount(totals.totalInclTax)} ريال سعودي\`}
                          >
                            <SarAmountWithSymbol
                              amountClassName="text-2xl font-extrabold text-white tabular-nums tracking-tight"
                              glyphClassName="text-[#dbb878]"
                            >
                              {formatSarAmount(totals.totalInclTax)}
                            </SarAmountWithSymbol>
                          </p>`,
  ],
]);

patch("components/fleet/PaymentClient.tsx", [
  [
    'import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";',
    'import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";',
  ],
  [
    `          : (
              <>
                ادفع {formatSarAmount(booking.totals.totalInclTax)} <SarCurrencyGlyph />
              </>
            );`,
    `          : (
              <>
                ادفع{" "}
                <SarAmountWithSymbol amountClassName="font-extrabold tabular-nums">
                  {formatSarAmount(booking.totals.totalInclTax)}
                </SarAmountWithSymbol>
              </>
            );`,
  ],
  [
    `                          {formatSarAmount(a.lineTotalExclTax)} <SarCurrencyGlyph />`,
    `                          <SarAmountWithSymbol amountClassName="font-bold text-[#003749]">
                            {formatSarAmount(a.lineTotalExclTax)}
                          </SarAmountWithSymbol>`,
  ],
  [
    `                    <>
                      {formatSarAmount(booking.totals.rentalExclTax)} <SarCurrencyGlyph />
                    </>`,
    `                    <SarAmountWithSymbol amountClassName="tabular-nums">
                      {formatSarAmount(booking.totals.rentalExclTax)}
                    </SarAmountWithSymbol>`,
  ],
  [
    `                    <>
                      {formatSarAmount(booking.totals.addonsExclTax)} <SarCurrencyGlyph />
                    </>`,
    `                    <SarAmountWithSymbol amountClassName="tabular-nums">
                      {formatSarAmount(booking.totals.addonsExclTax)}
                    </SarAmountWithSymbol>`,
  ],
  [
    `                    <>
                      {formatSarAmount(booking.totals.vatAmount)} <SarCurrencyGlyph />
                    </>`,
    `                    <SarAmountWithSymbol amountClassName="tabular-nums">
                      {formatSarAmount(booking.totals.vatAmount)}
                    </SarAmountWithSymbol>`,
  ],
  [
    `                    <>
                      {formatSarAmount(booking.totals.totalInclTax)} <SarCurrencyGlyph />
                    </>`,
    `                    <SarAmountWithSymbol amountClassName="tabular-nums">
                      {formatSarAmount(booking.totals.totalInclTax)}
                    </SarAmountWithSymbol>`,
  ],
]);

patch("components/home/FleetShowcase.tsx", [
  [
    'import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";',
    'import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";',
  ],
  [
    "                    {car.price} <SarCurrencyGlyph />",
    `                    <SarAmountWithSymbol amountClassName="text-xl font-extrabold text-primary">
                      {car.price}
                    </SarAmountWithSymbol>`,
  ],
]);

patch("app/admin/(dashboard)/vehicles/page.tsx", [
  [
    'import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";',
    'import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";',
  ],
  [
    '                    {v.price.toLocaleString("en-US")} <SarCurrencyGlyph />',
    `                    <SarAmountWithSymbol amountClassName="tabular-nums font-semibold">
                      {v.price.toLocaleString("en-US")}
                    </SarAmountWithSymbol>`,
  ],
]);

patch("components/admin/EditBookingRequestForm.tsx", [
  [
    'import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";',
    'import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";',
  ],
  [
    `              {it.lineTotalExclTax != null ? (
                <>
                  {it.lineTotalExclTax} <SarCurrencyGlyph />
                </>
              ) : (
                ""
              )}`,
    `              {it.lineTotalExclTax != null ? (
                <SarAmountWithSymbol amountClassName="text-xs font-bold">
                  {it.lineTotalExclTax}
                </SarAmountWithSymbol>
              ) : (
                ""
              )}`,
  ],
]);

patch("components/subscriptions/SubscriptionPackagesInWidget.tsx", [
  [
    'import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";',
    'import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";',
  ],
  [
    "                      {p.monthlyPriceSar} <SarCurrencyGlyph /> / شهر",
    `                      <SarAmountWithSymbol amountClassName="font-semibold">
                        {p.monthlyPriceSar}
                      </SarAmountWithSymbol>{" "}
                      / شهر`,
  ],
]);

patch("app/subscriptions/page.tsx", [
  [
    'import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";',
    'import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";',
  ],
  [
    '                      <span dir="ltr">{p.monthlyPriceSar} <SarCurrencyGlyph /></span>',
    `                      <span dir="ltr">
                        <SarAmountWithSymbol amountClassName="font-semibold">{p.monthlyPriceSar}</SarAmountWithSymbol>
                      </span>`,
  ],
  [
    '                      <span dir="ltr">{p.depositAmountSar} <SarCurrencyGlyph /></span>',
    `                      <span dir="ltr">
                        <SarAmountWithSymbol amountClassName="font-semibold">{p.depositAmountSar}</SarAmountWithSymbol>
                      </span>`,
  ],
  [
    `                      <span dir="ltr">
                        {Math.min(lowTotal, highTotal).toLocaleString("ar-SA")} –
                        {" "}
                        {Math.max(lowTotal, highTotal).toLocaleString("ar-SA")}{" "}
                        <SarCurrencyGlyph />
                      </span>`,
    `                      <span dir="ltr" className="inline-flex flex-row flex-wrap items-baseline gap-x-1">
                        <span className="tabular-nums">{Math.min(lowTotal, highTotal).toLocaleString("ar-SA")}</span>
                        <span>–</span>
                        <SarAmountWithSymbol amountClassName="tabular-nums text-[11px]">
                          {Math.max(lowTotal, highTotal).toLocaleString("ar-SA")}
                        </SarAmountWithSymbol>
                      </span>`,
  ],
]);

patch("app/subscriptions/[slug]/page.tsx", [
  [
    'import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";',
    'import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";',
  ],
  [
    '                    <span dir="ltr">{plan.extraKmFeeSarPerKm} <SarCurrencyGlyph /> / كم</span>',
    `                    <span dir="ltr">
                      <SarAmountWithSymbol amountClassName="font-semibold">{plan.extraKmFeeSarPerKm}</SarAmountWithSymbol>{" "}
                      / كم
                    </span>`,
  ],
  [
    '                    <span dir="ltr" className="text-[#003749]">{plan.depositAmountSar} <SarCurrencyGlyph /></span>',
    `                    <span dir="ltr" className="text-[#003749]">
                      <SarAmountWithSymbol amountClassName="font-semibold">{plan.depositAmountSar}</SarAmountWithSymbol>
                    </span>`,
  ],
  [
    `              <p className="mt-4 text-center text-4xl font-black text-[#003749]" dir="ltr">
                {plan.monthlyPriceSar}
                <span className="ms-2 text-lg font-semibold text-on-surface-variant">
                  <SarCurrencyGlyph /> / شهراً
                </span>
              </p>`,
    `              <p className="mt-4 text-center text-4xl font-black text-[#003749]" dir="ltr">
                <span className="inline-flex flex-row flex-wrap items-baseline justify-center gap-2">
                  <SarAmountWithSymbol amountClassName="text-4xl font-black text-[#003749] tabular-nums">
                    {plan.monthlyPriceSar}
                  </SarAmountWithSymbol>
                  <span className="text-lg font-semibold text-on-surface-variant">/ شهراً</span>
                </span>
              </p>`,
  ],
]);

console.log("all patches applied");
