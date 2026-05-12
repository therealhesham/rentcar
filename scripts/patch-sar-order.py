# -*- coding: utf-8 -*-
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def patch_fleet_checkout():
    p = ROOT / "components/fleet/FleetCheckoutClient.tsx"
    s = p.read_text(encoding="utf-8")
    s = s.replace(
        'import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";',
        'import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";',
    )
    s = s.replace(
        """                              <span className="text-[16px] font-extrabold tracking-wide text-[#003749] tabular-nums" dir="ltr">
                                {formatSarAmount(a.pricePerDay)} <SarCurrencyGlyph />
                              </span>""",
        """                              <SarAmountWithSymbol
                                amountClassName="text-[16px] font-extrabold tracking-wide text-[#003749]"
                              >
                                {formatSarAmount(a.pricePerDay)}
                              </SarAmountWithSymbol>""",
    )
    s = s.replace(
        """                        <span className="font-extrabold text-[#003749]">
                          {formatSarAmount(
                            dailyRentalInclTaxSar(car.pricePerDayExclTax, car.vatRatePercent),
                          )}{" "}
                          <SarCurrencyGlyph />
                        </span>{" "}""",
        """                        <span className="font-extrabold text-[#003749]">
                          <SarAmountWithSymbol>
                            {formatSarAmount(
                              dailyRentalInclTaxSar(car.pricePerDayExclTax, car.vatRatePercent),
                            )}
                          </SarAmountWithSymbol>
                        </span>{" "}""",
    )
    s = s.replace(
        """                          <span className="font-extrabold text-[#003749]">
                            {formatSarAmount(car.pricePerDayExclTax)} <SarCurrencyGlyph />
                          </span>""",
        """                          <span className="font-extrabold text-[#003749]">
                            <SarAmountWithSymbol>{formatSarAmount(car.pricePerDayExclTax)}</SarAmountWithSymbol>
                          </span>""",
    )
    s = s.replace(
        """                          <span className="font-extrabold text-[#003749]">
                            {formatSarAmount(
                              dailyRentalInclTaxSar(car.pricePerDayExclTax, car.vatRatePercent),
                            )}{" "}
                            <SarCurrencyGlyph />
                          </span>""",
        """                          <span className="font-extrabold text-[#003749]">
                            <SarAmountWithSymbol>
                              {formatSarAmount(
                                dailyRentalInclTaxSar(car.pricePerDayExclTax, car.vatRatePercent),
                              )}
                            </SarAmountWithSymbol>
                          </span>""",
    )
    s = s.replace(
        """                        <span className="font-extrabold text-[#003749]">
                          {formatSarAmount(car.pricePerDayExclTax)} <SarCurrencyGlyph />
                        </span>{" "}""",
        """                        <span className="font-extrabold text-[#003749]">
                          <SarAmountWithSymbol>{formatSarAmount(car.pricePerDayExclTax)}</SarAmountWithSymbol>
                        </span>{" "}""",
    )
    s = s.replace(
        """                        <span className="font-bold text-[#003749] tabular-nums" dir="ltr">
                          {formatSarAmount(totals.rentalExclTax)} <SarCurrencyGlyph />
                        </span>""",
        """                        <span className="font-bold text-[#003749] tabular-nums">
                          <SarAmountWithSymbol>{formatSarAmount(totals.rentalExclTax)}</SarAmountWithSymbol>
                        </span>""",
    )
    s = s.replace(
        """                          <span className="font-bold text-[#003749] tabular-nums" dir="ltr">
                            {formatSarAmount(totals.addonsExclTax)} <SarCurrencyGlyph />
                          </span>""",
        """                          <span className="font-bold text-[#003749] tabular-nums">
                            <SarAmountWithSymbol>{formatSarAmount(totals.addonsExclTax)}</SarAmountWithSymbol>
                          </span>""",
    )
    s = s.replace(
        """                        <span className="font-bold text-[#003749] tabular-nums" dir="ltr">
                          {formatSarAmount(totals.vatAmount)} <SarCurrencyGlyph />
                        </span>""",
        """                        <span className="font-bold text-[#003749] tabular-nums">
                          <SarAmountWithSymbol>{formatSarAmount(totals.vatAmount)}</SarAmountWithSymbol>
                        </span>""",
    )
    s = s.replace(
        """                          <p
                            className="text-2xl font-extrabold tabular-nums tracking-tight"
                            dir="ltr"
                            aria-label={`${formatSarAmount(totals.totalInclTax)} ريال سعودي`}
                          >
                            {formatSarAmount(totals.totalInclTax)}{" "}
                            <span className="text-[#dbb878]" aria-hidden>
                              <SarCurrencyGlyph />
                            </span>
                          </p>""",
        """                          <p
                            className="text-2xl font-extrabold tabular-nums tracking-tight"
                            dir="ltr"
                            aria-label={`${formatSarAmount(totals.totalInclTax)} ريال سعودي`}
                          >
                            <SarAmountWithSymbol
                              amountClassName="text-2xl font-extrabold text-white tabular-nums tracking-tight"
                              glyphClassName="text-[#dbb878]"
                            >
                              {formatSarAmount(totals.totalInclTax)}
                            </SarAmountWithSymbol>
                          </p>""",
    )
    p.write_text(s, encoding="utf-8")
    print("patched FleetCheckoutClient")


