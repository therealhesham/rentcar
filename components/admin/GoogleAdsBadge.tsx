/** وسم صغير يوضّح أن العميل جاء من نقرة على إعلان Google (له GCLID). */
export function GoogleAdsBadge() {
  return (
    <span
      title="جاء من إعلان Google"
      className="ms-2 inline-flex items-center rounded-md border border-[#fecaca] bg-[#fef2f2] px-1.5 py-0.5 align-middle text-[10px] font-bold text-[#b91c1c]"
    >
      Google Ads
    </span>
  );
}