def patch_payment():
    p = ROOT / "components/fleet/PaymentClient.tsx"
    s = p.read_text(encoding="utf-8")
    s = s.replace(
        'import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";',
        'import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";',
    )
    s = s.replace(
        """          : (
              <>
                ادفع {formatSarAmount(booking.totals.totalInclTax)} <SarCurrencyGlyph />
              </>
            );""",
        """          : (
              <>
                ادفع{" "}
                <SarAmountWithSymbol amountClassName="font-extrabold tabular-nums">
                  {formatSarAmount(booking.totals.totalInclTax)}
                </SarAmountWithSymbol>
              </>
            );""",
    )
    s = s.replace(
        """                          {formatSarAmount(a.lineTotalExclTax)} <SarCurrencyGlyph />""",
        """                          <SarAmountWithSymbol amountClassName="font-bold text-[#003749]">
                            {formatSarAmount(a.lineTotalExclTax)}
                          </SarAmountWithSymbol>""",
    )
    s = s.replace(
        """                    <>
                      {formatSarAmount(booking.totals.rentalExclTax)} <SarCurrencyGlyph />
                    </>""",
        """                    <SarAmountWithSymbol amountClassName="tabular-nums">
                      {formatSarAmount(booking.totals.rentalExclTax)}
                    </SarAmountWithSymbol>""",
    )
    s = s.replace(
        """                    <>
                      {formatSarAmount(booking.totals.addonsExclTax)} <SarCurrencyGlyph />
                    </>""",
        """                    <SarAmountWithSymbol amountClassName="tabular-nums">
                      {formatSarAmount(booking.totals.addonsExclTax)}
                    </SarAmountWithSymbol>""",
    )
    s = s.replace(
        """                    <>
                      {formatSarAmount(booking.totals.vatAmount)} <SarCurrencyGlyph />
                    </>""",
        """                    <SarAmountWithSymbol amountClassName="tabular-nums">
                      {formatSarAmount(booking.totals.vatAmount)}
                    </SarAmountWithSymbol>""",
    )
    s = s.replace(
        """                    <>
                      {formatSarAmount(booking.totals.totalInclTax)} <SarCurrencyGlyph />
                    </>""",
        """                    <SarAmountWithSymbol amountClassName="tabular-nums">
                      {formatSarAmount(booking.totals.totalInclTax)}
                    </SarAmountWithSymbol>""",
    )
    p.write_text(s, encoding="utf-8")
    print("patched PaymentClient")


def patch_misc():
    patches = [
        (
            ROOT / "components/home/FleetShowcase.tsx",
            'import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";',
            'import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";',
        ),
        (
            ROOT / "components/home/FleetShowcase.tsx",
            "                    {car.price} <SarCurrencyGlyph />",
            """                    <SarAmountWithSymbol amountClassName="text-xl font-extrabold text-primary">
                      {car.price}
                    </SarAmountWithSymbol>""",
        ),
        (
            ROOT / "app/admin/(dashboard)/vehicles/page.tsx",
            'import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";',
            'import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";',
        ),
        (
            ROOT / "app/admin/(dashboard)/vehicles/page.tsx",
            "                    {v.price.toLocaleString(\"en-US\")} <SarCurrencyGlyph />",
            """                    <SarAmountWithSymbol amountClassName="tabular-nums font-semibold">
                      {v.price.toLocaleString("en-US")}
                    </SarAmountWithSymbol>""",
        ),
        (
            ROOT / "components/admin/EditBookingRequestForm.tsx",
            'import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";',
            'import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";',
        ),
        (
            ROOT / "components/admin/EditBookingRequestForm.tsx",
            """              {it.lineTotalExclTax != null ? (
                <>
                  {it.lineTotalExclTax} <SarCurrencyGlyph />
                </>
              ) : (
                ""
              )}""",
            """              {it.lineTotalExclTax != null ? (
                <SarAmountWithSymbol amountClassName="text-xs font-bold">
                  {it.lineTotalExclTax}
                </SarAmountWithSymbol>
              ) : (
                ""
              )}""",
        ),
        (
            ROOT / "components/subscriptions/SubscriptionPackagesInWidget.tsx",
            'import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";',
            'import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";',
        ),
        (
            ROOT / "components/subscriptions/SubscriptionPackagesInWidget.tsx",
            "                      {p.monthlyPriceSar} <SarCurrencyGlyph /> / شهر",
            """                      <SarAmountWithSymbol amountClassName="font-semibold">
                        {p.monthlyPriceSar}
                      </SarAmountWithSymbol>{" "}
                      / شهر""",
        ),
        (
            ROOT / "app/subscriptions/page.tsx",
            'import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";',
            'import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";',
        ),
        (
            ROOT / "app/subscriptions/page.tsx",
            "                      <span dir=\"ltr\">{p.monthlyPriceSar} <SarCurrencyGlyph /></span>",
            """                      <span dir="ltr">
                        <SarAmountWithSymbol amountClassName="font-semibold">{p.monthlyPriceSar}</SarAmountWithSymbol>
                      </span>""",
        ),
        (
            ROOT / "app/subscriptions/page.tsx",
            "                      <span dir=\"ltr\">{p.depositAmountSar} <SarCurrencyGlyph /></span>",
            """                      <span dir="ltr">
                        <SarAmountWithSymbol amountClassName="font-semibold">{p.depositAmountSar}</SarAmountWithSymbol>
                      </span>""",
        ),
        (
            ROOT / "app/subscriptions/page.tsx",
            """                      <span dir="ltr">
                        {Math.min(lowTotal, highTotal).toLocaleString("ar-SA")} –
                        {" "}
                        {Math.max(lowTotal, highTotal).toLocaleString("ar-SA")}{" "}
                        <SarCurrencyGlyph />
                      </span>""",
            """                      <span dir="ltr" className="inline-flex flex-row flex-wrap items-baseline gap-x-1">
                        <span className="tabular-nums">{Math.min(lowTotal, highTotal).toLocaleString("ar-SA")}</span>
                        <span>–</span>
                        <SarAmountWithSymbol amountClassName="tabular-nums text-[11px]">
                          {Math.max(lowTotal, highTotal).toLocaleString("ar-SA")}
                        </SarAmountWithSymbol>
                      </span>""",
        ),
    ]
    for path, old, new in patches:
        t = path.read_text(encoding="utf-8")
        if old not in t:
            raise SystemExit(f"MISSING in {path}: {old[:60]}...")
        path.write_text(t.replace(old, new), encoding="utf-8")
        print("patched", path.relative_to(ROOT))


def patch_sub_slug():
    p = ROOT / "app/subscriptions/[slug]/page.tsx"
    s = p.read_text(encoding="utf-8")
    s = s.replace(
        'import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";',
        'import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";',
    )
    s = s.replace(
        """                    <span dir="ltr">{plan.extraKmFeeSarPerKm} <SarCurrencyGlyph /> / كم</span>""",
        """                    <span dir="ltr">
                      <SarAmountWithSymbol amountClassName="font-semibold">{plan.extraKmFeeSarPerKm}</SarAmountWithSymbol>{" "}
                      / كم
                    </span>""",
    )
    s = s.replace(
        """                    <span dir="ltr" className="text-[#003749]">{plan.depositAmountSar} <SarCurrencyGlyph /></span>""",
        """                    <span dir="ltr" className="text-[#003749]">
                      <SarAmountWithSymbol amountClassName="font-semibold">{plan.depositAmountSar}</SarAmountWithSymbol>
                    </span>""",
    )
    s = s.replace(
        """              <p className="mt-4 text-center text-4xl font-black text-[#003749]" dir="ltr">
                {plan.monthlyPriceSar}
                <span className="ms-2 text-lg font-semibold text-on-surface-variant">
                  <SarCurrencyGlyph /> / شهراً
                </span>
              </p>""",
        """              <p className="mt-4 text-center text-4xl font-black text-[#003749]" dir="ltr">
                <span className="inline-flex flex-row flex-wrap items-baseline justify-center gap-2">
                  <SarAmountWithSymbol amountClassName="text-4xl font-black text-[#003749] tabular-nums">
                    {plan.monthlyPriceSar}
                  </SarAmountWithSymbol>
                  <span className="text-lg font-semibold text-on-surface-variant">/ شهراً</span>
                </span>
              </p>""",
    )
    p.write_text(s, encoding="utf-8")
    print("patched slug page")


if __name__ == "__main__":
    patch_fleet_checkout()
    patch_payment()
    patch_misc()
    patch_sub_slug()
